package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.ImportRequests;
import com.msframework.backend.dto.ImportResult;
import com.msframework.backend.entity.User;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.ImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@Tag(name = "Import", description = "Bulk import from CSV rows")
@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;
    private final CurrentUserService currentUserService;

    @Operation(operationId = "importDepartments", summary = "Create departments from CSV rows",
            description = "Invalid rows are skipped and reported; the others are created.")
    @PostMapping("/departments")
    public ImportResult importDepartments(@RequestBody ImportRequests.Departments request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.IMPORT_DATA, Permission.DEPARTMENT_CREATE);
        return importService.importDepartments(request.rows(), actor);
    }

    @Operation(operationId = "importUsers", summary = "Create users from CSV rows",
            description = "Invalid rows are skipped and reported; the others are created.")
    @PostMapping("/users")
    public ImportResult importUsers(@RequestBody ImportRequests.Users request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.IMPORT_DATA, Permission.USER_CREATE);
        return importService.importUsers(request.rows(), actor);
    }
}
