package com.msframework.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * A self-registration waiting for an administrator. Approving it creates the user with the stored
 * password hash; the hash is cleared once the request is decided.
 */
@Entity
@Table(name = "access_requests")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AccessRequest {

    public enum Status { PENDING, APPROVED, REJECTED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(nullable = false)
    private String email;

    private String phone;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(name = "password_hash")
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /** Email of the administrator who approved or rejected the request. */
    @Column(name = "decided_by")
    private String decidedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(length = 500)
    private String note;

    /** The account created on approval. */
    @Column(name = "user_id")
    private Long userId;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (status == null) status = Status.PENDING;
    }
}
