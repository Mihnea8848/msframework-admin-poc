package com.msframework.backend.controller;

import com.msframework.backend.dto.DepartmentResponse;
import com.msframework.backend.entity.Department;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/departments")
@RequiredArgsConstructor
public class DepartmentController {

    private final DepartmentRepository departmentRepository;
    private final AuditService auditService;

    private DepartmentResponse toResponse(Department dept) {
        long memberCount = dept.getUsers() == null ? 0 : dept.getUsers().size();
        return new DepartmentResponse(dept.getId(), dept.getName(), dept.getColor(), memberCount);
    }

    @GetMapping
    public ResponseEntity<List<DepartmentResponse>> getAllDepartments() {
        return ResponseEntity.ok(departmentRepository.findAll().stream()
                .map(this::toResponse).collect(Collectors.toList()));
    }

    @PostMapping
    public ResponseEntity<DepartmentResponse> createDepartment(@RequestBody Department request, Principal principal) {
        Department saved = departmentRepository.save(
                Department.builder().name(request.getName()).color(request.getColor()).build()
        );
        String actor = principal != null ? principal.getName() : "system";
        auditService.log("dept_created", actor, "Department created: " + saved.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<DepartmentResponse> updateDepartment(@PathVariable Long id,
                                                               @RequestBody Department request,
                                                               Principal principal) {
        return departmentRepository.findById(id).map(existing -> {
            existing.setName(request.getName());
            existing.setColor(request.getColor());
            Department updated = departmentRepository.save(existing);
            String actor = principal != null ? principal.getName() : "system";
            auditService.log("dept_updated", actor, "Department updated: " + updated.getName());
            return ResponseEntity.ok(toResponse(updated));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDepartment(@PathVariable Long id, Principal principal) {
        if (!departmentRepository.existsById(id)) return ResponseEntity.notFound().build();
        String actor = principal != null ? principal.getName() : "system";
        auditService.log("dept_deleted", actor, "Department deleted (id: " + id + ")");
        departmentRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
