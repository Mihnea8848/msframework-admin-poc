package com.msframework.backend.controller;

import com.msframework.backend.entity.AuditEvent;
import com.msframework.backend.repository.AuditEventRepository;
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

    @GetMapping
    public ResponseEntity<List<AuditEvent>> getRecentEvents() {
        return ResponseEntity.ok(auditEventRepository.findTop50ByOrderByCreatedAtDesc());
    }

    @PostMapping("/event")
    public ResponseEntity<Void> logFrontendEvent(@RequestBody Map<String, String> body, Principal principal) {
        String eventType = body.getOrDefault("eventType", "unknown");
        String description = body.getOrDefault("description", "");
        String actor = principal != null ? principal.getName() : "anonymous";
        auditService.log(eventType, actor, description);
        return ResponseEntity.ok().build();
    }
}
