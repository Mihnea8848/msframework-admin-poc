package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.AuditPage;
import com.msframework.backend.dto.BulkUserRequest;
import com.msframework.backend.dto.BulkUserResult;
import com.msframework.backend.dto.PasswordResetLinkDto;
import com.msframework.backend.dto.UserCreateRequest;
import com.msframework.backend.dto.UserDetailsDto;
import com.msframework.backend.dto.UserDto;
import com.msframework.backend.dto.UserPage;
import com.msframework.backend.dto.UserUpdateRequest;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.service.AuthSessionService;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.PasswordResetService;
import com.msframework.backend.service.UserBulkService;
import com.msframework.backend.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@Tag(name = "Users", description = "User accounts, their roles and departments")
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final CurrentUserService currentUserService;
    private final UserService userService;
    private final UserBulkService userBulkService;
    private final PasswordResetService passwordResetService;
    private final AuditService auditService;
    private final UserRepository userRepository;
    private final AuthSessionService authSessionService;

    @Operation(operationId = "listUsers", summary = "List all users",
            description = "Unpaged, ordered by id. Prefer /api/users/search for large organisations.")
    @GetMapping
    public List<UserDto> list(Principal principal) {
        currentUserService.requirePermission(principal, Permission.USER_READ);
        return userService.list();
    }

    @Operation(operationId = "searchUsers", summary = "Search users, one page at a time",
            description = "q matches name, email, job title and phone. sort is one of name, email, department, "
                    + "status, createdAt, lastLoginAt, with a leading \"-\" for descending (default name). "
                    + "Users without a value for the sort key come last.")
    @GetMapping("/search")
    public UserPage search(
            @Parameter(description = "Free text, case-insensitive") @RequestParam(required = false) String q,
            @Parameter(schema = @Schema(allowableValues = {"ADMIN", "MANAGER", "MEMBER", "VIEWER"}))
            @RequestParam(required = false) String role,
            @Parameter(schema = @Schema(allowableValues = {"Active", "Inactive"}))
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long departmentId,
            @Parameter(schema = @Schema(defaultValue = "name", allowableValues = {"name", "-name", "email", "-email",
                    "department", "-department", "status", "-status", "createdAt", "-createdAt", "lastLoginAt",
                    "-lastLoginAt"}))
            @RequestParam(required = false) String sort,
            @Parameter(description = "Zero-based page number") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size, 1 to 100") @RequestParam(defaultValue = "25") int size,
            Principal principal) {
        currentUserService.requirePermission(principal, Permission.USER_READ);
        return userService.search(q, role, status, departmentId, sort, page, size);
    }

    @Operation(operationId = "getUser", summary = "One user's profile",
            description = "Includes their permissions, their department's manager and whether the caller may edit them.")
    @GetMapping("/{id}")
    public UserDetailsDto get(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.USER_READ);
        return userService.details(id, actor);
    }

    @Operation(operationId = "getUserActivity", summary = "Audit events by or about a user, newest first",
            description = "Events the user did (by their current email) or that were about them. Keyset paged: "
                    + "pass nextCursor back as cursor to get older events.")
    @GetMapping("/{id}/activity")
    public AuditPage activity(@PathVariable Long id,
                              @RequestParam(required = false) String cursor,
                              @Parameter(description = "Events per page, 1 to 100")
                              @RequestParam(defaultValue = "50") int limit,
                              Principal principal) {
        currentUserService.requirePermission(principal, Permission.USER_READ, Permission.AUDIT_READ);
        User user = userRepository.findById(id).orElseThrow(() -> ApiException.notFound("User not found"));
        return auditService.userActivity(user.getId(), user.getEmail(), cursor, limit);
    }

    @Operation(operationId = "createUser", summary = "Create a user",
            description = "A missing role or status defaults to MEMBER or Active.")
    @ApiResponse(responseCode = "201", description = "Created")
    @PostMapping
    public ResponseEntity<UserDto> create(@RequestBody UserCreateRequest request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.USER_CREATE);
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.create(request, actor));
    }

    @Operation(operationId = "bulkUpdateUsers", summary = "Apply one action to several users",
            description = "Each user is checked and saved on its own with the same rules as updateUser (last "
                    + "active admin, no self-deactivation, manager scope), so some may fail while others succeed. "
                    + "Answers 200 with one result per id.")
    @PostMapping("/bulk")
    public BulkUserResult bulk(@RequestBody BulkUserRequest request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.USER_UPDATE);
        return userBulkService.apply(request, actor);
    }

    @Operation(operationId = "createPasswordResetLink", summary = "Make a password reset link for a user",
            description = "Until email exists the link is returned here, once, for the caller to hand over. It is "
                    + "single-use, expires after 30 minutes and replaces any earlier link. Managers can do this "
                    + "for the members and viewers of their own department.")
    @PostMapping("/{id}/password-reset")
    public PasswordResetLinkDto createPasswordResetLink(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.USER_UPDATE);
        return passwordResetService.createLinkFor(id, actor);
    }

    @Operation(operationId = "updateUser", summary = "Update a user",
            description = "Managers can only edit MEMBER and VIEWER users of their own department.")
    @PutMapping("/{id}")
    public UserDto update(@PathVariable Long id,
                          @RequestBody UserUpdateRequest request,
                          Principal principal,
                          HttpServletRequest httpRequest,
                          HttpServletResponse httpResponse) {
        User actor = currentUserService.requirePermission(principal, Permission.USER_UPDATE);
        User saved = userService.update(id, request, actor);

        // Admins editing their own email would otherwise lose their session.
        if (saved.getId().equals(actor.getId()) && !saved.getEmail().equals(actor.getEmail())) {
            authSessionService.refreshPrincipal(saved.getEmail(), httpRequest, httpResponse);
        }
        return userService.toDto(saved);
    }

    @Operation(operationId = "deleteUser", summary = "Delete a user")
    @ApiResponse(responseCode = "204", description = "Deleted")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.USER_DELETE);
        userService.delete(id, actor);
        return ResponseEntity.noContent().build();
    }
}
