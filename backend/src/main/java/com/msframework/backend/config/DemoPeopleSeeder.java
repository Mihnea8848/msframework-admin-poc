package com.msframework.backend.config;

import com.msframework.backend.entity.AccessRequest;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.OrgSetting;
import com.msframework.backend.entity.Role;
import com.msframework.backend.entity.User;
import com.msframework.backend.repository.AccessRequestRepository;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.OrgSettingRepository;
import com.msframework.backend.repository.RoleRepository;
import com.msframework.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.text.Normalizer;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Demo people for MEH Studios: about 45 users across the seven departments, five department
 * managers, access requests and 60 days of audit history. Runs after {@link DatabaseSeeder} when
 * {@code app.seed.demo} is true, under the seeder's advisory lock, and only once per database: the
 * org_settings row {@value #MARKER} records that it ran.
 *
 * <p>It adds to what is there and never wipes anything: departments are matched by name (missing
 * ones are created), people whose email already exists are left alone, and the admin account is
 * never touched. Demo users sign in with {@value #DEMO_PASSWORD}.</p>
 */
@Component
@Order(DemoPeopleSeeder.ORDER)
public class DemoPeopleSeeder implements ApplicationRunner {

    public static final int ORDER = DatabaseSeeder.ORDER + 100;
    public static final String MARKER = "demo.people.v1";
    public static final String DEMO_PASSWORD = "MehDemo!2026";
    public static final String DOMAIN = "mehstudios.net";

    private static final Logger log = LoggerFactory.getLogger(DemoPeopleSeeder.class);

    private static final String ADMINISTRATION = "Administration";
    private static final String DEVELOPMENT = "Development";
    private static final String QUALITY = "Quality Control";
    private static final String EXTERNAL = "External Affairs";
    private static final String ETHICS = "Ethics & Regulations";
    private static final String HR = "Human Resources";
    private static final String ENGINEERING = "Engineering & Innovation";

    /** The seven studio departments and their seal colour keys (same as DatabaseSeeder). */
    private static final Map<String, String> DEPARTMENTS = new LinkedHashMap<>();

    static {
        DEPARTMENTS.put(ADMINISTRATION, "avatar-rose");
        DEPARTMENTS.put(DEVELOPMENT, "avatar-violet");
        DEPARTMENTS.put(QUALITY, "avatar-azure");
        DEPARTMENTS.put(EXTERNAL, "avatar-jade");
        DEPARTMENTS.put(ETHICS, "avatar-silver");
        DEPARTMENTS.put(HR, "avatar-orange");
        DEPARTMENTS.put(ENGINEERING, "avatar-snow");
    }

    /** One demo person. {@code head} marks the manager of their department. */
    record Person(String name, String title, String department, String role, boolean active, boolean head) {
        String email() {
            String ascii = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
            return ascii.toLowerCase(Locale.ROOT).replace("'", "").replace(' ', '.') + "@" + DOMAIN;
        }
    }

    private static final String A = SystemRoles.ADMIN;
    private static final String M = SystemRoles.MANAGER;
    private static final String U = SystemRoles.MEMBER;
    private static final String V = SystemRoles.VIEWER;

    static final List<Person> PEOPLE = List.of(
            new Person("Andreea Popescu", "Chief Operating Officer", ADMINISTRATION, A, true, false),
            new Person("Mihai Ionescu", "IT Administrator", ADMINISTRATION, A, true, false),
            new Person("Elena Dumitru", "Office Manager", ADMINISTRATION, M, true, true),
            new Person("Sofia Marin", "Executive Assistant", ADMINISTRATION, U, true, false),
            new Person("Lucas Moreau", "Facilities Coordinator", ADMINISTRATION, U, true, false),
            new Person("Ioana Stan", "Receptionist", ADMINISTRATION, V, true, false),

            new Person("Radu Constantinescu", "Head of Development", DEVELOPMENT, M, true, true),
            new Person("Bianca Georgescu", "Lead Gameplay Programmer", DEVELOPMENT, M, true, false),
            new Person("Kenji Watanabe", "Senior Engine Programmer", DEVELOPMENT, U, true, false),
            new Person("Alexandru Munteanu", "Gameplay Programmer", DEVELOPMENT, U, true, false),
            new Person("Maria Rossi", "Technical Artist", DEVELOPMENT, U, true, false),
            new Person("Daniel Olteanu", "Tools Programmer", DEVELOPMENT, U, true, false),
            new Person("Priya Raman", "UI Programmer", DEVELOPMENT, U, true, false),
            new Person("Cristian Barbu", "Junior Programmer", DEVELOPMENT, U, false, false),
            new Person("Emma Schneider", "Level Designer", DEVELOPMENT, U, true, false),
            new Person("Vlad Petrescu", "Narrative Designer", DEVELOPMENT, U, true, false),
            new Person("Laura Neagu", "3D Artist", DEVELOPMENT, U, false, false),

            new Person("Diana Matei", "QA Lead", QUALITY, M, true, true),
            new Person("Tomás García", "Senior QA Analyst", QUALITY, U, true, false),
            new Person("Andrei Lungu", "QA Tester", QUALITY, U, true, false),
            new Person("Alina Dobre", "QA Tester", QUALITY, U, true, false),
            new Person("Ștefan Rusu", "Certification Tester", QUALITY, U, true, false),
            new Person("Oliver Bennett", "QA Contractor", QUALITY, V, false, false),

            new Person("Irina Vasilescu", "Partnerships Lead", EXTERNAL, U, true, false),
            new Person("Matteo Bianchi", "Community Manager", EXTERNAL, U, true, false),
            new Person("Camelia Toma", "PR Specialist", EXTERNAL, U, true, false),
            new Person("Hannah Fischer", "Publishing Liaison", EXTERNAL, V, true, false),
            new Person("Teodora Radu", "Events Coordinator", EXTERNAL, V, true, false),

            new Person("Gabriel Stoica", "Legal Counsel", ETHICS, U, true, false),
            new Person("Nadia Haddad", "Compliance Officer", ETHICS, U, true, false),
            new Person("Florin Dragomir", "Data Protection Officer", ETHICS, U, true, false),

            new Person("Roxana Ilie", "HR Director", HR, M, true, true),
            new Person("Adriana Cristea", "Recruiter", HR, U, true, false),
            new Person("Liam O'Connor", "People Partner", HR, U, true, false),
            new Person("Cătălina Moldovan", "Payroll Specialist", HR, U, true, false),
            new Person("Ana Sima", "HR Intern", HR, V, true, false),

            new Person("Victor Enache", "Head of Engineering", ENGINEERING, M, true, true),
            new Person("Yuki Tanaka", "R&D Engineer", ENGINEERING, U, true, false),
            new Person("Bogdan Nistor", "Build Engineer", ENGINEERING, U, true, false),
            new Person("Lena Kowalski", "DevOps Engineer", ENGINEERING, U, true, false),
            new Person("Mircea Pop", "Hardware Engineer", ENGINEERING, U, false, false),
            new Person("Sara Lindqvist", "Machine Learning Engineer", ENGINEERING, U, true, false),
            new Person("Răzvan Ene", "Network Engineer", ENGINEERING, U, true, false),
            new Person("Paul Avram", "Graphics Engineer", ENGINEERING, U, true, false),
            new Person("Eva Novak", "Research Intern", ENGINEERING, V, true, false)
    );

    /** Access requests: name, email, department, days ago, status, note. */
    record Request(String name, String email, String department, int daysAgo, AccessRequest.Status status,
                   String note) {
    }

    static final List<Request> REQUESTS = List.of(
            new Request("Ilinca Badea", "ilinca.badea@" + DOMAIN, DEVELOPMENT, 1, AccessRequest.Status.PENDING, null),
            new Request("Marcus Johnson", "marcus.johnson@" + DOMAIN, QUALITY, 2, AccessRequest.Status.PENDING, null),
            new Request("Raluca Ciobanu", "raluca.ciobanu@" + DOMAIN, EXTERNAL, 3, AccessRequest.Status.PENDING, null),
            new Request("Ahmed Karim", "ahmed.karim@" + DOMAIN, ENGINEERING, 4, AccessRequest.Status.PENDING, null),
            new Request("Denisa Florea", "denisa.florea@" + DOMAIN, HR, 6, AccessRequest.Status.PENDING, null),
            new Request("Julien Dubois", "julien.dubois@" + DOMAIN, DEVELOPMENT, 9, AccessRequest.Status.PENDING, null),
            new Request("Ana Sima", "ana.sima@" + DOMAIN, HR, 21, AccessRequest.Status.APPROVED, null),
            new Request("Jake Turner", "jake.turner.games@gmail.com", DEVELOPMENT, 17, AccessRequest.Status.REJECTED,
                    "Not a MEH Studios employee. Contractors are added by Human Resources."),
            new Request("Costin Vlad", "costin.vlad@" + DOMAIN, QUALITY, 33, AccessRequest.Status.REJECTED,
                    "Costin already has an account under his old address; asked IT to rename it.")
    );

    /** What one run did. {@code seeded} is false when the marker was already there. */
    public record Summary(boolean seeded, int departmentsCreated, int usersCreated, int managersAssigned,
                          int accessRequestsCreated, int auditEventsCreated) {
    }

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final AccessRequestRepository accessRequestRepository;
    private final OrgSettingRepository orgSettingRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;
    private final boolean enabled;

    public DemoPeopleSeeder(DepartmentRepository departmentRepository,
                            UserRepository userRepository,
                            RoleRepository roleRepository,
                            AccessRequestRepository accessRequestRepository,
                            OrgSettingRepository orgSettingRepository,
                            PasswordEncoder passwordEncoder,
                            JdbcTemplate jdbcTemplate,
                            PlatformTransactionManager transactionManager,
                            @Value("${app.seed.demo:false}") boolean enabled) {
        this.departmentRepository = departmentRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.accessRequestRepository = accessRequestRepository;
        this.orgSettingRepository = orgSettingRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbcTemplate = jdbcTemplate;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.enabled = enabled;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (enabled) {
            seed();
        }
    }

    /** Seeds the demo people unless the marker says it already happened. Safe to call any number of times. */
    public Summary seed() {
        return transactionTemplate.execute(status -> {
            jdbcTemplate.queryForList("SELECT pg_advisory_xact_lock(hashtext('msf-seeder'))");
            if (orgSettingRepository.existsById(MARKER)) {
                return new Summary(false, 0, 0, 0, 0, 0);
            }
            Summary summary = seedOnce(LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS));
            orgSettingRepository.save(OrgSetting.builder()
                    .key(MARKER)
                    .value(summary.usersCreated() + " users, " + summary.accessRequestsCreated()
                            + " access requests, " + summary.auditEventsCreated() + " audit events")
                    .updatedAt(LocalDateTime.now())
                    .build());
            log.info("[SEEDER] Demo people added: {}", summary);
            return summary;
        });
    }

    private Summary seedOnce(LocalDateTime now) {
        Random random = new Random(2026_11_04L);
        String passwordHash = passwordEncoder.encode(DEMO_PASSWORD);
        Map<String, Role> roles = new HashMap<>();
        for (String name : List.of(A, M, U, V)) {
            roles.put(name, roleRepository.findByName(name).orElseThrow(() ->
                    new IllegalStateException("Role " + name + " is missing; DatabaseSeeder must run first")));
        }

        // Departments, matched by name.
        int departmentsCreated = 0;
        Map<String, Department> departments = new HashMap<>();
        for (Map.Entry<String, String> entry : DEPARTMENTS.entrySet()) {
            Department department = departmentRepository.findByNameIgnoreCase(entry.getKey()).orElse(null);
            if (department == null) {
                department = departmentRepository.save(
                        Department.builder().name(entry.getKey()).color(entry.getValue()).build());
                departmentsCreated++;
            }
            departments.put(entry.getKey(), department);
        }

        // People; existing emails are left as they are.
        int usersCreated = 0;
        Map<String, User> people = new LinkedHashMap<>();
        for (Person person : PEOPLE) {
            User existing = userRepository.findByEmailIgnoreCase(person.email()).orElse(null);
            if (existing != null) {
                people.put(person.email(), existing);
                continue;
            }
            LocalDateTime createdAt = now.minusDays(40 + random.nextInt(660)).withHour(9 + random.nextInt(8))
                    .withMinute(random.nextInt(60));
            LocalDateTime lastLogin = person.active()
                    ? workingTime(now.minusDays(random.nextInt(30)), random, now)
                    : now.minusDays(45 + random.nextInt(90)).withHour(10).withMinute(random.nextInt(60));
            LocalDateTime passwordChanged = createdAt.plusDays(random.nextInt(30));
            User user = userRepository.save(User.builder()
                    .fullName(person.name())
                    .email(person.email())
                    .phone(phone(random))
                    .title(person.title())
                    .password(passwordHash)
                    .status(person.active() ? User.STATUS_ACTIVE : User.STATUS_INACTIVE)
                    .department(departments.get(person.department()))
                    .roles(new HashSet<>(Set.of(roles.get(person.role()))))
                    .createdAt(createdAt)
                    .passwordChangedAt(passwordChanged.isAfter(now) ? createdAt : passwordChanged)
                    .lastLoginAt(lastLogin)
                    .build());
            people.put(person.email(), user);
            usersCreated++;
        }

        // Department managers, where the department has none yet.
        int managersAssigned = 0;
        for (Person person : PEOPLE) {
            if (!person.head()) continue;
            Department department = departments.get(person.department());
            User head = people.get(person.email());
            boolean eligible = head.isActive() && SystemRoles.isPrivileged(head.getPrimaryRoleName())
                    && head.getDepartment() != null && head.getDepartment().getId().equals(department.getId());
            if (department.getManager() == null && eligible) {
                department.setManager(head);
                departmentRepository.save(department);
                managersAssigned++;
            }
        }

        // Access requests; addresses that already have a request (or, for open ones, an account) are skipped.
        int requestsCreated = 0;
        String decider = PEOPLE.getFirst().email();
        Set<String> requested = new HashSet<>();
        accessRequestRepository.findAll().forEach(r -> requested.add(r.getEmail().toLowerCase(Locale.ROOT)));
        for (Request request : REQUESTS) {
            boolean pending = request.status() == AccessRequest.Status.PENDING;
            if (requested.contains(request.email())) continue;
            if (pending && userRepository.existsByEmailIgnoreCase(request.email())) continue;
            LocalDateTime createdAt = workingTime(now.minusDays(request.daysAgo()), random, now);
            User account = request.status() == AccessRequest.Status.APPROVED ? people.get(request.email()) : null;
            accessRequestRepository.save(AccessRequest.builder()
                    .fullName(request.name())
                    .email(request.email())
                    .phone(phone(random))
                    .department(departments.get(request.department()))
                    .passwordHash(pending ? passwordHash : null)
                    .status(request.status())
                    .createdAt(createdAt)
                    .decidedBy(pending ? null : decider)
                    .decidedAt(pending ? null : createdAt.plusHours(3 + random.nextInt(40)))
                    .note(request.note())
                    .userId(account != null ? account.getId() : null)
                    .build());
            requestsCreated++;
        }

        // History only comes with new people, so a re-run without the marker does not repeat it.
        int events = usersCreated > 0 ? seedAuditHistory(now, random, people, departments) : 0;
        return new Summary(true, departmentsCreated, usersCreated, managersAssigned, requestsCreated, events);
    }

    // ------------------------------------------------------------------ audit history

    private record Event(LocalDateTime at, String type, String actor, String description, Long userId, Long departmentId) {
    }

    /** About 300 events over the last 60 days, consistent with the people's last sign-in. */
    private int seedAuditHistory(LocalDateTime now, Random random, Map<String, User> people,
                                 Map<String, Department> departments) {
        List<Event> events = new ArrayList<>();
        List<User> users = new ArrayList<>(people.values());
        List<User> admins = users.stream().filter(u -> u.hasRole(A) && u.isActive()).toList();
        String adminActor = admins.isEmpty() ? "system" : admins.getFirst().getEmail();
        LocalDateTime start = now.minusDays(60);

        // Sign-ins: a few per person, the last one at their last_login_at.
        for (User user : users) {
            if (user.getLastLoginAt() == null) continue;
            LocalDateTime last = user.getLastLoginAt();
            events.add(login(user, last));
            int earlier = user.isActive() ? 1 + random.nextInt(4) : random.nextInt(2);
            for (int i = 0; i < earlier; i++) {
                long span = ChronoUnit.MINUTES.between(start, last);
                if (span <= 60) break;
                LocalDateTime at = workingTime(start.plusMinutes((long) (random.nextDouble() * span)), random, last);
                events.add(login(user, at));
                if (random.nextInt(3) == 0) {
                    events.add(new Event(at.plusHours(1 + random.nextInt(7)), "user_logout", user.getEmail(),
                            user.getEmail() + " signed out", null, null));
                }
            }
        }

        // Failed sign-ins (typos, mostly), a few from addresses that do not exist.
        for (int i = 0; i < 24; i++) {
            User user = users.get(random.nextInt(users.size()));
            String email = i % 6 == 5 ? "it-support@" + DOMAIN : user.getEmail();
            events.add(new Event(randomTime(start, now, random), "login_failed", email,
                    "Failed sign-in attempt for " + email, null, null));
        }

        // Department managers named early in the period.
        Set<Long> demoIds = new HashSet<>();
        users.forEach(u -> demoIds.add(u.getId()));
        for (Department department : departments.values()) {
            User manager = department.getManager();
            if (manager == null || !demoIds.contains(manager.getId())) continue;
            events.add(new Event(workingTime(start.plusDays(1 + random.nextInt(5)), random, now), "dept_manager_changed",
                    adminActor, manager.getFullName() + " is now the manager of " + department.getName(),
                    manager.getId(), department.getId()));
        }

        // Profile changes by admins and managers.
        String[][] changes = {
                {"title", "Junior Programmer", "Gameplay Programmer"},
                {"phone", "+40 721 000 111", "+40 722 410 385"},
                {"role", "VIEWER", "MEMBER"},
                {"title", "QA Tester", "Senior QA Analyst"},
                {"status", "Active", "Inactive"},
                {"department", "Development", "Engineering & Innovation"},
        };
        for (int i = 0; i < 32; i++) {
            User target = users.get(random.nextInt(users.size()));
            Department department = target.getDepartment();
            User manager = department != null ? department.getManager() : null;
            String actor = manager != null && random.nextBoolean() && !manager.getId().equals(target.getId())
                    ? manager.getEmail() : adminActor;
            String[] change = changes[random.nextInt(changes.length)];
            events.add(new Event(randomTime(start, now, random), "user_updated", actor,
                    "Updated " + target.getFullName() + ": " + change[0] + " " + change[1] + " → " + change[2],
                    target.getId(), department != null ? department.getId() : null));
        }

        // Accounts created in the period (the most recently created people).
        users.stream()
                .sorted(Comparator.comparing(User::getCreatedAt).reversed())
                .limit(8)
                .forEach(u -> events.add(new Event(randomTime(start, now.minusDays(2), random), "user_created",
                        adminActor, "Created user " + u.getFullName() + " (" + u.getEmail() + ") as "
                        + u.getPrimaryRoleName(), u.getId(), u.getDepartment() != null ? u.getDepartment().getId() : null)));

        // Department edits.
        for (int i = 0; i < 8; i++) {
            Department department = new ArrayList<>(departments.values()).get(random.nextInt(departments.size()));
            String actor = department.getManager() != null ? department.getManager().getEmail() : adminActor;
            events.add(new Event(randomTime(start, now, random), "dept_updated", actor,
                    "Department updated: " + department.getName(), null, department.getId()));
        }

        // Password changes and resets.
        for (int i = 0; i < 16; i++) {
            User user = users.get(random.nextInt(users.size()));
            boolean reset = i % 4 == 0;
            LocalDateTime at = randomTime(start, now, random);
            if (reset) {
                events.add(new Event(at, "password_reset_requested", user.getEmail(),
                        user.getEmail() + " requested a password reset", user.getId(), null));
                events.add(new Event(at.plusMinutes(4 + random.nextInt(20)), "password_reset_completed",
                        user.getEmail(), user.getEmail() + " reset their password", user.getId(), null));
            } else {
                events.add(new Event(at, "password_changed", user.getEmail(),
                        user.getEmail() + " changed their password", user.getId(), null));
            }
        }

        // Exports by the admins.
        for (int i = 0; i < 5; i++) {
            events.add(new Event(randomTime(start, now, random), "export_generated", adminActor,
                    i % 2 == 0 ? "Exported users (CSV)" : "Exported the audit log (CSV)", null, null));
        }

        // Access requests that arrived in the period.
        for (Request request : REQUESTS) {
            if (request.daysAgo() > 60) continue;
            Department department = departments.get(request.department());
            LocalDateTime at = workingTime(now.minusDays(request.daysAgo()), random, now);
            events.add(new Event(at, "access_requested", request.email(),
                    request.name() + " asked for access to " + department.getName(), null, department.getId()));
            if (request.status() == AccessRequest.Status.APPROVED) {
                User account = people.get(request.email());
                events.add(new Event(at.plusHours(5), "access_approved", adminActor,
                        "Approved access for " + request.name() + " (" + request.email() + ") as "
                                + (account != null ? account.getPrimaryRoleName() : V) + " in " + department.getName(),
                        account != null ? account.getId() : null, department.getId()));
            } else if (request.status() == AccessRequest.Status.REJECTED) {
                events.add(new Event(at.plusHours(5), "access_rejected", adminActor,
                        "Rejected access for " + request.name() + " (" + request.email() + "): " + request.note(),
                        null, department.getId()));
            }
        }

        List<Object[]> rows = events.stream()
                .filter(e -> e.at().isAfter(start) && e.at().isBefore(now))
                .sorted(Comparator.comparing(Event::at))
                .map(e -> new Object[]{e.type(), e.actor(), truncate(e.description()), Timestamp.valueOf(e.at()),
                        e.userId(), e.departmentId()})
                .toList();
        jdbcTemplate.batchUpdate("INSERT INTO audit_events (event_type, actor_email, description, created_at, "
                + "subject_user_id, subject_department_id) VALUES (?, ?, ?, ?, ?, ?)", rows);
        return rows.size();
    }

    private static Event login(User user, LocalDateTime at) {
        return new Event(at, "user_login", user.getEmail(), user.getFullName() + " signed in", user.getId(), null);
    }

    /** A time during office hours (Monday to Friday, 08:00 to 18:59) on or before the given day, not after {@code limit}. */
    private static LocalDateTime workingTime(LocalDateTime day, Random random, LocalDateTime limit) {
        LocalDateTime date = day;
        while (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY) {
            date = date.minusDays(1);
        }
        LocalDateTime at = date.withHour(8 + random.nextInt(11)).withMinute(random.nextInt(60))
                .withSecond(random.nextInt(60)).withNano(0);
        return at.isAfter(limit) ? limit.minusMinutes(5 + random.nextInt(55)) : at;
    }

    private static LocalDateTime randomTime(LocalDateTime from, LocalDateTime to, Random random) {
        long span = ChronoUnit.MINUTES.between(from, to);
        return workingTime(from.plusMinutes((long) (random.nextDouble() * span)), random, to);
    }

    private static String phone(Random random) {
        return String.format("+40 7%02d %03d %03d", 20 + random.nextInt(60), random.nextInt(1000), random.nextInt(1000));
    }

    private static String truncate(String value) {
        return value.length() <= 255 ? value : value.substring(0, 254) + "…";
    }
}
