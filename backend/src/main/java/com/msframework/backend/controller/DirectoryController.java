package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.DirectoryDtos.DirectoryMapping;
import com.msframework.backend.dto.DirectoryDtos.DirectoryMappingDto;
import com.msframework.backend.dto.DirectoryDtos.DirectoryStatusDto;
import com.msframework.backend.dto.DirectoryDtos.DirectorySyncResult;
import com.msframework.backend.entity.User;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.DirectoryMappingService;
import com.msframework.backend.service.DirectorySyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

/** Directory sync: import and update users from Authentik (ADMIN only, permission DIRECTORY_SYNC). */
@Tag(name = "Directory", description = "Import and update users from the Authentik directory")
@RestController
@RequestMapping("/api/directory")
@RequiredArgsConstructor
public class DirectoryController {

    private final CurrentUserService currentUserService;
    private final DirectorySyncService directorySyncService;
    private final DirectoryMappingService directoryMappingService;

    @Operation(operationId = "getDirectoryStatus", summary = "Whether directory sync is configured, and the last sync",
            description = "Never contacts Authentik and never returns the token.")
    @GetMapping("/status")
    public DirectoryStatusDto status(Principal principal) {
        currentUserService.requirePermission(principal, Permission.DIRECTORY_SYNC);
        return directorySyncService.status();
    }

    @Operation(operationId = "previewDirectorySync", summary = "Plan a sync without changing anything",
            description = "Reads Authentik and returns what a sync would do for each person. "
                    + "Errors talking to Authentik are answered with 502 and a message.")
    @PostMapping("/sync/preview")
    public DirectorySyncResult preview(Principal principal) {
        currentUserService.requirePermission(principal, Permission.DIRECTORY_SYNC);
        return directorySyncService.preview();
    }

    @Operation(operationId = "runDirectorySync", summary = "Sync users from Authentik",
            description = "Plans again from fresh data and applies it in one transaction: creates, links, updates "
                    + "and deactivates users. Every change is audited with the actor \"Authentik sync\".")
    @PostMapping("/sync")
    public DirectorySyncResult sync(Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.DIRECTORY_SYNC);
        return directorySyncService.apply(actor);
    }

    @Operation(operationId = "getDirectoryMapping", summary = "The group mapping the sync uses")
    @GetMapping("/mapping")
    public DirectoryMappingDto mapping(Principal principal) {
        currentUserService.requirePermission(principal, Permission.DIRECTORY_SYNC);
        return directoryMappingService.state();
    }

    @Operation(operationId = "saveDirectoryMapping", summary = "Change the group mapping",
            description = "Department names must exist. Takes effect on the next preview or sync.")
    @PutMapping("/mapping")
    public DirectoryMappingDto saveMapping(@RequestBody DirectoryMapping mapping, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.DIRECTORY_SYNC);
        return directoryMappingService.save(mapping, actor);
    }

    @Operation(operationId = "resetDirectoryMapping", summary = "Go back to the default group mapping")
    @DeleteMapping("/mapping")
    public DirectoryMappingDto resetMapping(Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.DIRECTORY_SYNC);
        return directoryMappingService.reset(actor);
    }
}
