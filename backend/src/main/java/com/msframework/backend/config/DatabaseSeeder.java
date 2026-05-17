package com.msframework.backend.config;

import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.ServiceConnection;
import com.msframework.backend.entity.User;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.RoleRepository;
import com.msframework.backend.repository.ServiceConnectionRepository;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.entity.Role;
import com.msframework.backend.config.Permission;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class DatabaseSeeder implements CommandLineRunner {

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final ServiceConnectionRepository serviceConnectionRepository;
    @Lazy
    private final PasswordEncoder passwordEncoder;

    private final RoleRepository roleRepository;

    private void createRoleIfMissing(String name, Set<Permission> permissions) {
        roleRepository.findByName(name).orElseGet(() -> {
            Role role = Role.builder()
                    .name(name)
                    .permissions(permissions)
                    .build();

            return roleRepository.save(role);
        });
    }

    @Override
    public void run(String... args) {
        createRoleIfMissing("ADMIN", Set.of(Permission.values()));

        createRoleIfMissing("MANAGER", Set.of(
                Permission.DASHBOARD_READ,
                Permission.USER_READ,
                Permission.USER_UPDATE,
                Permission.DEPARTMENT_READ,
                Permission.DEPARTMENT_CREATE,
                Permission.DEPARTMENT_UPDATE,
                Permission.AUDIT_READ,
                Permission.DOCUMENTATION_READ
        ));

        createRoleIfMissing("MEMBER", Set.of(
                Permission.DASHBOARD_READ,
                Permission.USER_READ,
                Permission.DEPARTMENT_READ,
                Permission.DOCUMENTATION_READ,
                Permission.TIMEZONES_READ
        ));

        createRoleIfMissing("VIEWER", Set.of(
                Permission.DASHBOARD_READ,
                Permission.DOCUMENTATION_READ
        ));
        if (departmentRepository.count() == 0) {
            System.out.println("[SEEDER] Populating departments...");
            departmentRepository.saveAll(List.of(
                    Department.builder().name("Administration").build(),
                    Department.builder().name("Development").build(),
                    Department.builder().name("Quality Control").build(),
                    Department.builder().name("External Affairs").build(),
                    Department.builder().name("Ethics & Regulations").build(),
                    Department.builder().name("Human Resources").build(),
                    Department.builder().name("Engineering & Innovation").build()
            ));
        }

        if (userRepository.count() == 0) {
            System.out.println("[SEEDER] Populating default admin...");
            Role adminRole = roleRepository.findByName("ADMIN")
                    .orElseThrow(() -> new RuntimeException("ADMIN role not found"));
            userRepository.save(User.builder()
                    .fullName("Admin User")
                    .email("admin@test.com")
                    .password(passwordEncoder.encode("password123"))
                    .roles(new HashSet<>(Set.of(adminRole)))
                    .status("Active")
                    .build());
        }

        if (serviceConnectionRepository.count() == 0) {
            System.out.println("[SEEDER] Populating service connections...");
            LocalDateTime now = LocalDateTime.now();
            serviceConnectionRepository.saveAll(List.of(
                    ServiceConnection.builder().serviceId("slack")     .connected(true) .enabled(true) .connectedAt(now).build(),
                    ServiceConnection.builder().serviceId("github")    .connected(true) .enabled(true) .connectedAt(now).build(),
                    ServiceConnection.builder().serviceId("google")    .connected(true) .enabled(true) .connectedAt(now).build(),
                    ServiceConnection.builder().serviceId("stripe")    .connected(true) .enabled(true) .connectedAt(now).build(),
                    ServiceConnection.builder().serviceId("jira")      .connected(false).enabled(false).build(),
                    ServiceConnection.builder().serviceId("aws")       .connected(false).enabled(false).build(),
                    ServiceConnection.builder().serviceId("zapier")    .connected(false).enabled(false).build(),
                    ServiceConnection.builder().serviceId("sendgrid")  .connected(false).enabled(false).build(),
                    ServiceConnection.builder().serviceId("datadog")   .connected(false).enabled(false).build(),
                    ServiceConnection.builder().serviceId("pagerduty") .connected(false).enabled(false).build(),
                    ServiceConnection.builder().serviceId("twilio")    .connected(false).enabled(false).build(),
                    ServiceConnection.builder().serviceId("notion")    .connected(false).enabled(false).build()
            ));
        }
    }
}
