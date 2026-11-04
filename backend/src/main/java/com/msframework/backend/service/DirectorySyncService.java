package com.msframework.backend.service;

import com.msframework.backend.config.AuthentikSettings;
import com.msframework.backend.config.SystemRoles;
import com.msframework.backend.dto.DirectoryDtos.DirectoryChange;
import com.msframework.backend.dto.DirectoryDtos.DirectoryFieldChange;
import com.msframework.backend.dto.DirectoryDtos.DirectoryMapping;
import com.msframework.backend.dto.DirectoryDtos.DirectoryStatusDto;
import com.msframework.backend.dto.DirectoryDtos.DirectorySyncCounts;
import com.msframework.backend.dto.DirectoryDtos.DirectorySyncResult;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.OrgSetting;
import com.msframework.backend.entity.Role;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.OrgSettingRepository;
import com.msframework.backend.repository.RoleRepository;
import com.msframework.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

import static com.msframework.backend.config.SystemRoles.ADMIN;
import static com.msframework.backend.config.SystemRoles.MANAGER;
import static com.msframework.backend.config.SystemRoles.MEMBER;

/**
 * Imports and updates MSFramework users from the Authentik directory.
 *
 * <p>A sync reads every Authentik user and group, works out a plan (one {@link DirectoryChange}
 * per person) and, unless it is a preview, applies it in one transaction. Linked users (those with
 * {@code external_source = 'authentik'}) follow the directory; local users are never changed,
 * except that a local user whose email matches a staff member is linked to them. Users who leave
 * the staff groups, become inactive or disappear are deactivated, never deleted, and signed out.
 * The rule that at least one active admin exists always holds: a change that would break it is
 * reported as skipped.</p>
 */
@Service
public class DirectorySyncService {

    public static final String SOURCE = "authentik";
    /** The actor of the per-user audit events. */
    public static final String ACTOR = "Authentik sync";
    public static final String LAST_SYNC_KEY = "directory.authentik.lastSync";

    static final Set<String> SERVICE_ACCOUNT_TYPES = Set.of("service_account", "internal_service_account");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
    /** Serialises concurrent syncs (pg_advisory_xact_lock key; the seeder uses a different one). */
    private static final long LOCK_KEY = 7_412_002L;

    private static final Logger log = LoggerFactory.getLogger(DirectorySyncService.class);

    private final AuthentikSettings settings;
    private final AuthentikClient client;
    private final DirectoryMappingService mappingService;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final RoleRepository roleRepository;
    private final OrgSettingRepository orgSettingRepository;
    private final UserSessionService userSessionService;
    private final AuditService auditService;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;
    private final JsonMapper jsonMapper;
    private final TransactionTemplate writeTx;
    private final TransactionTemplate readTx;

    public DirectorySyncService(AuthentikSettings settings, AuthentikClient client, DirectoryMappingService mappingService,
                                UserRepository userRepository, DepartmentRepository departmentRepository,
                                RoleRepository roleRepository, OrgSettingRepository orgSettingRepository,
                                UserSessionService userSessionService, AuditService auditService,
                                PasswordEncoder passwordEncoder, JdbcTemplate jdbc, JsonMapper jsonMapper,
                                PlatformTransactionManager transactionManager) {
        this.settings = settings;
        this.client = client;
        this.mappingService = mappingService;
        this.userRepository = userRepository;
        this.departmentRepository = departmentRepository;
        this.roleRepository = roleRepository;
        this.orgSettingRepository = orgSettingRepository;
        this.userSessionService = userSessionService;
        this.auditService = auditService;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
        this.jsonMapper = jsonMapper;
        this.writeTx = new TransactionTemplate(transactionManager);
        this.readTx = new TransactionTemplate(transactionManager);
        this.readTx.setReadOnly(true);
    }

    /** What is stored about the last applied sync. */
    record LastSync(OffsetDateTime at, String by, DirectorySyncCounts counts) {
    }

    // ------------------------------------------------------------------ status

    public DirectoryStatusDto status() {
        LastSync last = readTx.execute(status -> orgSettingRepository.findById(LAST_SYNC_KEY)
                .map(OrgSetting::getValue)
                .map(this::parseLastSync)
                .orElse(null));
        long linked = readTx.execute(status -> (long) userRepository.findByExternalSourceOrderByIdAsc(SOURCE).size());
        return new DirectoryStatusDto(settings.isConfigured(), SOURCE, settings.host(), settings.tokenSource(), linked,
                last == null ? null : last.at(), last == null ? null : last.by(), last == null ? null : last.counts());
    }

    private LastSync parseLastSync(String json) {
        try {
            return jsonMapper.readValue(json, LastSync.class);
        } catch (JacksonException e) {
            return null;
        }
    }

    // ------------------------------------------------------------------ preview and apply

    /** A dry run: reads Authentik and the database, changes nothing. */
    public DirectorySyncResult preview() {
        AuthentikClient.Snapshot snapshot = client.fetch();
        DirectoryMapping mapping = mappingService.current();
        return readTx.execute(status -> {
            Plan plan = plan(snapshot, mapping);
            return plan.toResult(true, settings.host(), snapshot.users().size(), 0);
        });
    }

    /** Reads Authentik (outside any transaction), then plans and applies in one transaction. */
    public DirectorySyncResult apply(User actor) {
        AuthentikClient.Snapshot snapshot = client.fetch();
        DirectoryMapping mapping = mappingService.current();
        DirectorySyncResult result = writeTx.execute(status -> {
            jdbc.queryForList("SELECT pg_advisory_xact_lock(?)", LOCK_KEY);
            Plan plan = plan(snapshot, mapping);
            int revoked = write(plan);
            DirectorySyncResult done = plan.toResult(false, settings.host(), snapshot.users().size(), revoked);
            DirectorySyncCounts c = done.counts();
            auditService.log("directory_synced", actor.getEmail(), String.format(Locale.ROOT,
                    "Synced users from Authentik: %d created, %d linked, %d updated, %d deactivated, %d skipped, %d unchanged",
                    c.created(), c.linked(), c.updated(), c.deactivated(), c.skipped(), c.unchanged()));
            saveLastSync(new LastSync(done.at(), actor.getEmail(), c));
            return done;
        });
        log.info("[DIRECTORY] Sync applied by {}: {}", actor.getEmail(), result.counts());
        return result;
    }

    private void saveLastSync(LastSync last) {
        OrgSetting row = orgSettingRepository.findById(LAST_SYNC_KEY)
                .orElseGet(() -> OrgSetting.builder().key(LAST_SYNC_KEY).build());
        row.setValue(jsonMapper.writeValueAsString(last));
        row.setUpdatedAt(LocalDateTime.now());
        orgSettingRepository.save(row);
    }

    // ------------------------------------------------------------------ planning

    /** The plan for one person. Mutable while the plan is worked out. */
    static final class Item {
        String action;
        String externalId;
        String username;
        String name;
        String email;
        User user;
        /** Values after the sync. */
        String role;
        Department department;
        String status;
        /** The department this person will head, set by the sync. */
        Department heads;
        /** Departments this person stops heading. */
        final List<Department> stopsHeading = new ArrayList<>();
        final List<DirectoryFieldChange> fields = new ArrayList<>();
        final List<String> notes = new ArrayList<>();
        String reason;
        Boolean applied;

        boolean wasActiveAdmin() {
            return user != null && user.isActive() && user.hasRole(ADMIN);
        }

        boolean endsActiveAdmin() {
            return ADMIN.equals(role) && User.STATUS_ACTIVE.equals(status)
                    && ("create".equals(action) || "link".equals(action) || "update".equals(action) || "unchanged".equals(action));
        }

        boolean endsActiveManagerOrAdmin() {
            return SystemRoles.isPrivileged(role) && User.STATUS_ACTIVE.equals(status) && !"skip".equals(action)
                    && !"deactivate".equals(action);
        }

        DirectoryChange toDto() {
            return new DirectoryChange(action, externalId, username, name, email, user != null ? user.getId() : null,
                    "skip".equals(action) ? null : role,
                    "skip".equals(action) || department == null ? null : department.getName(),
                    List.copyOf(fields), reason, List.copyOf(notes), applied);
        }
    }

    final class Plan {
        final List<Item> items = new ArrayList<>();

        DirectorySyncResult toResult(boolean dryRun, String host, int directoryUsers, int revoked) {
            int created = 0, updated = 0, linked = 0, deactivated = 0, skipped = 0, unchanged = 0;
            for (Item item : items) {
                switch (item.action) {
                    case "create" -> created++;
                    case "update" -> updated++;
                    case "link" -> linked++;
                    case "deactivate" -> deactivated++;
                    case "skip" -> skipped++;
                    default -> unchanged++;
                }
            }
            List<DirectoryChange> changes = items.stream()
                    .sorted(Comparator.comparing((Item i) -> order(i.action))
                            .thenComparing(i -> i.name == null ? "" : i.name.toLowerCase(Locale.ROOT))
                            .thenComparing(i -> i.externalId == null ? "" : i.externalId))
                    .map(Item::toDto)
                    .toList();
            return new DirectorySyncResult(dryRun, OffsetDateTime.now(), host, directoryUsers,
                    new DirectorySyncCounts(created, updated, linked, deactivated, skipped, unchanged), changes, revoked);
        }
    }

    private static int order(String action) {
        return List.of("create", "link", "update", "deactivate", "skip", "unchanged").indexOf(action);
    }

    Plan plan(AuthentikClient.Snapshot snapshot, DirectoryMapping mapping) {
        Map<String, Department> departments = new HashMap<>();
        for (Department d : departmentRepository.findAllWithManager()) {
            departments.put(d.getName().toLowerCase(Locale.ROOT), d);
        }
        Map<String, User> linked = new LinkedHashMap<>();
        for (User u : userRepository.findByExternalSourceOrderByIdAsc(SOURCE)) {
            linked.put(u.getExternalId(), u);
        }
        Set<Long> seen = new HashSet<>();
        Set<String> claimedEmails = new HashSet<>();
        Plan plan = new Plan();

        List<AuthentikClient.DirectoryUser> users = snapshot.users().stream()
                .sorted(Comparator.comparing(u -> u.username() == null ? "" : u.username()))
                .toList();
        for (AuthentikClient.DirectoryUser du : users) {
            Item item = new Item();
            item.externalId = du.pk();
            item.username = du.username();
            item.name = du.name();
            item.email = UserService.normalizeEmail(du.email());
            User local = linked.get(du.pk());
            if (local != null) seen.add(local.getId());
            item.user = local;
            plan.items.add(item);
            evaluate(item, du, local, mapping, departments, claimedEmails);
        }

        // Linked users who are gone from Authentik altogether.
        for (User gone : linked.values()) {
            if (seen.contains(gone.getId())) continue;
            Item item = new Item();
            item.externalId = gone.getExternalId();
            item.username = gone.getExternalUsername();
            item.name = gone.getFullName();
            item.email = gone.getEmail();
            item.user = gone;
            keep(item, gone);
            if (gone.isActive()) {
                deactivate(item, "No longer in Authentik");
            } else {
                item.action = "unchanged";
                item.reason = "Already inactive";
            }
            plan.items.add(item);
        }

        assignHeads(plan);
        guardLastAdmin(plan);
        return plan;
    }

    private void evaluate(Item item, AuthentikClient.DirectoryUser du, User local, DirectoryMapping mapping,
                          Map<String, Department> departments, Set<String> claimedEmails) {
        if (local != null) keep(item, local);

        if (du.type() != null && SERVICE_ACCOUNT_TYPES.contains(du.type())) {
            skipOrDeactivate(item, local, "Service account");
            return;
        }
        if (du.username() != null && mapping.ignoredUsernames().stream().anyMatch(du.username()::equalsIgnoreCase)) {
            skipOrDeactivate(item, local, "System account");
            return;
        }
        boolean staff = du.groups().stream().anyMatch(g -> DirectoryMappingService.matchesAny(mapping.staffGroups(), g));
        if (!staff) {
            skipOrDeactivate(item, local, "Not in a staff group");
            return;
        }
        if (!du.active()) {
            skipOrDeactivate(item, local, local == null ? "Inactive in Authentik and never imported" : "Inactive in Authentik");
            return;
        }
        boolean emailOk = item.email.length() <= 254 && EMAIL.matcher(item.email).matches();
        if (local == null && !emailOk) {
            skip(item, "No usable email address");
            return;
        }

        boolean linking = false;
        if (local == null) {
            User byEmail = userRepository.findByEmailIgnoreCase(item.email).orElse(null);
            if (byEmail != null && byEmail.getExternalSource() != null) {
                skip(item, "The email belongs to an account linked to another directory account");
                return;
            }
            if (!claimedEmails.add(item.email)) {
                skip(item, "Another Authentik account has the same email");
                return;
            }
            if (byEmail != null) {
                local = byEmail;
                item.user = byEmail;
                keep(item, byEmail);
                linking = true;
            }
        }

        // What Authentik says the user should be.
        String name = fullName(du);
        String role = role(du, mapping);
        Department department = local != null ? local.getDepartment() : null;
        String departmentName = departmentFor(du, mapping);
        if (departmentName != null) {
            Department found = departments.get(departmentName.toLowerCase(Locale.ROOT));
            if (found == null) {
                item.notes.add("There is no department called \"" + departmentName + "\"; the department was left as it is.");
            } else {
                department = found;
            }
        }

        if (local == null) {
            item.action = "create";
            item.name = name;
            item.role = role;
            item.department = department;
            item.status = User.STATUS_ACTIVE;
            return;
        }

        String email = local.getEmail();
        if (!emailOk) {
            item.notes.add("Authentik has no usable email address; the current one was kept.");
        } else if (!item.email.equalsIgnoreCase(local.getEmail())) {
            User other = userRepository.findByEmailIgnoreCase(item.email).orElse(null);
            if ((other != null && !other.getId().equals(local.getId())) || !claimedEmails.add(item.email)) {
                item.notes.add("The new email address is used by another account; the current one was kept.");
            } else {
                email = item.email;
            }
        } else {
            claimedEmails.add(item.email);
        }

        diff(item, "name", local.getFullName(), name);
        diff(item, "email", local.getEmail(), email);
        diff(item, "username", local.getExternalUsername(), du.username());
        diff(item, "status", local.getStatus(), User.STATUS_ACTIVE);
        diff(item, "role", local.getPrimaryRoleName(), role);
        diff(item, "department", deptName(local.getDepartment()), deptName(department));
        item.name = name;
        item.email = email;
        item.role = role;
        item.department = department;
        item.status = User.STATUS_ACTIVE;
        item.action = linking ? "link" : item.fields.isEmpty() ? "unchanged" : "update";
    }

    /** Starts from the user's current values. */
    private static void keep(Item item, User user) {
        item.role = user.getPrimaryRoleName();
        item.department = user.getDepartment();
        item.status = user.getStatus();
    }

    private static void skip(Item item, String reason) {
        item.action = "skip";
        item.reason = reason;
    }

    /** A linked user who should no longer be active is deactivated; anyone else is skipped. */
    private static void skipOrDeactivate(Item item, User linkedUser, String reason) {
        if (linkedUser == null) {
            skip(item, reason);
        } else if (linkedUser.isActive()) {
            item.name = linkedUser.getFullName();
            item.email = linkedUser.getEmail();
            deactivate(item, reason);
        } else {
            item.name = linkedUser.getFullName();
            item.email = linkedUser.getEmail();
            item.action = "unchanged";
            item.reason = "Already inactive";
        }
    }

    private static void deactivate(Item item, String reason) {
        item.action = "deactivate";
        item.reason = reason;
        diff(item, "status", item.user.getStatus(), User.STATUS_INACTIVE);
        item.status = User.STATUS_INACTIVE;
    }

    private static void diff(Item item, String field, String from, String to) {
        if (!Objects.equals(from, to)) item.fields.add(new DirectoryFieldChange(field, from, to));
    }

    private static String deptName(Department department) {
        return department == null ? null : department.getName();
    }

    private static String fullName(AuthentikClient.DirectoryUser du) {
        String name = du.name() == null ? "" : du.name().trim().replaceAll("\\s+", " ");
        if (name.isEmpty()) name = du.username() == null ? "" : du.username().trim();
        if (name.isEmpty()) name = "Authentik user " + du.pk();
        return name.length() > 100 ? name.substring(0, 100) : name;
    }

    /** The highest role any of the user's groups gives; staff in none of them are members. */
    static String role(AuthentikClient.DirectoryUser du, DirectoryMapping mapping) {
        if (du.groups().stream().anyMatch(g -> DirectoryMappingService.matchesAny(mapping.adminGroups(), g))) return ADMIN;
        if (du.groups().stream().anyMatch(g -> DirectoryMappingService.matchesAny(mapping.managerGroups(), g))) return MANAGER;
        return MEMBER;
    }

    /** The first mapped group (in mapping order) that gives a department, or null. */
    static String departmentFor(AuthentikClient.DirectoryUser du, DirectoryMapping mapping) {
        for (Map.Entry<String, String> entry : mapping.departments().entrySet()) {
            if (entry.getValue() == null || entry.getValue().isBlank()) continue;
            if (du.groups().stream().anyMatch(entry.getKey()::equalsIgnoreCase)) return entry.getValue();
        }
        return null;
    }

    /**
     * Department heads. A person stops heading a department when they will no longer be an active
     * MANAGER or ADMIN member of it. A MANAGER mapped to a department becomes its head when it has
     * none, or when its head was chosen by the sync and is no longer a candidate.
     */
    private void assignHeads(Plan plan) {
        Map<Long, Item> byUser = new HashMap<>();
        for (Item item : plan.items) {
            if (item.user != null) byUser.put(item.user.getId(), item);
        }

        // Heads who leave: deactivated, demoted or moved out.
        Map<Long, Department> vacated = new HashMap<>();
        for (Item item : plan.items) {
            if (item.user == null || "skip".equals(item.action)) continue;
            for (Department led : departmentRepository.findByManagerId(item.user.getId())) {
                boolean stillLeads = item.endsActiveManagerOrAdmin() && item.department != null
                        && item.department.getId().equals(led.getId());
                if (!stillLeads) {
                    item.stopsHeading.add(led);
                    item.fields.add(new DirectoryFieldChange("manages", led.getName(), null));
                    if ("unchanged".equals(item.action)) item.action = "update";
                    vacated.put(led.getId(), led);
                }
            }
        }

        // Candidates per department, in plan order (sorted by user name).
        Map<Long, List<Item>> candidates = new LinkedHashMap<>();
        for (Item item : plan.items) {
            if (!MANAGER.equals(item.role) || item.department == null || !item.endsActiveManagerOrAdmin()) continue;
            if ("skip".equals(item.action)) continue;
            candidates.computeIfAbsent(item.department.getId(), id -> new ArrayList<>()).add(item);
        }

        for (List<Item> list : candidates.values()) {
            Department department = list.getFirst().department;
            User current = vacated.containsKey(department.getId()) ? null : department.getManager();
            boolean syncOwned = SOURCE.equals(department.getManagerSource());
            if (current != null && !syncOwned) {
                list.forEach(i -> i.notes.add(department.getName() + " already has a manager chosen by an admin."));
                continue;
            }
            if (current != null && list.stream().anyMatch(i -> i.user != null && i.user.getId().equals(current.getId()))) {
                continue;
            }
            Item head = list.getFirst();
            head.heads = department;
            head.fields.add(new DirectoryFieldChange("manages", null, department.getName()));
            if ("unchanged".equals(head.action)) head.action = "update";
            if (current != null) {
                Item previous = byUser.get(current.getId());
                if (previous != null && !previous.stopsHeading.contains(department)) {
                    previous.stopsHeading.add(department);
                    previous.fields.add(new DirectoryFieldChange("manages", department.getName(), null));
                    if ("unchanged".equals(previous.action)) previous.action = "update";
                }
            }
        }
    }

    /** Turns changes that would leave no active admin into skips. */
    private void guardLastAdmin(Plan plan) {
        long admins = userRepository.countActiveWithRole(ADMIN);
        for (Item item : plan.items) {
            if (item.endsActiveAdmin() && !item.wasActiveAdmin()) admins++;
            if (item.wasActiveAdmin() && !item.endsActiveAdmin()) admins--;
        }
        if (admins >= 1) return;
        for (Item item : plan.items) {
            if (admins >= 1) break;
            if (!item.wasActiveAdmin() || item.endsActiveAdmin()) continue;
            if ("deactivate".equals(item.action)) {
                String why = item.reason;
                item.action = "skip";
                item.fields.clear();
                item.stopsHeading.clear();
                item.status = item.user.getStatus();
                item.reason = "Kept active: they are the last active admin (" + why.toLowerCase(Locale.ROOT) + ")";
            } else {
                item.fields.removeIf(f -> "role".equals(f.field()) || "status".equals(f.field()));
                item.role = ADMIN;
                item.status = item.user.getStatus();
                item.notes.add("Kept the ADMIN role: at least one active admin is required.");
                if (item.fields.isEmpty() && "update".equals(item.action)) item.action = "unchanged";
            }
            admins++;
        }
    }

    // ------------------------------------------------------------------ writing

    /** Applies the plan. Returns how many sessions were ended. */
    private int write(Plan plan) {
        Map<String, Role> roles = new HashMap<>();
        for (Role role : roleRepository.findAll()) roles.put(role.getName(), role);
        int revoked = 0;

        for (Item item : plan.items) {
            switch (item.action) {
                case "create" -> {
                    User user = userRepository.save(User.builder()
                            .fullName(item.name)
                            .email(item.email)
                            // Nobody knows this password: the person sets one through "Forgot password"
                            // or an admin's reset link (until single sign-on exists).
                            .password(passwordEncoder.encode(SecureTokens.random(32)))
                            .status(User.STATUS_ACTIVE)
                            .department(item.department)
                            .roles(new HashSet<>(Set.of(requireRole(roles, item.role))))
                            .externalSource(SOURCE)
                            .externalId(item.externalId)
                            .externalUsername(item.username)
                            .build());
                    item.user = user;
                    String heads = head(item);
                    auditService.log("user_created", ACTOR,
                            "Imported " + item.name + " (" + item.email + ") from Authentik as " + item.role
                                    + (item.department != null ? " in " + item.department.getName() : "") + heads,
                            new AuditService.Subject(user.getId(), item.department != null ? item.department.getId() : null));
                    item.applied = true;
                }
                case "link", "update", "deactivate" -> {
                    User user = item.user;
                    boolean wasActive = user.isActive();
                    String previousEmail = user.getEmail();
                    Long previousDepartment = user.getDepartment() != null ? user.getDepartment().getId() : null;
                    for (Department led : item.stopsHeading) {
                        led.setManager(null);
                        led.setManagerSource(null);
                        departmentRepository.save(led);
                    }
                    if ("link".equals(item.action)) {
                        user.setExternalSource(SOURCE);
                        user.setExternalId(item.externalId);
                    }
                    if (item.externalId != null && item.username != null) user.setExternalUsername(item.username);
                    user.setFullName(item.name);
                    user.setEmail(item.email);
                    user.setStatus(item.status);
                    if (!Objects.equals(user.getPrimaryRoleName(), item.role) || user.getRoles().size() != 1) {
                        user.setRoles(new HashSet<>(Set.of(requireRole(roles, item.role))));
                    }
                    user.setDepartment(item.department);
                    userRepository.save(user);
                    if (wasActive && !user.isActive()) {
                        revoked += userSessionService.revokeAll(previousEmail);
                    }
                    String heads = head(item);
                    String verb = switch (item.action) {
                        case "link" -> "Linked " + item.name + " to Authentik";
                        case "deactivate" -> "Deactivated " + item.name + " (" + item.reason + ")";
                        default -> "Updated " + item.name + " from Authentik";
                    };
                    List<String> changes = item.fields.stream()
                            .filter(f -> !"manages".equals(f.field()))
                            .map(f -> f.field() + " " + (f.from() == null ? "none" : f.from()) + " → "
                                    + (f.to() == null ? "none" : f.to()))
                            .toList();
                    Long subjectDepartment = item.department != null ? item.department.getId() : previousDepartment;
                    auditService.log("user_updated", ACTOR,
                            verb + (changes.isEmpty() ? "" : ": " + String.join(", ", changes)) + heads
                                    + stopped(item),
                            new AuditService.Subject(user.getId(), subjectDepartment));
                    item.applied = true;
                }
                default -> item.applied = false;
            }
        }

        // Heads last, so a department vacated above can be given to its new head.
        for (Item item : plan.items) {
            if (item.heads == null || item.user == null || !Boolean.TRUE.equals(item.applied)) continue;
            item.heads.setManager(item.user);
            item.heads.setManagerSource(SOURCE);
            departmentRepository.save(item.heads);
        }

        if (userRepository.countActiveWithRole(ADMIN) < 1) {
            // guardLastAdmin makes this unreachable; the transaction is rolled back if it ever happens.
            throw ApiException.conflict("At least one active admin is required. Nothing was changed.");
        }
        return revoked;
    }

    private static String head(Item item) {
        return item.heads == null ? "" : "; now manager of " + item.heads.getName();
    }

    private static String stopped(Item item) {
        if (item.stopsHeading.isEmpty()) return "";
        return "; no longer manager of " + String.join(", ", item.stopsHeading.stream().map(Department::getName).toList());
    }

    private static Role requireRole(Map<String, Role> roles, String name) {
        Role role = roles.get(name);
        if (role == null) throw ApiException.conflict("The role " + name + " does not exist");
        return role;
    }
}
