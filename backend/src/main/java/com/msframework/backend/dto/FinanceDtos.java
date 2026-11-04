package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** Requests and responses of the budgets, expenses and payments API. Money is in the org currency. */
public final class FinanceDtos {

    private FinanceDtos() {
    }

    // ------------------------------------------------------------------ categories

    @Schema(name = "ExpenseCategory", description = "A spending category shared by budgets and expenses")
    public record CategoryDto(
            Long id,
            String name,
            String description,
            @Schema(description = "Inactive categories stay on old records but cannot be picked for new ones")
            boolean active,
            @Schema(description = "Budget lines plus expenses that use this category")
            long usageCount
    ) {}

    @Schema(name = "ExpenseCategoryRequest")
    public record CategoryRequest(
            @Schema(description = "Unique, at most 60 characters", requiredMode = Schema.RequiredMode.REQUIRED)
            String name,
            String description,
            @Schema(description = "Defaults to true")
            Boolean active
    ) {}

    // ------------------------------------------------------------------ budgets

    @Schema(name = "BudgetRequest", description = "One budget line: a department, a category and a quarter")
    public record BudgetRequest(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long departmentId,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long categoryId,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "2026") Integer year,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "1", maximum = "4") Integer quarter,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "12500.00") BigDecimal amount,
            String notes
    ) {}

    @Schema(name = "BudgetLine", description = "A budget line with what has been spent against it. "
            + "Lines with a null id have spending but no budget (amount 0).")
    public record BudgetLine(
            Long id,
            Long departmentId,
            String departmentName,
            String departmentColor,
            Long categoryId,
            String categoryName,
            int year,
            int quarter,
            BigDecimal amount,
            @Schema(description = "APPROVED plus PAID expenses dated in the quarter")
            BigDecimal spent,
            @Schema(description = "SUBMITTED expenses dated in the quarter")
            BigDecimal committed,
            @Schema(description = "amount - spent - committed (negative when over budget)")
            BigDecimal remaining,
            String currency,
            String notes,
            OffsetDateTime updatedAt
    ) {}

    @Schema(name = "MoneyTotals")
    public record Totals(BigDecimal budget, BigDecimal spent, BigDecimal committed, BigDecimal remaining) {}

    @Schema(name = "BudgetSummary")
    public record BudgetSummary(
            int year,
            @Schema(description = "Null when the whole year was asked for") Integer quarter,
            Long departmentId,
            String currency,
            List<BudgetLine> lines,
            Totals totals
    ) {}

    // ------------------------------------------------------------------ expenses

    @Schema(name = "ExpenseRequest", description = "Create or edit an expense")
    public record ExpenseRequest(
            @Schema(description = "Defaults to the caller's department") Long departmentId,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long categoryId,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "249.00") BigDecimal amount,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "When the money was spent; not in the future")
            LocalDate date,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 120) String vendor,
            @Schema(maxLength = 500) String description,
            @Schema(description = "Invoice number or other external reference", maxLength = 80) String reference,
            @Schema(description = "Create only: true submits it straight away instead of saving a draft")
            Boolean submit
    ) {}

    @Schema(name = "ExpenseDecisionRequest", description = "Approve (note optional) or reject (note required)")
    public record DecisionRequest(@Schema(maxLength = 500) String note) {}

    @Schema(name = "ExpensePaymentRequest", description = "Mark an approved expense as paid")
    public record PaymentRequest(
            @Schema(description = "Defaults to today; not in the future") LocalDate paidOn,
            @Schema(description = "Bank or transfer reference", maxLength = 80) String paymentReference
    ) {}

    @Schema(name = "ExpenseActions", description = "What the caller may do with this expense right now")
    public record Actions(boolean edit, boolean submit, boolean approve, boolean reject, boolean pay, boolean delete) {}

    @Schema(name = "Expense")
    public record ExpenseDto(
            Long id,
            Long departmentId,
            String departmentName,
            Long categoryId,
            String categoryName,
            BigDecimal amount,
            String currency,
            LocalDate date,
            String vendor,
            String description,
            String reference,
            @Schema(allowableValues = {"DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID"})
            String status,
            @Schema(description = "True when, at submission, the amount exceeded the remaining budget of its line")
            boolean overBudget,
            Long submittedById,
            String submittedByName,
            String submittedByEmail,
            OffsetDateTime submittedAt,
            String decidedByEmail,
            OffsetDateTime decidedAt,
            String decisionNote,
            LocalDate paidOn,
            String paidByEmail,
            String paymentReference,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            Actions actions
    ) {}

    @Schema(name = "ExpensePage")
    public record ExpensePage(
            List<ExpenseDto> items,
            int page,
            int size,
            long totalItems,
            int totalPages,
            @Schema(description = "Sum of every matching expense, not only this page")
            BigDecimal totalAmount,
            String currency
    ) {}

    // ------------------------------------------------------------------ payments

    @Schema(name = "Payment", description = "An outgoing payment: a PAID expense")
    public record PaymentDto(
            Long expenseId,
            LocalDate paidOn,
            BigDecimal amount,
            String currency,
            String vendor,
            String description,
            String reference,
            String paymentReference,
            Long departmentId,
            String departmentName,
            Long categoryId,
            String categoryName,
            String submittedByEmail,
            String paidByEmail
    ) {}

    @Schema(name = "PaymentMonth")
    public record PaymentMonth(@Schema(example = "2026-05") String month, BigDecimal total, long count) {}

    @Schema(name = "PaymentProvider", description = "No payment provider is connected: payments are recorded, not sent")
    public record Provider(boolean connected, String note) {}

    @Schema(name = "PaymentLedger")
    public record PaymentLedger(
            LocalDate from,
            LocalDate to,
            String currency,
            BigDecimal totalAmount,
            long count,
            @Schema(description = "Every month in the range, oldest first, including empty ones")
            List<PaymentMonth> months,
            @Schema(description = "This page of payments, newest first")
            List<PaymentDto> items,
            int page,
            int size,
            int totalPages,
            Provider provider
    ) {}
}
