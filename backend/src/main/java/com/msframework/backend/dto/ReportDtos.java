package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** The reports overview. "Spent" is APPROVED plus PAID expenses; "committed" is SUBMITTED ones. */
public final class ReportDtos {

    private ReportDtos() {
    }

    @Schema(name = "ReportDepartmentSpend")
    public record DepartmentSpend(Long departmentId, String departmentName, String departmentColor, BigDecimal spent) {}

    @Schema(name = "ReportCategorySpend")
    public record CategorySpend(Long categoryId, String categoryName, BigDecimal spent) {}

    @Schema(name = "ReportBudgetVsSpend")
    public record BudgetVsSpend(
            Long departmentId,
            String departmentName,
            String departmentColor,
            @Schema(description = "Budget for the range: each quarter's budget times the share of its days in the range")
            BigDecimal budget,
            BigDecimal spent,
            BigDecimal committed,
            BigDecimal remaining,
            @Schema(description = "spent / budget in percent; null when there is no budget")
            Double utilisation
    ) {}

    @Schema(name = "ReportMonthSpend")
    public record MonthSpend(@Schema(example = "2026-05") String month, BigDecimal spent, BigDecimal committed) {}

    @Schema(name = "ReportDepartmentScore")
    public record DepartmentScore(Long departmentId, String departmentName, String departmentColor, Double score) {}

    @Schema(name = "ReportHeadcount", description = "Users per department; departmentId is null for unassigned users")
    public record Headcount(Long departmentId, String departmentName, long active, long total) {}

    @Schema(name = "ReportTotals")
    public record Totals(BigDecimal budget, BigDecimal spent, BigDecimal committed, BigDecimal remaining,
                         long activeHeadcount) {}

    @Schema(name = "ReportOverview")
    public record Overview(
            LocalDate from,
            LocalDate to,
            String currency,
            @Schema(description = "The quarter the performance scores are for: the one that contains 'to'")
            int performanceYear,
            int performanceQuarter,
            Totals totals,
            List<DepartmentSpend> spendByDepartment,
            List<CategorySpend> spendByCategory,
            List<BudgetVsSpend> budgetVsSpend,
            @Schema(description = "Every month in the range, oldest first, including empty ones")
            List<MonthSpend> monthlySpend,
            List<DepartmentScore> performance,
            List<Headcount> headcount
    ) {}
}
