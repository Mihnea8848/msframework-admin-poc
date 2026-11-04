package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** Requests and responses of the goals, check-ins and performance API. */
public final class GoalDtos {

    private GoalDtos() {
    }

    @Schema(name = "GoalRequest", description = "Create or edit a goal (a KPI with a target for one quarter)")
    public record GoalRequest(
            @Schema(description = "Defaults to the caller's department") Long departmentId,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 120) String name,
            @Schema(maxLength = 500) String description,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 20,
                    description = "Free text, e.g. %, count, hours, days, EUR, score")
            String unit,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"HIGHER_IS_BETTER", "LOWER_IS_BETTER"})
            String direction,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Where the quarter starts")
            BigDecimal baseline,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                    description = "Above the baseline when higher is better, below it when lower is better")
            BigDecimal target,
            @Schema(description = "1 to 100, default 1. Weights the goal in the department score")
            Integer weight,
            @Schema(description = "Defaults to the current year") Integer year,
            @Schema(description = "Defaults to the current quarter") Integer quarter,
            Long ownerId
    ) {}

    @Schema(name = "Goal")
    public record GoalDto(
            Long id,
            Long departmentId,
            String departmentName,
            String name,
            String description,
            String unit,
            String direction,
            BigDecimal baseline,
            BigDecimal target,
            int weight,
            int year,
            int quarter,
            Long ownerId,
            String ownerName,
            @Schema(description = "Value of the latest check-in; null when there is none")
            BigDecimal currentValue,
            LocalDate lastCheckinDate,
            long checkinCount,
            @Schema(description = "Progress from baseline to target in percent, clamped to 0..120; null without check-ins")
            Double attainment,
            @Schema(description = "The caller may edit or delete the goal")
            boolean canEdit,
            @Schema(description = "The caller may record check-ins")
            boolean canCheckIn,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {}

    @Schema(name = "CheckinRequest")
    public record CheckinRequest(
            @Schema(description = "Defaults to today. Must be inside the goal's quarter and not in the future")
            LocalDate date,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal value,
            @Schema(maxLength = 500) String note
    ) {}

    @Schema(name = "GoalCheckin")
    public record CheckinDto(
            Long id,
            Long goalId,
            LocalDate date,
            BigDecimal value,
            String note,
            @Schema(allowableValues = {"UI", "CSV", "API"}) String source,
            @Schema(description = "Email of the person, or \"API key: name\" for integrations")
            String recordedBy,
            OffsetDateTime createdAt,
            @Schema(description = "The caller may delete this check-in")
            boolean canDelete
    ) {}

    @Schema(name = "GoalAttainment")
    public record GoalAttainment(
            Long goalId,
            String name,
            String unit,
            String direction,
            BigDecimal baseline,
            BigDecimal target,
            int weight,
            BigDecimal currentValue,
            LocalDate lastCheckinDate,
            Double attainment
    ) {}

    @Schema(name = "PerformanceTrendPoint")
    public record TrendPoint(
            @Schema(example = "2026-06") String month,
            @Schema(description = "Department score at the end of the month; null when no goal had data")
            Double score
    ) {}

    @Schema(name = "DepartmentPerformance")
    public record DepartmentPerformance(
            Long departmentId,
            String departmentName,
            String departmentColor,
            @Schema(description = "Weighted average attainment of the goals that have check-ins; null when none")
            Double score,
            int goalCount,
            int goalsWithData,
            List<GoalAttainment> goals,
            @Schema(description = "Six monthly scores, oldest first, ending with the quarter's last month (or this month)")
            List<TrendPoint> trend
    ) {}

    @Schema(name = "PerformanceOverview")
    public record PerformanceOverview(int year, int quarter, List<DepartmentPerformance> departments) {}
}
