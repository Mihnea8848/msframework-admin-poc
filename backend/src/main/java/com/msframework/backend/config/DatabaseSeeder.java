package com.msframework.backend.config;

import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.Role;
import com.msframework.backend.entity.ServiceConnection;
import com.msframework.backend.entity.User;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.RoleRepository;
import com.msframework.backend.repository.ServiceConnectionRepository;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Brings any database (fresh or from an older version of the app) to a consistent state on start-up.
 * Every step is idempotent.
 */
@Component
@RequiredArgsConstructor
public class DatabaseSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseSeeder.class);

    private static final List<String> DEFAULT_DEPARTMENTS = List.of(
            "Administration", "Development", "Quality Control", "External Affairs",
            "Ethics & Regulations", "Human Resources", "Engineering & Innovation"
    );

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final ServiceConnectionRepository serviceConnectionRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    @Value("${app.seed.admin-email:admin@test.com}")
    private String adminEmail;

    @Value("${app.seed.admin-password:password123}")
    private String adminPassword;

    @Override
    @Transactional
    public void run(String... args) {
        Map<String, Role> roles = syncRoles();
        seedDepartments();
        repairUsers(roles);
        seedAdmin(roles.get(SystemRoles.ADMIN));
        seedConnections();
    }

    /** Creates missing built-in roles and resets their permissions to {@link SystemRoles#DEFINITIONS}. */
    private Map<String, Role> syncRoles() {
        Map<String, Role> result = new HashMap<>();
        SystemRoles.DEFINITIONS.forEach((name, permissions) -> {
            Role role = roleRepository.findByName(name)
                    .orElseGet(() -> Role.builder().name(name).build());
            if (role.getId() == null || !permissions.equals(toEnumSet(role.getPermissions()))) {
                role.setPermissions(new HashSet<>(permissions));
                role = roleRepository.save(role);
                log.info("[SEEDER] Role {} synced ({} permissions)", name, permissions.size());
            }
            result.put(name, role);
        });
        return result;
    }

    private void seedDepartments() {
        if (departmentRepository.count() == 0) {
            log.info("[SEEDER] Populating departments...");
            departmentRepository.saveAll(DEFAULT_DEPARTMENTS.stream()
                    .map(name -> Department.builder().name(name).build())
                    .toList());
        }
    }

    /**
     * Fixes users created by older versions: a missing status becomes Active, and users without any
     * role get the role from the legacy {@code users.role} column (pre-RBAC schema) or MEMBER.
     */
    private void repairUsers(Map<String, Role> roles) {
        Map<Long, String> legacyRoles = null;

        for (User user : userRepository.findAll()) {
            boolean changed = false;
            if (user.getStatus() == null || user.getStatus().isBlank()) {
                user.setStatus(User.STATUS_ACTIVE);
                changed = true;
            }
            if (user.getRoles().isEmpty()) {
                if (legacyRoles == null) legacyRoles = readLegacyRoles();
                String legacy = legacyRoles.getOrDefault(user.getId(), "");
                Role role = roles.getOrDefault(legacy.toUpperCase(Locale.ROOT), roles.get(SystemRoles.MEMBER));
                user.setRoles(new HashSet<>(Set.of(role)));
                log.info("[SEEDER] Assigned role {} to {} (user had no role)", role.getName(), user.getEmail());
                changed = true;
            }
            if (user.getCreatedAt() == null) {
                user.setCreatedAt(LocalDateTime.now());
                changed = true;
            }
            if (changed) userRepository.save(user);
        }
    }

    private Map<Long, String> readLegacyRoles() {
        Map<Long, String> legacy = new HashMap<>();
        // Check first instead of catching a failed query: on PostgreSQL a failed statement would
        // abort the surrounding transaction.
        Integer hasColumn = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE LOWER(table_name) = 'users' AND LOWER(column_name) = 'role'",
                Integer.class);
        if (hasColumn == null || hasColumn == 0) {
            return legacy; // database created after the RBAC change
        }
        try {
            jdbcTemplate.query("SELECT id, role FROM users WHERE role IS NOT NULL",
                    rs -> { legacy.put(rs.getLong("id"), rs.getString("role")); });
        } catch (DataAccessException e) {
            log.warn("[SEEDER] Could not read legacy roles: {}", e.getMessage());
        }
        return legacy;
    }

    private void seedAdmin(Role adminRole) {
        if (userRepository.count() == 0) {
            log.info("[SEEDER] Creating default admin {}", adminEmail);
            userRepository.save(User.builder()
                    .fullName("Admin User")
                    .email(adminEmail.trim().toLowerCase(Locale.ROOT))
                    .password(passwordEncoder.encode(adminPassword))
                    .roles(new HashSet<>(Set.of(adminRole)))
                    .status(User.STATUS_ACTIVE)
                    .build());
        }
    }

    /** Ensures every known integration has a row (fresh databases get a few connected for the demo). */
    private void seedConnections() {
        boolean fresh = serviceConnectionRepository.count() == 0;
        LocalDateTime now = LocalDateTime.now();
        for (String id : Integrations.SERVICE_IDS) {
            if (serviceConnectionRepository.existsById(id)) continue;
            boolean connected = fresh && Integrations.CONNECTED_BY_DEFAULT.contains(id);
            serviceConnectionRepository.save(ServiceConnection.builder()
                    .serviceId(id)
                    .connected(connected)
                    .enabled(connected)
                    .connectedAt(connected ? now : null)
                    .build());
        }
    }

    private static EnumSet<Permission> toEnumSet(Set<Permission> permissions) {
        EnumSet<Permission> set = EnumSet.noneOf(Permission.class);
        set.addAll(permissions);
        return set;
    }
}
