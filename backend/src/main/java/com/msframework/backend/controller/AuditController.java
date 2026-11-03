package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.AuditEventDto;
import com.msframework.backend.dto.ClientAuditEventRequest;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.AuditEventRepository;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.service.CurrentUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@Tag(name = "Audit", description = "The audit log")
@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditController {

    private static final int MAX_LIMIT = 500;

    private final AuditEventRepository auditEventRepository;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;

    @Operation(operationId = "listAuditEvents", summary = "The most recent audit events, newest first")
    @GetMapping
    public List<AuditEventDto> recent(@Parameter(description = "How many events to return, 1 to 500")
                                      @RequestParam(defaultValue = "50") int limit, Principal principal) {
        currentUserService.requirePermission(principal, Permission.AUDIT_READ);
        int size = Math.max(1, Math.min(limit, MAX_LIMIT));
        return auditEventRepository.findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(0, size)).stream()
                .map(AuditService::toDto)
                .toList();
    }

    /**
     * Lets the frontend record actions that happen purely in the browser. Only the CSV export
     * qualifies; everything else is logged by the backend itself and cannot be forged from here.
     */
    @Operation(operationId = "logClientAuditEvent", summary = "Record an action that happened in the browser",
            description = "Only the CSV export (export_generated) can be recorded, and it needs EXPORT_DATA.")
    @ApiResponse(responseCode = "204", description = "Recorded")
    @PostMapping("/event")
    public ResponseEntity<Void> logClientEvent(@RequestBody ClientAuditEventRequest body, Principal principal) {
        User actor = currentUserService.require(principal);
        String eventType = body.eventType();
        if (!"export_generated".equals(eventType)) {
            throw ApiException.badRequest("Unsupported event type");
        }
        if (!actor.hasPermission(Permission.EXPORT_DATA)) {
            throw ApiException.forbidden("You do not have permission to do this (EXPORT_DATA)");
        }
        String description = body.description();
        auditService.log(eventType, actor.getEmail(), description == null || description.isBlank() ? "Exported data" : description);
        return ResponseEntity.noContent().build();
    }
}
