package com.msframework.backend.controller;

import com.msframework.backend.entity.ServiceConnection;
import com.msframework.backend.repository.ServiceConnectionRepository;
import com.msframework.backend.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/connections")
@RequiredArgsConstructor
public class ConnectionsController {

    private final ServiceConnectionRepository connectionRepository;
    private final AuditService auditService;

    @GetMapping
    public ResponseEntity<List<ServiceConnection>> getAll() {
        return ResponseEntity.ok(connectionRepository.findAll());
    }

    @PostMapping("/{serviceId}/connect")
    public ResponseEntity<ServiceConnection> connect(@PathVariable String serviceId, Principal principal) {
        ServiceConnection conn = connectionRepository.findById(serviceId)
                .orElse(ServiceConnection.builder().serviceId(serviceId).build());
        conn.setConnected(true);
        conn.setEnabled(true);
        conn.setConnectedAt(LocalDateTime.now());
        ServiceConnection saved = connectionRepository.save(conn);
        auditService.log("connection_changed", principal.getName(),
                serviceId + " integration connected");
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{serviceId}/disconnect")
    public ResponseEntity<ServiceConnection> disconnect(@PathVariable String serviceId, Principal principal) {
        return connectionRepository.findById(serviceId).map(conn -> {
            conn.setConnected(false);
            conn.setEnabled(false);
            ServiceConnection saved = connectionRepository.save(conn);
            auditService.log("connection_changed", principal.getName(),
                    serviceId + " integration disconnected");
            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{serviceId}/toggle")
    public ResponseEntity<ServiceConnection> toggleEnabled(@PathVariable String serviceId, Principal principal) {
        return connectionRepository.findById(serviceId).map(conn -> {
            if (!conn.isConnected()) return ResponseEntity.badRequest().<ServiceConnection>build();
            conn.setEnabled(!conn.isEnabled());
            ServiceConnection saved = connectionRepository.save(conn);
            auditService.log("connection_changed", principal.getName(),
                    serviceId + " integration " + (saved.isEnabled() ? "enabled" : "disabled"));
            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }
}
