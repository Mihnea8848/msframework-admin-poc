package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.ImportRequests;
import com.msframework.backend.dto.ImportResult;
import com.msframework.backend.entity.User;
import com.msframework.backend.service.BusinessAccess;
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

    @Operation(operationId = "importExpenses", summary = "Create expenses from CSV rows",
            description = "IMPORT_DATA and FINANCE_MANAGE. Invalid rows are skipped and reported; the others are created.")
    @PostMapping("/expenses")
    public ImportResult importExpenses(@RequestBody ImportRequests.Expenses request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.IMPORT_DATA, Permission.FINANCE_MANAGE);
        return importService.importExpenses(request.rows(), actor);
    }

    @Operation(operationId = "importBudgets", summary = "Create budget lines from CSV rows",
            description = "IMPORT_DATA and FINANCE_MANAGE. A line that already exists is reported, not overwritten.")
    @PostMapping("/budgets")
    public ImportResult importBudgets(@RequestBody ImportRequests.Budgets request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.IMPORT_DATA, Permission.FINANCE_MANAGE);
        return importService.importBudgets(request.rows(), actor);
    }

    @Operation(operationId = "importCheckins", summary = "Record goal check-ins from CSV rows",
            description = "IMPORT_DATA or GOALS_MANAGE; each row also needs the right to record a check-in for that "
                    + "goal (own department, or admin). Invalid rows are skipped and reported.")
    @PostMapping("/checkins")
    public ImportResult importCheckins(@RequestBody ImportRequests.Checkins request, Principal principal) {
        User actor = currentUserService.require(principal);
        BusinessAccess.requireAny(actor, Permission.IMPORT_DATA, Permission.GOALS_MANAGE);
        return importService.importCheckins(request.rows(), actor);
    }
}
