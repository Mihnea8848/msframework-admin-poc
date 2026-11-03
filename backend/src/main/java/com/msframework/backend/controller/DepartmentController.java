package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.config.SystemRoles;
import com.msframework.backend.dto.DepartmentRequest;
import com.msframework.backend.dto.DepartmentResponse;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.DepartmentRules;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/departments")
@RequiredArgsConstructor
public class DepartmentController {

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;

    /** Public: the registration form needs the list of departments. */
    @GetMapping
    public List<DepartmentResponse> list() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : userRepository.countMembersPerDepartment()) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return departmentRepository.findAllByOrderByIdAsc().stream()
                .map(d -> new DepartmentResponse(d.getId(), d.getName(), d.getColor(), counts.getOrDefault(d.getId(), 0L)))
                .toList();
    }

    @PostMapping
    public ResponseEntity<DepartmentResponse> create(@RequestBody DepartmentRequest request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.DEPARTMENT_CREATE);
        String name = DepartmentRules.requireName(request.name());
        String color = DepartmentRules.normalizeColor(request.color());
        ensureNameAvailable(name, null);

        Department saved = departmentRepository.save(Department.builder().name(name).color(color).build());
        auditService.log("dept_created", actor.getEmail(), "Department created: " + saved.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @PutMapping("/{id}")
    public DepartmentResponse update(@PathVariable Long id, @RequestBody DepartmentRequest request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.DEPARTMENT_UPDATE);
        Department existing = departmentRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Department not found"));

        // Admins can edit any department; everyone else (managers) only their own.
        if (!actor.hasRole(SystemRoles.ADMIN)) {
            if (actor.getDepartment() == null) {
                throw ApiException.forbidden("You are not assigned to a department");
            }
            if (!actor.getDepartment().getId().equals(id)) {
                throw ApiException.forbidden("Managers can only edit their own department");
            }
        }

        String name = DepartmentRules.requireName(request.name());
        String color = DepartmentRules.normalizeColor(request.color());
        ensureNameAvailable(name, id);

        String oldName = existing.getName();
        existing.setName(name);
        existing.setColor(color);
        Department updated = departmentRepository.save(existing);

        auditService.log("dept_updated", actor.getEmail(), oldName.equals(name)
                ? "Department updated: " + name
                : "Department renamed: " + oldName + " → " + name);
        return toResponse(updated);
    }

    /** Members of the deleted department are kept and simply become unassigned. */
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.DEPARTMENT_DELETE);
        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Department not found"));

        int unassigned = userRepository.unassignDepartment(id);
        departmentRepository.deleteById(id);

        auditService.log("dept_deleted", actor.getEmail(), "Department deleted: " + department.getName()
                + (unassigned > 0 ? " (" + unassigned + " member(s) unassigned)" : ""));
        return ResponseEntity.noContent().build();
    }

    private void ensureNameAvailable(String name, Long exceptId) {
        departmentRepository.findByNameIgnoreCase(name)
                .filter(d -> !d.getId().equals(exceptId))
                .ifPresent(d -> {
                    throw ApiException.conflict("A department named \"" + d.getName() + "\" already exists");
                });
    }

    private DepartmentResponse toResponse(Department department) {
        return new DepartmentResponse(department.getId(), department.getName(), department.getColor(),
                userRepository.countByDepartmentId(department.getId()));
    }
}
