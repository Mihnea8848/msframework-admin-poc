package com.msframework.backend.controller;

import com.msframework.backend.entity.ApiKey;
import com.msframework.backend.repository.ApiKeyRepository;
import com.msframework.backend.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/keys")
@RequiredArgsConstructor
public class ApiKeyController {

    private final ApiKeyRepository apiKeyRepository;
    private final AuditService auditService;

    @GetMapping
    public ResponseEntity<List<ApiKey>> getAll() {
        return ResponseEntity.ok(apiKeyRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<ApiKey> generate(@RequestBody Map<String, String> body, Principal principal) {
        String name = body.getOrDefault("name", "New API Key");
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 4).toUpperCase();
        String masked = "sk_live_••••••••••••••••" + suffix;

        ApiKey key = ApiKey.builder()
                .name(name)
                .maskedDisplay(masked)
                .build();
        ApiKey saved = apiKeyRepository.save(key);
        auditService.log("key_generated", principal.getName(), "API key generated: " + name);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> revoke(@PathVariable Long id, Principal principal) {
        return apiKeyRepository.findById(id).map(key -> {
            apiKeyRepository.deleteById(id);
            auditService.log("key_revoked", principal.getName(), "API key revoked: " + key.getName());
            return ResponseEntity.noContent().build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
