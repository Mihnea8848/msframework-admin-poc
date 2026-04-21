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

    private DepartmentResponse toResponse(Department dept) {
        long memberCount = dept.getUsers() == null ? 0 : dept.getUsers().size();
        return new DepartmentResponse(dept.getId(), dept.getName(), dept.getColor(), memberCount);
    }

    @GetMapping
    public ResponseEntity<List<DepartmentResponse>> getAllDepartments() {
        List<DepartmentResponse> departments = departmentRepository.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(departments);
    }

    @PostMapping
    public ResponseEntity<DepartmentResponse> createDepartment(@RequestBody Department request) {
        Department saved = departmentRepository.save(
                Department.builder()
                        .name(request.getName())
                        .color(request.getColor())
                        .build()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<DepartmentResponse> updateDepartment(@PathVariable Long id, @RequestBody Department request) {
        return departmentRepository.findById(id)
                .map(existing -> {
                    existing.setName(request.getName());
                    existing.setColor(request.getColor());
                    Department updated = departmentRepository.save(existing);
                    return ResponseEntity.ok(toResponse(updated));
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