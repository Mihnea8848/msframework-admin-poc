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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.core.annotation.Order;
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
 * Seeds reference data on start-up, after the Flyway migrations: syncs the built-in role
 * permissions and creates the departments, the first admin and the integrations when missing.
 * Every step is idempotent. Legacy data repairs live in the migrations (V2).
 */
@Component
@Order(DatabaseSeeder.ORDER)
@RequiredArgsConstructor
public class DatabaseSeeder implements CommandLineRunner {

    /** Runs first; the demo seeders (DemoPeopleSeeder, ...) use larger orders so they run after it. */
    public static final int ORDER = 0;

    private static final Logger log = LoggerFactory.getLogger(DatabaseSeeder.class);

    /**
     * The studio departments, each with the colour key of its seal (the frontend maps the key
     * to the seal in ui/seal/seals.ts).
     */
    private static final List<Map.Entry<String, String>> DEFAULT_DEPARTMENTS = List.of(
            Map.entry("Administration", "avatar-rose"),
            Map.entry("Development", "avatar-violet"),
            Map.entry("Quality Control", "avatar-azure"),
            Map.entry("External Affairs", "avatar-jade"),
            Map.entry("Ethics & Regulations", "avatar-silver"),
            Map.entry("Human Resources", "avatar-orange"),
            Map.entry("Engineering & Innovation", "avatar-snow")
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
        // Instances starting at the same time take turns; the lock ends with the transaction.
        jdbcTemplate.queryForList("SELECT pg_advisory_xact_lock(hashtext('msf-seeder'))");
        Map<String, Role> roles = syncRoles();
        seedDepartments();
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
                    .map(d -> Department.builder().name(d.getKey()).color(d.getValue()).build())
                    .toList());
        }
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
