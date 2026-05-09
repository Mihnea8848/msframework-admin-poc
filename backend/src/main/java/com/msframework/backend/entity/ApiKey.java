package com.msframework.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

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

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_used")
    private String lastUsed;

    @PrePersist
    void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.lastUsed == null) this.lastUsed = "never";
    }
}
