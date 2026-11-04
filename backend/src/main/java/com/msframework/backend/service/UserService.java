package com.msframework.backend.service;

import com.msframework.backend.config.SystemRoles;
import com.msframework.backend.dto.CurrentUserDto;
import com.msframework.backend.dto.RegisterRequest;
import com.msframework.backend.dto.UserCreateRequest;
import com.msframework.backend.dto.UserDto;
import com.msframework.backend.dto.UserUpdateRequest;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.Role;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.PasswordResetTokenRepository;
import com.msframework.backend.repository.RoleRepository;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
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

    private Department findDepartment(Long id) {
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

    // ------------------------------------------------------------------ mapping

    public UserDto toDto(User user) {
        return new UserDto(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getStatus(),
                user.getDepartment() != null ? user.getDepartment().getId() : null,
                user.getDepartment() != null ? user.getDepartment().getName() : null,
                roleNames(user),
                Times.toOffset(user.getCreatedAt())
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
        return userRepository.findAllByOrderByIdAsc().stream().map(this::toDto).toList();
    }

    // ------------------------------------------------------------------ commands

    @Transactional
    public User register(RegisterRequest request) {
        String fullName = requireFullName(request.fullName());
        String email = requireValidEmail(request.email());
        String phone = normalizePhone(request.phone(), true);
        passwordPolicy.validate(request.password());
        Department department = findDepartment(request.departmentId());
        ensureEmailAvailable(email, null);

        User saved = userRepository.save(User.builder()
                .fullName(fullName)
                .email(email)
                .phone(phone)
                .password(passwordEncoder.encode(request.password()))
                .status(User.STATUS_ACTIVE)
                .department(department)
                .roles(new HashSet<>(Set.of(requireRole(SystemRoles.MEMBER))))
                .build());

        auditService.log("user_created", email, fullName + " registered");
        return saved;
    }

    @Transactional
    public UserDto create(UserCreateRequest request, User actor) {
        String fullName = requireFullName(request.fullName());
        String email = requireValidEmail(request.email());
        String phone = normalizePhone(request.phone(), false);
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
                .password(passwordEncoder.encode(request.password()))
                .status(status)
                .department(department)
                .roles(new HashSet<>(Set.of(role)))
                .build());

        auditService.log("user_created", actor.getEmail(),
                "Created user " + fullName + " (" + email + ") as " + role.getName());
        return toDto(saved);
    }

    @Transactional
    public User update(Long id, UserUpdateRequest request, User actor) {
        User target = userRepository.findById(id).orElseThrow(() -> ApiException.notFound("User not found"));

        boolean actorIsAdmin = actor.hasRole(ADMIN);
        boolean actorIsManager = !actorIsAdmin && actor.hasRole(MANAGER);
        if (!actorIsAdmin && !actorIsManager) {
            throw ApiException.forbidden("Only admins and managers can edit users");
        }

        String fullName = requireFullName(request.fullName());
        String email = requireValidEmail(request.email());
        Role role = requireRole(request.role());
        String status = requireStatus(request.status());
        Department department = findDepartment(request.departmentId());
        String phone = request.phone() == null ? target.getPhone() : normalizePhone(request.phone(), false);

        if (actorIsManager) {
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
        diff(changes, "role", target.getPrimaryRoleName(), role.getName());
        diff(changes, "status", target.getStatus(), status);
        diff(changes, "department",
                target.getDepartment() != null ? target.getDepartment().getName() : "none",
                department != null ? department.getName() : "none");

        target.setFullName(fullName);
        target.setEmail(email);
        target.setPhone(phone);
        target.setRoles(new HashSet<>(Set.of(role)));
        target.setStatus(status);
        target.setDepartment(department);
        User saved = userRepository.save(target);

        // A deactivated user is signed out everywhere at once (sessions are keyed by email).
        if (wasActive && !saved.isActive()) {
            userSessionService.revokeAll(previousEmail);
        }

        if (!changes.isEmpty()) {
            auditService.log("user_updated", actor.getEmail(),
                    "Updated " + fullName + ": " + String.join(", ", changes));
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

        resetTokenRepository.deleteByUserId(target.getId());
        userRepository.delete(target);
        userSessionService.revokeAll(target.getEmail());
        auditService.log("user_deleted", actor.getEmail(),
                "Deleted user " + target.getFullName() + " (" + target.getEmail() + ")");
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
        auditService.log("email_changed", newEmail, oldEmail + " changed email to " + newEmail);
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
        auditService.log("password_changed", user.getEmail(), user.getEmail() + " changed their password");
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
