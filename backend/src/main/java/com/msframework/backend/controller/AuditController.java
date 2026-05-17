package com.msframework.backend.controller;

import com.msframework.backend.entity.AuditEvent;
import com.msframework.backend.entity.User;
import com.msframework.backend.repository.AuditEventRepository;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.config.Permission;
import com.msframework.backend.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditEventRepository auditEventRepository;
    private final AuditService auditService;
    private final UserRepository userRepository;

    private User getCurrentUser(Principal principal) {
        if (principal == null) {
            return null;
        }

        return userRepository.findByEmail(principal.getName())
                .orElse(null);
    }

    private ResponseEntity<?> checkPermission(Principal principal, Permission permission) {
        User currentUser = getCurrentUser(principal);

        if (currentUser == null) {
            return ResponseEntity.status(401).body("Not authenticated");
        }

        if (!currentUser.hasPermission(permission)) {
            return ResponseEntity.status(403).body("Missing permission: " + permission);
        }

        return null;
    }

    @GetMapping
    public ResponseEntity<?> getRecentEvents(Principal principal) {
        ResponseEntity<?> forbidden = checkPermission(principal, Permission.AUDIT_READ);

        if (forbidden != null) {
            return forbidden;
        }

        List<AuditEvent> events = auditEventRepository.findTop50ByOrderByCreatedAtDesc();

        return ResponseEntity.ok(events);
    }

    @PostMapping("/event")
    public ResponseEntity<?> logFrontendEvent(
            @RequestBody Map<String, String> body,
            Principal principal
    ) {
        if (principal == null) {
            return ResponseEntity.status(401).body("Not authenticated");
        }

        String eventType = body.getOrDefault("eventType", "unknown");
        String description = body.getOrDefault("description", "");
        String actor = principal.getName();

        auditService.log(eventType, actor, description);

        return ResponseEntity.ok().build();
    }
}