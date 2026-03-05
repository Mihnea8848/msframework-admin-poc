package com.msframework.backend.config;

import com.msframework.backend.entity.Department;
import com.msframework.backend.repository.DepartmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DatabaseSeeder implements CommandLineRunner {

    private final DepartmentRepository departmentRepository;

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
            System.out.println("[SEEDER] Departments seeded successfully.");
        }
    }
}