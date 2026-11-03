package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.ApiKeyCreateRequest;
import com.msframework.backend.dto.ApiKeyDto;
import com.msframework.backend.entity.ApiKey;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.ApiKeyRepository;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.SecureTokens;
import com.msframework.backend.service.Times;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * API keys are random secrets; only their SHA-256 hash is stored and the plain secret is returned
 * exactly once, in the create response.
 */
@Tag(name = "API keys", description = "API keys (only their hashes are stored)")
@RestController
@RequestMapping("/api/keys")
@RequiredArgsConstructor
public class ApiKeyController {

    private static final String PREFIX = "msk_";

    private final ApiKeyRepository apiKeyRepository;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;

    @Operation(operationId = "listApiKeys", summary = "List API keys, newest first",
            description = "Secrets are never included.")
    @GetMapping
    public List<ApiKeyDto> list(Principal principal) {
        currentUserService.requirePermission(principal, Permission.API_KEY_READ);
        return apiKeyRepository.findAllByOrderByCreatedAtDesc().stream().map(k -> toDto(k, null)).toList();
    }

    @Operation(operationId = "createApiKey", summary = "Generate an API key",
            description = "The plain secret is returned in this response only. The body is optional.")
    @ApiResponse(responseCode = "201", description = "Created")
    @PostMapping
    public ResponseEntity<ApiKeyDto> create(@RequestBody(required = false) ApiKeyCreateRequest body, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.API_KEY_CREATE);
        String name = body == null || body.name() == null ? "" : body.name().trim();
        if (name.isEmpty()) name = "API key";
        if (name.length() > 60) throw ApiException.badRequest("Key name must be at most 60 characters");

        String secret = PREFIX + SecureTokens.random(32);
        ApiKey saved = apiKeyRepository.save(ApiKey.builder()
                .name(name)
                .maskedDisplay(PREFIX + "••••••••••••" + secret.substring(secret.length() - 4))
                .keyHash(SecureTokens.sha256Hex(secret))
                .createdBy(actor.getEmail())
                .build());

        auditService.log("key_generated", actor.getEmail(), "API key generated: " + name);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(saved, secret));
    }

    @Operation(operationId = "revokeApiKey", summary = "Revoke an API key")
    @ApiResponse(responseCode = "204", description = "Revoked")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.API_KEY_DELETE);
        ApiKey key = apiKeyRepository.findById(id).orElseThrow(() -> ApiException.notFound("API key not found"));
        apiKeyRepository.delete(key);
        auditService.log("key_revoked", actor.getEmail(), "API key revoked: " + key.getName());
        return ResponseEntity.noContent().build();
    }

    private static ApiKeyDto toDto(ApiKey key, String secret) {
        return new ApiKeyDto(key.getId(), key.getName(), key.getMaskedDisplay(), key.getCreatedBy(),
                Times.toOffset(key.getCreatedAt()), key.getLastUsed(), secret);
    }
}
