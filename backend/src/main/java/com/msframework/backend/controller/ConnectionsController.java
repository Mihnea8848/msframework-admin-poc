package com.msframework.backend.controller;

import com.msframework.backend.config.Integrations;
import com.msframework.backend.config.Permission;
import com.msframework.backend.entity.ServiceConnection;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.ServiceConnectionRepository;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/connections")
@RequiredArgsConstructor
public class ConnectionsController {

    private final ServiceConnectionRepository connectionRepository;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;

    /** Every known integration, in display order (missing rows are reported as not connected). */
    @GetMapping
    public List<ServiceConnection> list(Principal principal) {
        currentUserService.requirePermission(principal, Permission.CONNECTIONS_READ);
        Map<String, ServiceConnection> stored = connectionRepository.findAll().stream()
                .collect(Collectors.toMap(ServiceConnection::getServiceId, Function.identity()));
        return Integrations.SERVICE_IDS.stream()
                .map(id -> stored.getOrDefault(id, ServiceConnection.builder().serviceId(id).build()))
                .toList();
    }

    @PostMapping("/{serviceId}/connect")
    public ServiceConnection connect(@PathVariable String serviceId, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.CONNECTIONS_UPDATE);
        requireKnown(serviceId);
        ServiceConnection conn = connectionRepository.findById(serviceId)
                .orElse(ServiceConnection.builder().serviceId(serviceId).build());
        conn.setConnected(true);
        conn.setEnabled(true);
        conn.setConnectedAt(LocalDateTime.now());
        ServiceConnection saved = connectionRepository.save(conn);
        auditService.log("connection_changed", actor.getEmail(), serviceId + " integration connected");
        return saved;
    }

    @PostMapping("/{serviceId}/disconnect")
    public ServiceConnection disconnect(@PathVariable String serviceId, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.CONNECTIONS_UPDATE);
        requireKnown(serviceId);
        ServiceConnection conn = connectionRepository.findById(serviceId)
                .orElse(ServiceConnection.builder().serviceId(serviceId).build());
        conn.setConnected(false);
        conn.setEnabled(false);
        conn.setConnectedAt(null);
        ServiceConnection saved = connectionRepository.save(conn);
        auditService.log("connection_changed", actor.getEmail(), serviceId + " integration disconnected");
        return saved;
    }

    @PatchMapping("/{serviceId}/toggle")
    public ServiceConnection toggle(@PathVariable String serviceId, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.CONNECTIONS_UPDATE);
        requireKnown(serviceId);
        ServiceConnection conn = connectionRepository.findById(serviceId)
                .filter(ServiceConnection::isConnected)
                .orElseThrow(() -> ApiException.badRequest("Connect " + serviceId + " before enabling it"));
        conn.setEnabled(!conn.isEnabled());
        ServiceConnection saved = connectionRepository.save(conn);
        auditService.log("connection_changed", actor.getEmail(),
                serviceId + " integration " + (saved.isEnabled() ? "enabled" : "paused"));
        return saved;
    }

    private static void requireKnown(String serviceId) {
        if (!Integrations.isKnown(serviceId)) {
            throw ApiException.notFound("Unknown integration: " + serviceId);
        }
    }
}
