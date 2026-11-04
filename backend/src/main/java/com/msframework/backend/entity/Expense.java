package com.msframework.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A spend request. It moves DRAFT → SUBMITTED → APPROVED → PAID (or SUBMITTED → REJECTED); the
 * rules live in ExpenseService. People are referenced by id and also copied by email, so deleting
 * a user (the id becomes null) never removes who submitted or decided an expense.
 */
@Entity
@Table(name = "expenses")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Expense {

    public enum Status { DRAFT, SUBMITTED, APPROVED, REJECTED, PAID }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private ExpenseCategory category;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(name = "expense_date", nullable = false)
    private LocalDate expenseDate;

    @Column(nullable = false, length = 120)
    private String vendor;

    @Column(length = 500)
    private String description;

    /** External reference, e.g. the supplier's invoice number. */
    @Column(length = 80)
    private String reference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    /** Set when the expense is submitted (or edited while submitted) and exceeds the remaining budget. */
    @Column(name = "over_budget", nullable = false)
    private boolean overBudget;

    @Column(name = "submitted_by_id")
    private Long submittedById;

    @Column(name = "submitted_by_email", nullable = false)
    private String submittedByEmail;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "decided_by_id")
    private Long decidedById;

    @Column(name = "decided_by_email")
    private String decidedByEmail;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "decision_note", length = 500)
    private String decisionNote;

    @Column(name = "paid_on")
    private LocalDate paidOn;

    @Column(name = "paid_by_email")
    private String paidByEmail;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "payment_reference", length = 80)
    private String paymentReference;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
