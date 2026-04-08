package com.msframework.backend.controller;

import com.msframework.backend.dto.DepartmentResponse;
import com.msframework.backend.entity.Department;
import com.msframework.backend.repository.DepartmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/departments")
@RequiredArgsConstructor
public class DepartmentController {

    private final DepartmentRepository departmentRepository;

    @GetMapping
    public ResponseEntity<List<DepartmentResponse>> getAllDepartments() {
        List<DepartmentResponse> departments = departmentRepository.findAll()
                .stream()
                .map(dept -> new DepartmentResponse(dept.getId(), dept.getName()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(departments);
    }

    @PostMapping
    public ResponseEntity<DepartmentResponse> createDepartment(@RequestBody Department request) {
        Department savedDepartment = departmentRepository.save(
                Department.builder().name(request.getName()).build()
        );
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new DepartmentResponse(savedDepartment.getId(), savedDepartment.getName()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<DepartmentResponse> updateDepartment(@PathVariable Long id, @RequestBody Department request) {
        return departmentRepository.findById(id)
                .map(existing -> {
                    existing.setName(request.getName());
                    Department updated = departmentRepository.save(existing);
                    return ResponseEntity.ok(new DepartmentResponse(updated.getId(), updated.getName()));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDepartment(@PathVariable Long id) {
        if (departmentRepository.existsById(id)) {
            departmentRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}