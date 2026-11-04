package com.msframework.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** One measured value of a goal's KPI. */
@Entity
@Table(name = "goal_checkins")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GoalCheckin {

    /** Where the value came from: the UI, a CSV import, or an integration through an API key. */
    public enum Source { UI, CSV, API }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "goal_id", nullable = false)
    private Long goalId;

    @Column(name = "checkin_date", nullable = false)
    private LocalDate date;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal value;

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Source source;

    @Column(name = "recorded_by_id")
    private Long recordedById;

    /** The recorder's email, or "API key: name" for integrations. */
    @Column(name = "recorded_by", nullable = false)
    private String recordedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
