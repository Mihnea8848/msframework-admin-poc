package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.AuditPage;
import com.msframework.backend.dto.DepartmentDetailsDto;
import com.msframework.backend.dto.DepartmentManagerRequest;
import com.msframework.backend.dto.DepartmentRequest;
import com.msframework.backend.dto.DepartmentResponse;
import com.msframework.backend.dto.UserDto;
import com.msframework.backend.entity.User;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.DepartmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@Tag(name = "Departments", description = "Departments, their managers and members")
@RestController
@RequestMapping("/api/departments")
@RequiredArgsConstructor
public class DepartmentController {

    private final DepartmentService departmentService;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;

    /** Public: the registration form needs the list of departments. */
    @Operation(operationId = "listDepartments", summary = "List departments with their member counts",
            description = "Public, because the registration form needs it. The manager is only included for "
                    + "signed-in callers.")
    @GetMapping
    public List<DepartmentResponse> list(Principal principal) {
        boolean signedIn = currentUserService.find(principal).filter(User::isActive).isPresent();
        return departmentService.list(signedIn);
    }

    @Operation(operationId = "getDepartment", summary = "One department with its members")
    @GetMapping("/{id}")
    public DepartmentDetailsDto get(@PathVariable Long id, Principal principal) {
        currentUserService.requirePermission(principal, Permission.DEPARTMENT_READ, Permission.USER_READ);
        return departmentService.details(id);
    }

    @Operation(operationId = "getDepartmentActivity", summary = "Audit events about a department, newest first",
            description = "Keyset paged: pass nextCursor back as cursor to get older events.")
    @GetMapping("/{id}/activity")
    public AuditPage activity(@PathVariable Long id,
                              @RequestParam(required = false) String cursor,
                              @Parameter(description = "Events per page, 1 to 100")
                              @RequestParam(defaultValue = "50") int limit,
                              Principal principal) {
        currentUserService.requirePermission(principal, Permission.DEPARTMENT_READ, Permission.AUDIT_READ);
        departmentService.require(id);
        return auditService.departmentActivity(id, cursor, limit);
    }

    @Operation(operationId = "createDepartment", summary = "Create a department")
    @ApiResponse(responseCode = "201", description = "Created")
    @PostMapping
    public ResponseEntity<DepartmentResponse> create(@RequestBody DepartmentRequest request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.DEPARTMENT_CREATE);
        return ResponseEntity.status(HttpStatus.CREATED).body(departmentService.create(request, actor));
    }

    @Operation(operationId = "updateDepartment", summary = "Rename or recolour a department",
            description = "Managers can only edit their own department.")
    @PutMapping("/{id}")
    public DepartmentResponse update(@PathVariable Long id, @RequestBody DepartmentRequest request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.DEPARTMENT_UPDATE);
        return departmentService.update(id, request, actor);
    }

    @Operation(operationId = "setDepartmentManager", summary = "Choose or clear a department's manager",
            description = "Admins only. The manager must be an active member of the department with the MANAGER "
                    + "or ADMIN role. The manager is cleared automatically when that user leaves the department, "
                    + "is deactivated, loses the role or is deleted.")
    @PutMapping("/{id}/manager")
    public DepartmentResponse setManager(@PathVariable Long id, @RequestBody DepartmentManagerRequest request,
                                         Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.DEPARTMENT_UPDATE);
        return departmentService.setManager(id, request.userId(), actor);
    }

    @Operation(operationId = "addDepartmentMember", summary = "Move a user into the department",
            description = "Changes the user's department, with the same rules as updateUser: admins can move "
                    + "anyone; managers cannot move users between departments.")
    @PostMapping("/{id}/members/{userId}")
    public UserDto addMember(@PathVariable Long id, @PathVariable Long userId, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.USER_UPDATE);
        return departmentService.addMember(id, userId, actor);
    }

    @Operation(operationId = "removeDepartmentMember", summary = "Remove a user from the department",
            description = "The user is kept, without a department. Same rules as updateUser.")
    @ApiResponse(responseCode = "204", description = "Removed")
    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long id, @PathVariable Long userId, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.USER_UPDATE);
        departmentService.removeMember(id, userId, actor);
        return ResponseEntity.noContent().build();
    }

    /** Members of the deleted department are kept and simply become unassigned. */
    @Operation(operationId = "deleteDepartment", summary = "Delete a department",
            description = "Its members are kept and become unassigned.")
    @ApiResponse(responseCode = "204", description = "Deleted")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.DEPARTMENT_DELETE);
        departmentService.delete(id, actor);
        return ResponseEntity.noContent().build();
    }
}
