package com.msframework.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Entity
@Table(name = "api_keys")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ApiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "masked_display", nullable = false)
    private String maskedDisplay;

    /** SHA-256 of the secret. The secret itself is shown once, at creation, and never stored. */
    @Column(name = "key_hash", length = 64)
    private String keyHash;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_used")
    private String lastUsed;

    /** Space-separated scopes, e.g. {@code ingest:checkins}. Empty means the key has no scopes. */
    @Column(nullable = false)
    @Builder.Default
    private String scopes = "";

    public Set<String> scopeSet() {
        if (scopes == null || scopes.isBlank()) return Set.of();
        return Arrays.stream(scopes.trim().split("\\s+")).collect(Collectors.toUnmodifiableSet());
    }

    @PrePersist
    void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.lastUsed == null) this.lastUsed = "never";
    }
}
