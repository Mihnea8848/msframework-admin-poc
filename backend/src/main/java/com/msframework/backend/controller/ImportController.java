package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.ImportRequests;
import com.msframework.backend.dto.ImportResult;
import com.msframework.backend.entity.User;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.ImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;
    private final CurrentUserService currentUserService;

    @PostMapping("/departments")
    public ImportResult importDepartments(@RequestBody ImportRequests.Departments request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.IMPORT_DATA, Permission.DEPARTMENT_CREATE);
        return importService.importDepartments(request.rows(), actor);
    }

    @PostMapping("/users")
    public ImportResult importUsers(@RequestBody ImportRequests.Users request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.IMPORT_DATA, Permission.USER_CREATE);
        return importService.importUsers(request.rows(), actor);
    }
}
