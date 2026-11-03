package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.WebhookCreateRequest;
import com.msframework.backend.entity.User;
import com.msframework.backend.entity.Webhook;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.WebhookRepository;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.service.CurrentUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
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
import java.util.Set;
import java.util.regex.Pattern;

/** Webhook endpoints are stored and managed here; actual delivery is not implemented yet. */
@Tag(name = "Webhooks", description = "Webhook endpoints (stored only; delivery is not implemented yet)")
@RestController
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
public class WebhookController {

    private static final Pattern EVENT = Pattern.compile("^(\\*|[a-z][a-z_.]{0,63})$");

    private final WebhookRepository webhookRepository;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;

    @Operation(operationId = "listWebhooks", summary = "List webhooks, newest first")
    @GetMapping
    public List<Webhook> list(Principal principal) {
        currentUserService.requirePermission(principal, Permission.CONNECTIONS_READ);
        return webhookRepository.findAllByOrderByCreatedAtDesc();
    }

    @Operation(operationId = "createWebhook", summary = "Add a webhook")
    @ApiResponse(responseCode = "201", description = "Created")
    @PostMapping
    public ResponseEntity<Webhook> create(@RequestBody WebhookCreateRequest body, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.CONNECTIONS_UPDATE);
        String url = validateUrl(body.url());
        String events = normalizeEvents(body.events());

        Webhook saved = webhookRepository.save(Webhook.builder().url(url).events(events).active(true).build());
        auditService.log("webhook_added", actor.getEmail(), "Webhook added: " + url);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @Operation(operationId = "deleteWebhook", summary = "Remove a webhook")
    @ApiResponse(responseCode = "204", description = "Removed")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.CONNECTIONS_UPDATE);
        Webhook webhook = webhookRepository.findById(id).orElseThrow(() -> ApiException.notFound("Webhook not found"));
        webhookRepository.delete(webhook);
        auditService.log("webhook_removed", actor.getEmail(), "Webhook removed: " + webhook.getUrl());
        return ResponseEntity.noContent().build();
    }

    @Operation(operationId = "toggleWebhook", summary = "Enable or disable a webhook")
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

    private static String validateUrl(String raw) {
        String url = raw == null ? "" : raw.trim();
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

    /** Missing or empty means every event ("*"). A legacy "a,b" string arrives as a one-item list. */
    private static String normalizeEvents(List<String> raw) {
        Set<String> events = new LinkedHashSet<>();
        if (raw != null) {
            for (String item : raw) {
                if (item == null) continue;
                for (String part : item.split(",")) events.add(part.trim());
            }
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
