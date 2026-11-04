package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.OrgSettingsDto;
import com.msframework.backend.dto.OrgSettingsRequest;
import com.msframework.backend.entity.User;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.OrgSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

/** The typed organisation settings (Settings, Organisation tab). */
@Tag(name = "Organisation", description = "Company name, registration, password policy and session settings")
@RestController
@RequestMapping("/api/org/settings")
@RequiredArgsConstructor
public class OrgSettingsController {

    private final CurrentUserService currentUserService;
    private final OrgSettingsService orgSettingsService;

    @Operation(operationId = "getOrgSettings", summary = "Read the organisation settings",
            description = "Any signed-in user may read them (forms need the password policy).")
    @GetMapping
    public OrgSettingsDto get(Principal principal) {
        currentUserService.require(principal);
        return orgSettingsService.get();
    }

    @Operation(operationId = "updateOrgSettings", summary = "Change the organisation settings",
            description = "Fields left out keep their value. sessionTimeoutMinutes cannot be changed here.")
    @PutMapping
    public OrgSettingsDto update(@RequestBody OrgSettingsRequest request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.ORG_SETTINGS_MANAGE);
        return orgSettingsService.update(request, actor);
    }
}
