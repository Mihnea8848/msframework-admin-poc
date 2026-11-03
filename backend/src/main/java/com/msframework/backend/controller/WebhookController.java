package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.entity.User;
import com.msframework.backend.entity.Webhook;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.WebhookRepository;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.URISyntaxException;
import java.security.Principal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Webhook endpoints are stored and managed here; actual delivery is not implemented yet. */
@RestController
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
public class WebhookController {

    private static final Pattern EVENT = Pattern.compile("^(\\*|[a-z][a-z_.]{0,63})$");

    private final WebhookRepository webhookRepository;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;

    @GetMapping
    public List<Webhook> list(Principal principal) {
        currentUserService.requirePermission(principal, Permission.CONNECTIONS_READ);
        return webhookRepository.findAllByOrderByCreatedAtDesc();
    }

    @PostMapping
    public ResponseEntity<Webhook> create(@RequestBody Map<String, Object> body, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.CONNECTIONS_UPDATE);
        String url = validateUrl(body.get("url"));
        String events = normalizeEvents(body.get("events"));

        Webhook saved = webhookRepository.save(Webhook.builder().url(url).events(events).active(true).build());
        auditService.log("webhook_added", actor.getEmail(), "Webhook added: " + url);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.CONNECTIONS_UPDATE);
        Webhook webhook = webhookRepository.findById(id).orElseThrow(() -> ApiException.notFound("Webhook not found"));
        webhookRepository.delete(webhook);
        auditService.log("webhook_removed", actor.getEmail(), "Webhook removed: " + webhook.getUrl());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/toggle")
    public Webhook toggle(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.CONNECTIONS_UPDATE);
        Webhook webhook = webhookRepository.findById(id).orElseThrow(() -> ApiException.notFound("Webhook not found"));
        webhook.setActive(!webhook.isActive());
        Webhook saved = webhookRepository.save(webhook);
        auditService.log("webhook_toggled", actor.getEmail(),
                "Webhook " + (saved.isActive() ? "enabled" : "disabled") + ": " + saved.getUrl());
        return saved;
    }

    private static String validateUrl(Object raw) {
        String url = raw instanceof String s ? s.trim() : "";
        if (url.isEmpty()) throw ApiException.badRequest("Webhook URL is required");
        if (url.length() > 255) throw ApiException.badRequest("Webhook URL is too long (maximum 255 characters)");
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!(scheme.equals("http") || scheme.equals("https")) || uri.getHost() == null) {
                throw ApiException.badRequest("Webhook URL must be an http(s) address, e.g. https://example.com/hook");
            }
        } catch (URISyntaxException e) {
            throw ApiException.badRequest("Webhook URL is not a valid address");
        }
        return url;
    }

    private static String normalizeEvents(Object raw) {
        Set<String> events = new LinkedHashSet<>();
        if (raw instanceof List<?> list) {
            for (Object item : list) {
                if (item != null) events.add(item.toString().trim());
            }
        } else if (raw instanceof String s && !s.isBlank()) {
            for (String part : s.split(",")) events.add(part.trim());
        }
        events.removeIf(String::isEmpty);
        if (events.isEmpty()) events.add("*");
        for (String event : events) {
            if (!EVENT.matcher(event).matches()) {
                throw ApiException.badRequest("Invalid event name: " + event);
            }
        }
        return String.join(",", events);
    }
}
