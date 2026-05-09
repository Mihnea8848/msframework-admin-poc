package com.msframework.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "webhooks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Webhook {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String url;

    @Column(columnDefinition = "TEXT")
    private String events;

    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_triggered")
    private String lastTriggered;

    @PrePersist
    void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.lastTriggered == null) this.lastTriggered = "never";
    }
}
