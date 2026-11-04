package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.SessionDto;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.service.AuthSessionService;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.UserSessionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@Tag(name = "Sessions", description = "Signed-in sessions: your own, and any user's for admins")
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final CurrentUserService currentUserService;
    private final UserSessionService userSessionService;
    private final AuthSessionService authSessionService;
    private final UserRepository userRepository;
    private final AuditService auditService;

    @Operation(operationId = "listMySessions", summary = "The caller's signed-in sessions",
            description = "Most recently active first; the session making this request has current = true.")
    @GetMapping("/me")
    public List<SessionDto> mine(Principal principal, HttpServletRequest request) {
        User user = currentUserService.require(principal);
        return userSessionService.list(user.getEmail(), request);
    }

    @Operation(operationId = "revokeMySession", summary = "Sign out one of the caller's sessions",
            description = "Signing out the current session is the same as signing out.")
    @ApiResponse(responseCode = "204", description = "Signed out")
    @DeleteMapping("/me/{id}")
    public ResponseEntity<Void> revokeMine(@Parameter(description = "The session's id from the list (a hash)")
                                           @PathVariable String id,
                                           Principal principal, HttpServletRequest request) {
        User user = currentUserService.require(principal);
        if (userSessionService.isCurrent(id, request)) {
            auditService.log("user_logout", user.getEmail(), user.getEmail() + " signed out");
            authSessionService.clear(request);
            return ResponseEntity.noContent().build();
        }
        if (!userSessionService.revoke(user.getEmail(), id)) {
            throw ApiException.notFound("Session not found. It may have ended already.");
        }
        auditService.log("session_revoked", user.getEmail(), user.getEmail() + " signed out one of their other sessions");
        return ResponseEntity.noContent().build();
    }

    @Operation(operationId = "revokeMyOtherSessions", summary = "Sign out everywhere except here")
    @ApiResponse(responseCode = "204", description = "Signed out")
    @DeleteMapping("/me/others")
    public ResponseEntity<Void> revokeMyOthers(Principal principal, HttpServletRequest request) {
        User user = currentUserService.require(principal);
        int count = userSessionService.revokeOthers(user.getEmail(), request);
        if (count > 0) {
            auditService.log("sessions_revoked", user.getEmail(),
                    user.getEmail() + " signed out " + count + " other session" + (count == 1 ? "" : "s"));
        }
        return ResponseEntity.noContent().build();
    }

    @Operation(operationId = "listUserSessions", summary = "A user's signed-in sessions (admin)")
    @GetMapping
    public List<SessionDto> forUser(@RequestParam Long userId, Principal principal, HttpServletRequest request) {
        currentUserService.requirePermission(principal, Permission.SESSIONS_MANAGE);
        User target = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
        return userSessionService.list(target.getEmail(), request);
    }

    @Operation(operationId = "revokeUserSessions", summary = "Sign a user out everywhere (admin)")
    @ApiResponse(responseCode = "204", description = "Signed out")
    @DeleteMapping("/user/{userId}")
    public ResponseEntity<Void> revokeForUser(@PathVariable Long userId, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.SESSIONS_MANAGE);
        User target = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
        int count = userSessionService.revokeAll(target.getEmail());
        auditService.log("sessions_revoked", actor.getEmail(), "Signed " + target.getFullName() + " ("
                + target.getEmail() + ") out everywhere (" + count + " session" + (count == 1 ? "" : "s") + ")");
        return ResponseEntity.noContent().build();
    }
}
