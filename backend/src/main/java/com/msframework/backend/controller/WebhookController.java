package com.msframework.backend.controller;

import com.msframework.backend.entity.Webhook;
import com.msframework.backend.repository.WebhookRepository;
import com.msframework.backend.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
public class WebhookController {

    private final WebhookRepository webhookRepository;
    private final AuditService auditService;

    @GetMapping
    public ResponseEntity<List<Webhook>> getAll() {
        return ResponseEntity.ok(webhookRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<Webhook> create(@RequestBody Map<String, Object> body, Principal principal) {
        String url = (String) body.getOrDefault("url", "");
        Object eventsObj = body.get("events");
        String events = eventsObj instanceof List<?>
                ? String.join(",", ((List<?>) eventsObj).stream().map(Object::toString).toList())
                : String.valueOf(eventsObj);

        Webhook webhook = Webhook.builder()
                .url(url)
                .events(events)
                .active(true)
                .build();
        Webhook saved = webhookRepository.save(webhook);
        auditService.log("webhook_added", principal.getName(), "Webhook added: " + url);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, Principal principal) {
        return webhookRepository.findById(id).map(wh -> {
            webhookRepository.deleteById(id);
            auditService.log("webhook_removed", principal.getName(), "Webhook removed: " + wh.getUrl());
            return ResponseEntity.noContent().build();
        }).orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<Webhook> toggle(@PathVariable Long id) {
        return webhookRepository.findById(id).map(wh -> {
            wh.setActive(!wh.isActive());
            return ResponseEntity.ok(webhookRepository.save(wh));
        }).orElse(ResponseEntity.notFound().build());
    }
}
