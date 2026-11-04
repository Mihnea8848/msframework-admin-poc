package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.AccessRequestApproveRequest;
import com.msframework.backend.dto.AccessRequestDto;
import com.msframework.backend.dto.AccessRequestRejectRequest;
import com.msframework.backend.entity.User;
import com.msframework.backend.service.AccessRequestService;
import com.msframework.backend.service.CurrentUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@Tag(name = "Access requests", description = "Self-registrations waiting for an administrator")
@RestController
@RequestMapping("/api/access-requests")
@RequiredArgsConstructor
public class AccessRequestController {

    private final AccessRequestService accessRequestService;
    private final CurrentUserService currentUserService;

    @Operation(operationId = "listAccessRequests", summary = "List access requests, newest first",
            description = "Without status, every request (decided ones are kept as history).")
    @GetMapping
    public List<AccessRequestDto> list(
            @Parameter(schema = @Schema(allowableValues = {"PENDING", "APPROVED", "REJECTED"}))
            @RequestParam(required = false) String status,
            Principal principal) {
        currentUserService.requirePermission(principal, Permission.ACCESS_REQUESTS_MANAGE);
        return accessRequestService.list(status);
    }

    @Operation(operationId = "approveAccessRequest", summary = "Approve a request and create the account",
            description = "The account gets the password the person chose when registering. Role defaults to "
                    + "MEMBER and department to the one requested.")
    @PostMapping("/{id}/approve")
    public AccessRequestDto approve(@PathVariable Long id,
                                    @RequestBody(required = false) AccessRequestApproveRequest body,
                                    Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.ACCESS_REQUESTS_MANAGE);
        return accessRequestService.approve(id, body, actor);
    }

    @Operation(operationId = "rejectAccessRequest", summary = "Reject a request",
            description = "The request is kept as history with the note; the stored password is discarded.")
    @PostMapping("/{id}/reject")
    public AccessRequestDto reject(@PathVariable Long id,
                                   @RequestBody(required = false) AccessRequestRejectRequest body,
                                   Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.ACCESS_REQUESTS_MANAGE);
        return accessRequestService.reject(id, body != null ? body.note() : null, actor);
    }
}
