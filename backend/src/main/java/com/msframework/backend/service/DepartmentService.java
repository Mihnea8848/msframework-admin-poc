package com.msframework.backend.service;

import com.msframework.backend.config.SystemRoles;
import com.msframework.backend.dto.DepartmentDetailsDto;
import com.msframework.backend.dto.DepartmentRequest;
import com.msframework.backend.dto.DepartmentResponse;
import com.msframework.backend.dto.UserDto;
import com.msframework.backend.dto.UserUpdateRequest;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Departments, their heads and their members. Member changes go through {@link UserService#update},
 * so the manager scope rules are the same as on the user pages.
 */
@Service
@RequiredArgsConstructor
public class DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final AuditService auditService;

    // ------------------------------------------------------------------ queries

    /** All departments with member counts; the manager is left out for anonymous callers (the register form). */
    @Transactional(readOnly = true)
    public List<DepartmentResponse> list(boolean includeManager) {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : userRepository.countMembersPerDepartment()) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return departmentRepository.findAllWithManager().stream()
                .map(d -> toResponse(d, counts.getOrDefault(d.getId(), 0L), includeManager))
                .toList();
    }

    @Transactional(readOnly = true)
    public DepartmentDetailsDto details(Long id) {
        Department department = require(id);
        List<User> members = userRepository.findByDepartmentIdOrderByFullNameAscIdAsc(id);
        List<UserDto> memberDtos = userService.toDtos(members);
        User manager = department.getManager();
        return new DepartmentDetailsDto(
                department.getId(),
                department.getName(),
                department.getColor(),
                members.size(),
                members.stream().filter(User::isActive).count(),
                manager != null ? manager.getId() : null,
                manager != null ? manager.getFullName() : null,
                memberDtos);
    }

    @Transactional(readOnly = true)
    public DepartmentResponse response(Long id) {
        Department department = require(id);
        return toResponse(department, userRepository.countByDepartmentId(id), true);
    }

    // ------------------------------------------------------------------ commands

    @Transactional
    public DepartmentResponse create(DepartmentRequest request, User actor) {
        String name = DepartmentRules.requireName(request.name());
        String color = DepartmentRules.normalizeColor(request.color());
        ensureNameAvailable(name, null);

        Department saved = departmentRepository.save(Department.builder().name(name).color(color).build());
        auditService.log("dept_created", actor.getEmail(), "Department created: " + saved.getName(),
                AuditService.Subject.department(saved.getId()));
        return toResponse(saved, 0, true);
    }

    @Transactional
    public DepartmentResponse update(Long id, DepartmentRequest request, User actor) {
        Department existing = require(id);
        requireOwnDepartmentUnlessAdmin(actor, id);

        String name = DepartmentRules.requireName(request.name());
        String color = DepartmentRules.normalizeColor(request.color());
        ensureNameAvailable(name, id);

        String oldName = existing.getName();
        existing.setName(name);
        existing.setColor(color);
        Department updated = departmentRepository.save(existing);

        auditService.log("dept_updated", actor.getEmail(), oldName.equals(name)
                        ? "Department updated: " + name
                        : "Department renamed: " + oldName + " → " + name,
                AuditService.Subject.department(id));
        return toResponse(updated, userRepository.countByDepartmentId(id), true);
    }

    /** Members of the deleted department are kept and simply become unassigned. */
    @Transactional
    public void delete(Long id, User actor) {
        Department department = require(id);
        int unassigned = userRepository.unassignDepartment(id);
        departmentRepository.deleteById(id);

        auditService.log("dept_deleted", actor.getEmail(), "Department deleted: " + department.getName()
                        + (unassigned > 0 ? " (" + unassigned + " member(s) unassigned)" : ""),
                AuditService.Subject.department(id));
    }

    /**
     * Sets or clears the head of a department. Only admins may do this; the head must be an active
     * member of the department with the MANAGER or ADMIN role.
     */
    @Transactional
    public DepartmentResponse setManager(Long id, Long userId, User actor) {
        if (!actor.hasRole(SystemRoles.ADMIN)) {
            throw ApiException.forbidden("Only admins can choose a department's manager");
        }
        Department department = require(id);
        User previous = department.getManager();

        User manager = null;
        if (userId != null) {
            manager = userRepository.findById(userId).orElseThrow(() -> ApiException.badRequest("User not found"));
            if (manager.getDepartment() == null || !manager.getDepartment().getId().equals(id)) {
                throw ApiException.badRequest(name(manager) + " is not a member of " + department.getName()
                        + ". Add them to the department first.");
            }
            if (!manager.isActive()) {
                throw ApiException.badRequest(name(manager) + " is inactive. Only active users can manage a department.");
            }
            if (!SystemRoles.isPrivileged(manager.getPrimaryRoleName())) {
                throw ApiException.badRequest("Give " + name(manager)
                        + " the MANAGER role before making them the department's manager.");
            }
        }

        boolean unchanged = previous == null ? manager == null : manager != null && previous.getId().equals(manager.getId());
        if (!unchanged) {
            department.setManager(manager);
            departmentRepository.save(department);
            auditService.log("dept_manager_changed", actor.getEmail(), manager == null
                            ? department.getName() + " no longer has a manager (was " + name(previous) + ")"
                            : name(manager) + " is now the manager of " + department.getName(),
                    new AuditService.Subject(manager != null ? manager.getId() : previous.getId(), id));
        }
        return toResponse(department, userRepository.countByDepartmentId(id), true);
    }

    /** Moves the user into the department (out of any other). Same rules as editing the user. */
    @Transactional
    public UserDto addMember(Long id, Long userId, User actor) {
        require(id);
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
        if (user.getDepartment() != null && user.getDepartment().getId().equals(id)) {
            return userService.toDto(user);
        }
        UserUpdateRequest current = UserService.currentValues(user);
        return userService.toDto(userService.update(userId, withDepartment(current, id), actor));
    }

    /** Leaves the user without a department. Same rules as editing the user. */
    @Transactional
    public void removeMember(Long id, Long userId, User actor) {
        Department department = require(id);
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
        if (user.getDepartment() == null || !user.getDepartment().getId().equals(id)) {
            throw ApiException.badRequest(name(user) + " is not a member of " + department.getName());
        }
        userService.update(userId, withDepartment(UserService.currentValues(user), null), actor);
    }

    // ------------------------------------------------------------------ helpers

    public Department require(Long id) {
        return departmentRepository.findById(id).orElseThrow(() -> ApiException.notFound("Department not found"));
    }

    /** Admins can edit any department; everyone else (managers) only their own. */
    public static void requireOwnDepartmentUnlessAdmin(User actor, Long departmentId) {
        if (actor.hasRole(SystemRoles.ADMIN)) return;
        if (actor.getDepartment() == null) {
            throw ApiException.forbidden("You are not assigned to a department");
        }
        if (!actor.getDepartment().getId().equals(departmentId)) {
            throw ApiException.forbidden("Managers can only edit their own department");
        }
    }

    private void ensureNameAvailable(String name, Long exceptId) {
        departmentRepository.findByNameIgnoreCase(name)
                .filter(d -> !d.getId().equals(exceptId))
                .ifPresent(d -> {
                    throw ApiException.conflict("A department named \"" + d.getName() + "\" already exists");
                });
    }

    private static UserUpdateRequest withDepartment(UserUpdateRequest current, Long departmentId) {
        return new UserUpdateRequest(current.fullName(), current.email(), null, current.role(), current.status(),
                departmentId, null);
    }

    private static String name(User user) {
        if (user == null) return "nobody";
        return user.getFullName() != null && !user.getFullName().isBlank() ? user.getFullName() : user.getEmail();
    }

    private static DepartmentResponse toResponse(Department d, long memberCount, boolean includeManager) {
        User manager = includeManager ? d.getManager() : null;
        return new DepartmentResponse(d.getId(), d.getName(), d.getColor(), memberCount,
                manager != null ? manager.getId() : null,
                manager != null ? manager.getFullName() : null);
    }
}
