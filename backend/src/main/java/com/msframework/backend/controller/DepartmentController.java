package com.msframework.backend.controller;

import com.msframework.backend.dto.DepartmentResponse;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.User;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.config.Permission;
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
    private final UserRepository userRepository;
    private final AuditService auditService;

    private DepartmentResponse toResponse(Department dept) {
        long memberCount = userRepository.countByDepartmentId(dept.getId());
        return new DepartmentResponse(dept.getId(), dept.getName(), dept.getColor(), memberCount);
    }

    private User getCurrentUser(Principal principal) {
        if (principal == null) {
            return null;
        }

        return userRepository.findByEmail(principal.getName())
                .orElse(null);
    }

    private ResponseEntity<?> checkPermission(Principal principal, Permission permission) {
        User currentUser = getCurrentUser(principal);

        if (currentUser == null) {
            return ResponseEntity.status(401).body("Not authenticated");
        }

        if (!currentUser.hasPermission(permission)) {
            return ResponseEntity.status(403).body("Missing permission: " + permission);
        }

        return null;
    }

    @GetMapping
    public ResponseEntity<?> getAllDepartments() {
        List<DepartmentResponse> departments = departmentRepository.findAll()
                .stream()
                .sorted((a, b) -> Long.compare(a.getId(), b.getId()))
                .map(this::toResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(departments);
    }
    @PostMapping
    public ResponseEntity<?> createDepartment(@RequestBody Department request, Principal principal) {
        ResponseEntity<?> forbidden = checkPermission(principal, Permission.DEPARTMENT_CREATE);
        if (forbidden != null) {
            return forbidden;
        }

        Department saved = departmentRepository.save(
                Department.builder()
                        .name(request.getName())
                        .color(request.getColor())
                        .build()
        );

        auditService.log(
                "dept_created",
                principal.getName(),
                "Department created: " + saved.getName()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateDepartment(
            @PathVariable Long id,
            @RequestBody Department request,
            Principal principal
    ) {
        ResponseEntity<?> forbidden = checkPermission(principal, Permission.DEPARTMENT_UPDATE);
        if (forbidden != null) {
            return forbidden;
        }

        User currentUser = getCurrentUser(principal);

        if (currentUser == null) {
            return ResponseEntity.status(401).body("Not authenticated");
        }

        boolean currentUserIsAdmin = currentUser.hasRole("ADMIN");
        boolean currentUserIsManager = currentUser.hasRole("MANAGER");

        if (!currentUserIsAdmin && !currentUserIsManager) {
            return ResponseEntity.status(403).body("Only admins and managers can edit departments");
        }

        if (currentUserIsManager) {
            if (currentUser.getDepartment() == null) {
                return ResponseEntity.status(403).body("Manager has no assigned department");
            }

            if (!currentUser.getDepartment().getId().equals(id)) {
                return ResponseEntity.status(403).body("Managers can only edit their own department");
            }
        }

        return departmentRepository.findById(id)
                .map(existing -> {
                    existing.setName(request.getName());
                    existing.setColor(request.getColor());

                    Department updated = departmentRepository.save(existing);

                    auditService.log(
                            "dept_updated",
                            principal.getName(),
                            "Department updated: " + updated.getName()
                    );

                    return ResponseEntity.ok(toResponse(updated));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDepartment(@PathVariable Long id, Principal principal) {
        ResponseEntity<?> forbidden = checkPermission(principal, Permission.DEPARTMENT_DELETE);
        if (forbidden != null) {
            return forbidden;
        }

        User currentUser = getCurrentUser(principal);

        if (currentUser == null) {
            return ResponseEntity.status(401).body("Not authenticated");
        }

        if (!currentUser.hasRole("ADMIN")) {
            return ResponseEntity.status(403).body("Only admins can delete departments");
        }

        if (!departmentRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        auditService.log(
                "dept_deleted",
                principal.getName(),
                "Department deleted (id: " + id + ")"
        );

        departmentRepository.deleteById(id);

        return ResponseEntity.noContent().build();
    }
}