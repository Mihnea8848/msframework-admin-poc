package com.msframework.backend.config;

import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.ServiceConnection;
import com.msframework.backend.entity.User;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.ServiceConnectionRepository;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
public class DatabaseSeeder implements CommandLineRunner {

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final ServiceConnectionRepository serviceConnectionRepository;
    @Lazy
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
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
            userRepository.save(User.builder()
                    .fullName("Admin User")
                    .email("admin@test.com")
                    .password(passwordEncoder.encode("password123"))
                    .role("ADMIN")
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
