package com.msframework.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "audit_events")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "actor_email")
    private String actorEmail;

    @Column(nullable = false)
    private String description;

    /** The user the event is about (for the user's activity feed), if any. */
    @Column(name = "subject_user_id")
    private Long subjectUserId;

    /** The department the event is about (for the department's activity feed), if any. */
    @Column(name = "subject_department_id")
    private Long subjectDepartmentId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
