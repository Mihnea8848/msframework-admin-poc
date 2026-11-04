package com.msframework.backend.service;

import com.msframework.backend.config.Permission;
import com.msframework.backend.config.SystemRoles;
import com.msframework.backend.dto.CurrentUserDto;
import com.msframework.backend.dto.UserCreateRequest;
import com.msframework.backend.dto.UserDetailsDto;
import com.msframework.backend.dto.UserDto;
import com.msframework.backend.dto.UserPage;
import com.msframework.backend.dto.UserUpdateRequest;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.Role;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.PasswordResetTokenRepository;
import com.msframework.backend.repository.RoleRepository;
import com.msframework.backend.repository.UserRepository;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Nulls;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

import static com.msframework.backend.config.SystemRoles.ADMIN;
import static com.msframework.backend.config.SystemRoles.MANAGER;

@Service
@RequiredArgsConstructor
public class UserService {

    public static final List<String> STATUSES = List.of(User.STATUS_ACTIVE, User.STATUS_INACTIVE);

    public static final int MAX_PAGE_SIZE = 100;

    /** Sort keys accepted by {@link #search}; prefix with "-" for descending. */
    public static final List<String> SORT_KEYS =
            List.of("name", "email", "department", "status", "createdAt", "lastLoginAt");

    // Same rules as frontend/src/utils/validators.js
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
    private static final Pattern PHONE = Pattern.compile("^\\+?[0-9 ()-]{7,32}$");

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final RoleRepository roleRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final PasswordPolicy passwordPolicy;
    private final UserSessionService userSessionService;

    // ------------------------------------------------------------------ validation

    public static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    public static String requireValidEmail(String raw) {
        String email = normalizeEmail(raw);
        if (email.isEmpty()) throw ApiException.badRequest("Email is required");
        if (email.length() > 254 || !EMAIL.matcher(email).matches()) {
            throw ApiException.badRequest("Enter a valid email address");
        }
        return email;
    }

    public static String requireFullName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (name.isEmpty()) throw ApiException.badRequest("Full name is required");
        if (name.length() > 100) throw ApiException.badRequest("Full name must be at most 100 characters");
        return name;
    }

    /** Returns the trimmed phone number, or null when empty and not required. */
    public static String normalizePhone(String raw, boolean required) {
        String phone = raw == null ? "" : raw.trim();
        if (phone.isEmpty()) {
            if (required) throw ApiException.badRequest("Phone number is required");
            return null;
        }
        long digits = phone.chars().filter(c -> c >= '0' && c <= '9').count();
        if (!PHONE.matcher(phone).matches() || digits < 7) {
            throw ApiException.badRequest("Enter a valid phone number (at least 7 digits)");
        }
        return phone;
    }

    /** Returns the trimmed job title, or null when empty. */
    public static String normalizeTitle(String raw) {
        String title = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (title.isEmpty()) return null;
        if (title.length() > 100) throw ApiException.badRequest("Job title must be at most 100 characters");
        return title;
    }

    public static String requireStatus(String raw) {
        if (raw == null || raw.isBlank()) return User.STATUS_ACTIVE;
        return STATUSES.stream()
                .filter(s -> s.equalsIgnoreCase(raw.trim()))
                .findFirst()
                .orElseThrow(() -> ApiException.badRequest("Status must be Active or Inactive"));
    }

    public Role requireRole(String raw) {
        String name = raw == null || raw.isBlank() ? SystemRoles.MEMBER : raw.trim().toUpperCase(Locale.ROOT);
        return roleRepository.findByName(name)
                .orElseThrow(() -> ApiException.badRequest("Unknown role: " + name));
    }

    public Department findDepartment(Long id) {
        if (id == null) return null;
        return departmentRepository.findById(id)
                .orElseThrow(() -> ApiException.badRequest("Department not found"));
    }

    public boolean isEmailTaken(String email, Long exceptUserId) {
        return userRepository.findByEmailIgnoreCase(email)
                .filter(u -> !u.getId().equals(exceptUserId))
                .isPresent();
    }

    private void ensureEmailAvailable(String email, Long exceptUserId) {
        if (isEmailTaken(email, exceptUserId)) {
            throw ApiException.conflict("Email already in use");
        }
    }

    // ------------------------------------------------------------------ scope

    /** Whether the actor's role lets them edit the target (see {@link #requireCanEdit}). */
    public static boolean canEdit(User actor, User target) {
        try {
            requireCanEdit(actor, target);
            return true;
        } catch (ApiException e) {
            return false;
        }
    }

    /**
     * Admins may edit anyone. Managers may edit the MEMBER and VIEWER users of their own
     * department. Nobody else may edit other users.
     */
    public static void requireCanEdit(User actor, User target) {
        if (actor.hasRole(ADMIN)) return;
        if (!actor.hasRole(MANAGER)) {
            throw ApiException.forbidden("Only admins and managers can edit users");
        }
        if (target.hasRole(ADMIN) || target.hasRole(MANAGER)) {
            throw ApiException.forbidden("Managers cannot edit admins or other managers");
        }
        Long managerDeptId = actor.getDepartment() != null ? actor.getDepartment().getId() : null;
        if (managerDeptId == null) {
            throw ApiException.forbidden("You are not assigned to a department");
        }
        if (target.getDepartment() == null || !managerDeptId.equals(target.getDepartment().getId())) {
            throw ApiException.forbidden("Managers can only edit users in their own department");
        }
    }

    // ------------------------------------------------------------------ mapping

    public UserDto toDto(User user) {
        Long managerOf = departmentRepository.findByManagerId(user.getId()).stream()
                .map(Department::getId).findFirst().orElse(null);
        return toDto(user, managerOf);
    }

    /** Maps a list with a single extra query for the department heads. */
    public List<UserDto> toDtos(List<User> users) {
        Map<Long, Long> managerOf = new HashMap<>();
        for (Object[] row : departmentRepository.managerAssignments()) {
            managerOf.putIfAbsent((Long) row[0], (Long) row[1]);
        }
        return users.stream().map(u -> toDto(u, managerOf.get(u.getId()))).toList();
    }

    private static UserDto toDto(User user, Long managerOf) {
        return new UserDto(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getStatus(),
                user.getDepartment() != null ? user.getDepartment().getId() : null,
                user.getDepartment() != null ? user.getDepartment().getName() : null,
                roleNames(user),
                Times.toOffset(user.getCreatedAt()),
                user.getTitle(),
                Times.toOffset(user.getLastLoginAt()),
                managerOf
        );
    }

    public CurrentUserDto toCurrentUserDto(User user) {
        return new CurrentUserDto(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getStatus(),
                user.getDepartment() != null ? user.getDepartment().getId() : null,
                user.getDepartment() != null ? user.getDepartment().getName() : null,
                roleNames(user),
                new TreeSet<>(user.getAllPermissions())
        );
    }

    private static List<String> roleNames(User user) {
        return user.getRoles().stream().map(Role::getName).sorted().toList();
    }

    // ------------------------------------------------------------------ queries

    @Transactional(readOnly = true)
    public List<UserDto> list() {
        return toDtos(userRepository.findAllByOrderByIdAsc());
    }

    /**
     * Paged search. {@code q} matches name, email, job title and phone (case-insensitive); the
     * other filters are exact. Blank filters are ignored.
     */
    @Transactional(readOnly = true)
    public UserPage search(String q, String role, String status, Long departmentId, String sort, int page, int size) {
        int pageSize = Math.max(1, Math.min(size, MAX_PAGE_SIZE));
        int pageNumber = Math.max(0, page);
        String roleName = role == null || role.isBlank() ? null : requireRole(role).getName();
        String statusValue = status == null || status.isBlank() ? null : requireStatus(status);
        String sortKey = sort == null || sort.isBlank() ? "name" : sort.trim();
        boolean descending = sortKey.startsWith("-");
        String sortField = descending ? sortKey.substring(1) : sortKey;
        if (!SORT_KEYS.contains(sortField)) {
            throw ApiException.badRequest("Unknown sort \"" + sortKey + "\". Use one of "
                    + String.join(", ", SORT_KEYS) + ", with a leading \"-\" for descending.");
        }
        String pattern = q == null || q.isBlank() ? null : "%" + escapeLike(q.trim().toLowerCase(Locale.ROOT)) + "%";

        Specification<User> spec = (root, query, cb) -> {
            List<Predicate> where = new ArrayList<>();
            if (pattern != null) {
                where.add(cb.or(
                        cb.like(cb.lower(root.get("fullName")), pattern, '\\'),
                        cb.like(cb.lower(root.get("email")), pattern, '\\'),
                        cb.like(cb.lower(root.get("title")), pattern, '\\'),
                        cb.like(cb.lower(root.get("phone")), pattern, '\\')));
            }
            if (roleName != null) {
                Subquery<Long> withRole = query.subquery(Long.class);
                Root<User> other = withRole.from(User.class);
                withRole.select(other.get("id")).where(cb.equal(other.join("roles").get("name"), roleName));
                where.add(root.get("id").in(withRole));
            }
            if (statusValue != null) {
                where.add(cb.equal(cb.lower(root.get("status")), statusValue.toLowerCase(Locale.ROOT)));
            }
            if (departmentId != null) {
                where.add(cb.equal(root.get("department").get("id"), departmentId));
            }
            // Only the page query is sorted; Spring Data drops the ordering from the count query.
            if (query.getResultType() != Long.class && query.getResultType() != long.class) {
                Expression<?> key = switch (sortField) {
                    case "email" -> root.get("email");
                    case "department" -> cb.lower(root.join("department", JoinType.LEFT).get("name"));
                    case "status" -> root.get("status");
                    case "createdAt" -> root.get("createdAt");
                    case "lastLoginAt" -> root.get("lastLoginAt");
                    default -> cb.lower(root.get("fullName"));
                };
                Order primary = descending ? cb.desc(key, Nulls.LAST) : cb.asc(key, Nulls.LAST);
                query.orderBy(primary, cb.asc(root.get("id")));
            }
            return cb.and(where.toArray(Predicate[]::new));
        };

        Page<User> result = userRepository.findAll(spec, PageRequest.of(pageNumber, pageSize));
        return new UserPage(toDtos(result.getContent()), result.getTotalElements(), pageNumber, pageSize,
                result.getTotalPages());
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    @Transactional(readOnly = true)
    public UserDetailsDto details(Long id, User actor) {
        User user = userRepository.findById(id).orElseThrow(() -> ApiException.notFound("User not found"));
        Department department = user.getDepartment();
        User head = department != null ? department.getManager() : null;
        Department led = departmentRepository.findByManagerId(user.getId()).stream().findFirst().orElse(null);
        return new UserDetailsDto(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getTitle(),
                user.getStatus(),
                department != null ? department.getId() : null,
                department != null ? department.getName() : null,
                department != null ? department.getColor() : null,
                head != null ? head.getId() : null,
                head != null ? head.getFullName() : null,
                roleNames(user),
                new TreeSet<>(user.getAllPermissions()),
                led != null ? led.getId() : null,
                led != null ? led.getName() : null,
                Times.toOffset(user.getCreatedAt()),
                Times.toOffset(user.getLastLoginAt()),
                Times.toOffset(user.getPasswordChangedAt()),
                actor.hasPermission(Permission.USER_UPDATE) && canEdit(actor, user)
        );
    }

    // ------------------------------------------------------------------ commands

    @Transactional
    public UserDto create(UserCreateRequest request, User actor) {
        String fullName = requireFullName(request.fullName());
        String email = requireValidEmail(request.email());
        String phone = normalizePhone(request.phone(), false);
        String title = normalizeTitle(request.title());
        passwordPolicy.validate(request.password());
        Role role = requireRole(request.role());
        String status = requireStatus(request.status());
        Department department = findDepartment(request.departmentId());

        if (!actor.hasRole(ADMIN) && SystemRoles.isPrivileged(role.getName())) {
            throw ApiException.forbidden("Only admins can assign the ADMIN or MANAGER role");
        }
        ensureEmailAvailable(email, null);

        User saved = userRepository.save(User.builder()
                .fullName(fullName)
                .email(email)
                .phone(phone)
                .title(title)
                .password(passwordEncoder.encode(request.password()))
                .status(status)
                .department(department)
                .roles(new HashSet<>(Set.of(role)))
                .build());

        auditService.log("user_created", actor.getEmail(),
                "Created user " + fullName + " (" + email + ") as " + role.getName(),
                new AuditService.Subject(saved.getId(), department != null ? department.getId() : null));
        return toDto(saved);
    }

    /** The request that changes nothing: the user's current values, ready to have one field replaced. */
    public static UserUpdateRequest currentValues(User user) {
        return new UserUpdateRequest(user.getFullName(), user.getEmail(), null, user.getPrimaryRoleName(),
                user.getStatus(), user.getDepartment() != null ? user.getDepartment().getId() : null, null);
    }

    @Transactional
    public User update(Long id, UserUpdateRequest request, User actor) {
        User target = userRepository.findById(id).orElseThrow(() -> ApiException.notFound("User not found"));

        String fullName = requireFullName(request.fullName());
        String email = requireValidEmail(request.email());
        Role role = requireRole(request.role());
        String status = requireStatus(request.status());
        Department department = findDepartment(request.departmentId());
        String phone = request.phone() == null ? target.getPhone() : normalizePhone(request.phone(), false);
        String title = request.title() == null ? target.getTitle() : normalizeTitle(request.title());

        requireCanEdit(actor, target);
        if (!actor.hasRole(ADMIN)) {
            Long managerDeptId = actor.getDepartment().getId();
            if (SystemRoles.isPrivileged(role.getName())) {
                throw ApiException.forbidden("Managers cannot assign the ADMIN or MANAGER role");
            }
            if (department == null || !managerDeptId.equals(department.getId())) {
                throw ApiException.forbidden("Managers cannot move users out of their department");
            }
        }

        boolean isSelf = target.getId().equals(actor.getId());
        if (isSelf && !User.STATUS_ACTIVE.equals(status)) {
            throw ApiException.badRequest("You cannot deactivate your own account");
        }
        boolean losesAdmin = target.hasRole(ADMIN) && target.isActive()
                && (!ADMIN.equals(role.getName()) || !User.STATUS_ACTIVE.equals(status));
        if (losesAdmin && userRepository.countActiveWithRole(ADMIN) <= 1) {
            throw ApiException.conflict("At least one active admin is required");
        }
        ensureEmailAvailable(email, target.getId());

        boolean wasActive = target.isActive();
        String previousEmail = target.getEmail();
        List<String> changes = new ArrayList<>();
        diff(changes, "name", target.getFullName(), fullName);
        diff(changes, "email", target.getEmail(), email);
        diff(changes, "phone", target.getPhone(), phone);
        diff(changes, "title", target.getTitle(), title);
        diff(changes, "role", target.getPrimaryRoleName(), role.getName());
        diff(changes, "status", target.getStatus(), status);
        diff(changes, "department",
                target.getDepartment() != null ? target.getDepartment().getName() : "none",
                department != null ? department.getName() : "none");

        // A department head must stay an active MANAGER or ADMIN member of the department they lead.
        for (Department led : departmentRepository.findByManagerId(target.getId())) {
            boolean stillLeads = User.STATUS_ACTIVE.equals(status) && SystemRoles.isPrivileged(role.getName())
                    && department != null && department.getId().equals(led.getId());
            if (!stillLeads) {
                led.setManager(null);
                departmentRepository.save(led);
                changes.add("no longer manager of " + led.getName());
            }
        }

        Long previousDepartmentId = target.getDepartment() != null ? target.getDepartment().getId() : null;
        target.setFullName(fullName);
        target.setEmail(email);
        target.setPhone(phone);
        target.setTitle(title);
        target.setRoles(new HashSet<>(Set.of(role)));
        target.setStatus(status);
        target.setDepartment(department);
        User saved = userRepository.save(target);

        // A deactivated user is signed out everywhere at once (sessions are keyed by email).
        if (wasActive && !saved.isActive()) {
            userSessionService.revokeAll(previousEmail);
        }

        if (!changes.isEmpty()) {
            // Shown in the feed of the new department, or of the one the user left.
            Long subjectDepartment = department != null ? department.getId() : previousDepartmentId;
            auditService.log("user_updated", actor.getEmail(),
                    "Updated " + fullName + ": " + String.join(", ", changes),
                    new AuditService.Subject(saved.getId(), subjectDepartment));
        }
        return saved;
    }

    @Transactional
    public void delete(Long id, User actor) {
        User target = userRepository.findById(id).orElseThrow(() -> ApiException.notFound("User not found"));

        if (target.getId().equals(actor.getId())) {
            throw ApiException.badRequest("You cannot delete your own account");
        }
        if (!actor.hasRole(ADMIN) && (target.hasRole(ADMIN) || target.hasRole(MANAGER))) {
            throw ApiException.forbidden("Only admins can delete admins or managers");
        }
        if (target.hasRole(ADMIN) && target.isActive() && userRepository.countActiveWithRole(ADMIN) <= 1) {
            throw ApiException.conflict("At least one active admin is required");
        }

        for (Department led : departmentRepository.findByManagerId(target.getId())) {
            led.setManager(null);
            departmentRepository.save(led);
        }
        resetTokenRepository.deleteByUserId(target.getId());
        userRepository.delete(target);
        userSessionService.revokeAll(target.getEmail());
        auditService.log("user_deleted", actor.getEmail(),
                "Deleted user " + target.getFullName() + " (" + target.getEmail() + ")",
                new AuditService.Subject(target.getId(),
                        target.getDepartment() != null ? target.getDepartment().getId() : null));
    }

    /** Changes the signed-in user's own email. Returns the new (normalized) email. */
    @Transactional
    public String changeOwnEmail(User user, String newEmailRaw, String currentPassword) {
        String newEmail = requireValidEmail(newEmailRaw);
        requireCurrentPassword(user, currentPassword);
        if (newEmail.equalsIgnoreCase(user.getEmail())) {
            throw ApiException.badRequest("That is already your email address");
        }
        ensureEmailAvailable(newEmail, user.getId());

        String oldEmail = user.getEmail();
        user.setEmail(newEmail);
        userRepository.save(user);
        auditService.log("email_changed", newEmail, oldEmail + " changed email to " + newEmail,
                AuditService.Subject.user(user.getId()));
        return newEmail;
    }

    @Transactional
    public void changeOwnPassword(User user, String currentPassword, String newPassword) {
        requireCurrentPassword(user, currentPassword);
        passwordPolicy.validate(newPassword);
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw ApiException.badRequest("The new password must be different from the current one");
        }
        setPassword(user, newPassword);
        auditService.log("password_changed", user.getEmail(), user.getEmail() + " changed their password",
                AuditService.Subject.user(user.getId()));
    }

    /** Hashes and stores a new password (caller has validated it). */
    public void setPassword(User user, String rawPassword) {
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setPasswordChangedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    private void requireCurrentPassword(User user, String currentPassword) {
        if (currentPassword == null || currentPassword.isEmpty()
                || user.getPassword() == null
                || !passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw ApiException.badRequest("Current password is incorrect");
        }
    }

    private static void diff(List<String> changes, String field, String before, String after) {
        if (!Objects.equals(before, after)) {
            changes.add(field + " " + (before == null ? "—" : before) + " → " + (after == null ? "—" : after));
        }
    }
}
