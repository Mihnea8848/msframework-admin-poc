package com.msframework.backend.config;

import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.User;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DatabaseSeeder implements CommandLineRunner {

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    @Lazy
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        // Seed Departments if empty
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
            System.out.println("[SEEDER] Departments seeded successfully.");
        }

        // Seed Admin User if empty
        if (userRepository.count() == 0) {
            System.out.println("[SEEDER] Populating default admin...");

            User admin = User.builder()
                    .fullName("Admin User")
                    .email("admin@test.com")
                    .password(passwordEncoder.encode("password123"))
                    .role("ADMIN")
                    .status("Active")
                    .build();

            userRepository.save(admin);
            System.out.println("[SEEDER] Admin user seeded successfully.");
        }
    }
}