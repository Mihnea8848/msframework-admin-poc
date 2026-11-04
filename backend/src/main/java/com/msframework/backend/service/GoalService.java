package com.msframework.backend.service;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.GoalDtos;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.Goal;
import com.msframework.backend.entity.GoalCheckin;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.GoalCheckinRepository;
import com.msframework.backend.repository.GoalRepository;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Goals (department KPIs with a baseline and a target per quarter), their check-ins, and the
 * performance scores derived from them.
 *
 * <p><b>Attainment</b> of a goal is how far the latest value has moved from the baseline toward
 * the target, in percent, clamped to 0..120. For LOWER_IS_BETTER goals the target is below the
 * baseline, so falling values count as progress. A goal without check-ins has no attainment.</p>
 *
 * <p><b>Department score</b> for a quarter is the weighted average attainment of its goals that
 * have check-ins; null when none has.</p>
 */
@Service
@RequiredArgsConstructor
public class GoalService {

    public static final double MAX_ATTAINMENT = 120.0;
    public static final int TREND_MONTHS = 6;

    private final GoalRepository goalRepository;
    private final GoalCheckinRepository checkinRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    // ------------------------------------------------------------------ maths

    public static Double attainment(Goal.Direction direction, BigDecimal baseline, BigDecimal target, BigDecimal current) {
        if (current == null || baseline == null || target == null || baseline.compareTo(target) == 0) return null;
        BigDecimal progress;
        BigDecimal span;
        if (direction == Goal.Direction.LOWER_IS_BETTER) {
            progress = baseline.subtract(current);
            span = baseline.subtract(target);
        } else {
            progress = current.subtract(baseline);
            span = target.subtract(baseline);
        }
        double percent = progress.multiply(BigDecimal.valueOf(100)).divide(span, 4, RoundingMode.HALF_UP).doubleValue();
        return round1(Math.max(0.0, Math.min(MAX_ATTAINMENT, percent)));
    }

    public static Double attainment(Goal goal, BigDecimal current) {
        return attainment(goal.getDirection(), goal.getBaseline(), goal.getTarget(), current);
    }

    /** Weighted average of the attainments that are not null; null when all are. */
    public static Double weightedScore(List<Double> attainments, List<Integer> weights) {
        double sum = 0;
        double weightSum = 0;
        for (int i = 0; i < attainments.size(); i++) {
            Double a = attainments.get(i);
            if (a == null) continue;
            sum += a * weights.get(i);
            weightSum += weights.get(i);
        }
        return weightSum == 0 ? null : round1(sum / weightSum);
    }

    private static Double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    /** The latest check-in on or before {@code asOf} (null for no limit). */
    private static GoalCheckin latest(List<GoalCheckin> checkins, LocalDate asOf) {
        GoalCheckin best = null;
        for (GoalCheckin c : checkins) {
            if (asOf != null && c.getDate().isAfter(asOf)) continue;
            if (best == null || c.getDate().isAfter(best.getDate())
                    || (c.getDate().equals(best.getDate()) && c.getId() > best.getId())) {
                best = c;
            }
        }
        return best;
    }

    // ------------------------------------------------------------------ goals

    @Transactional(readOnly = true)
    public List<GoalDtos.GoalDto> list(Integer year, Integer quarter, Long departmentId, User actor) {
        FiscalPeriods.Quarter period = FiscalPeriods.resolve(year, quarter);
        List<Goal> goals = goalRepository.findByPeriod(period.year(), period.quarter()).stream()
                .filter(g -> departmentId == null || departmentId.equals(g.getDepartment().getId()))
                .toList();
        Map<Long, List<GoalCheckin>> checkins = checkinsByGoal(goals);
        return goals.stream()
                .sorted(Comparator.comparing((Goal g) -> g.getDepartment().getName(), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(Goal::getId))
                .map(g -> toDto(g, checkins.getOrDefault(g.getId(), List.of()), actor))
                .toList();
    }

    @Transactional(readOnly = true)
    public GoalDtos.GoalDto get(Long id, User actor) {
        Goal goal = requireGoal(id);
        return toDto(goal, checkinRepository.findByGoalIdOrderByDateDescIdDesc(id), actor);
    }

    @Transactional
    public GoalDtos.GoalDto create(GoalDtos.GoalRequest request, User actor) {
        Goal goal = new Goal();
        apply(goal, request, actor);
        goal.setCreatedBy(actor.getEmail());
        Goal saved = goalRepository.save(goal);
        auditService.log("goal_created", actor.getEmail(), "Goal created: " + describe(saved));
        return toDto(saved, List.of(), actor);
    }

    @Transactional
    public GoalDtos.GoalDto update(Long id, GoalDtos.GoalRequest request, User actor) {
        Goal goal = requireGoal(id);
        requireManage(actor, goal.getDepartment());
        apply(goal, request, actor);
        Goal saved = goalRepository.save(goal);
        auditService.log("goal_updated", actor.getEmail(), "Goal updated: " + describe(saved));
        return toDto(saved, checkinRepository.findByGoalIdOrderByDateDescIdDesc(id), actor);
    }

    @Transactional
    public void delete(Long id, User actor) {
        Goal goal = requireGoal(id);
        requireManage(actor, goal.getDepartment());
        long checkins = checkinRepository.countByGoalId(id);
        goalRepository.delete(goal);
        auditService.log("goal_deleted", actor.getEmail(), "Goal deleted: " + describe(goal)
                + (checkins > 0 ? " with " + checkins + " check-in(s)" : ""));
    }

    private void apply(Goal goal, GoalDtos.GoalRequest request, User actor) {
        if (request == null) throw ApiException.badRequest("Request body is required");
        Department department;
        if (request.departmentId() == null) {
            department = actor.getDepartment();
            if (department == null) throw ApiException.badRequest("Choose a department: you are not assigned to one");
        } else {
            department = departmentRepository.findById(request.departmentId())
                    .orElseThrow(() -> ApiException.badRequest("Department not found"));
        }
        requireManage(actor, department);

        String name = request.name() == null ? "" : request.name().trim().replaceAll("\\s+", " ");
        if (name.isEmpty()) throw ApiException.badRequest("Goal name is required");
        if (name.length() > 120) throw ApiException.badRequest("Goal name must be at most 120 characters");
        String unit = request.unit() == null ? "" : request.unit().trim();
        if (unit.isEmpty()) throw ApiException.badRequest("Unit is required (for example %, count, hours or EUR)");
        if (unit.length() > 20) throw ApiException.badRequest("Unit must be at most 20 characters");
        Goal.Direction direction = parseDirection(request.direction());
        BigDecimal baseline = Money.requireValue(request.baseline(), "Baseline");
        BigDecimal target = Money.requireValue(request.target(), "Target");
        if (direction == Goal.Direction.HIGHER_IS_BETTER && target.compareTo(baseline) <= 0) {
            throw ApiException.badRequest("When higher is better, the target must be above the baseline");
        }
        if (direction == Goal.Direction.LOWER_IS_BETTER && target.compareTo(baseline) >= 0) {
            throw ApiException.badRequest("When lower is better, the target must be below the baseline");
        }
        int weight = request.weight() == null ? 1 : request.weight();
        if (weight < 1 || weight > 100) throw ApiException.badRequest("Weight must be between 1 and 100");
        FiscalPeriods.Quarter period = FiscalPeriods.resolve(request.year(), request.quarter());
        if (request.year() != null && request.quarter() == null) FiscalPeriods.requireQuarter(null);
        User owner = null;
        if (request.ownerId() != null) {
            owner = userRepository.findById(request.ownerId())
                    .orElseThrow(() -> ApiException.badRequest("Owner not found"));
        }

        goal.setDepartment(department);
        goal.setName(name);
        goal.setDescription(BudgetService.optional(request.description(), 500, "Description"));
        goal.setUnit(unit);
        goal.setDirection(direction);
        goal.setBaseline(baseline);
        goal.setTarget(target);
        goal.setWeight(weight);
        goal.setYear(period.year());
        goal.setQuarter(period.quarter());
        goal.setOwner(owner);
    }

    private static Goal.Direction parseDirection(String raw) {
        if (raw == null || raw.isBlank()) throw ApiException.badRequest("Direction is required");
        try {
            return Goal.Direction.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Direction must be HIGHER_IS_BETTER or LOWER_IS_BETTER");
        }
    }

    private static void requireManage(User actor, Department department) {
        if (!actor.hasPermission(Permission.GOALS_MANAGE)) {
            throw ApiException.forbidden("You do not have permission to do this (GOALS_MANAGE)");
        }
        if (!BusinessAccess.canManageGoals(actor, department)) {
            throw ApiException.forbidden("You can only manage goals of your own department");
        }
    }

    public Goal requireGoal(Long id) {
        if (id == null) throw ApiException.badRequest("Goal is required");
        return goalRepository.findById(id).orElseThrow(() -> ApiException.notFound("Goal not found"));
    }

    private String describe(Goal goal) {
        return goal.getName() + " (" + goal.getDepartment().getName() + ", " + goal.getYear() + " Q" + goal.getQuarter() + ")";
    }

    // ------------------------------------------------------------------ check-ins

    @Transactional(readOnly = true)
    public List<GoalDtos.CheckinDto> checkins(Long goalId, User actor) {
        Goal goal = requireGoal(goalId);
        return checkinRepository.findByGoalIdOrderByDateDescIdDesc(goalId).stream()
                .map(c -> toDto(c, canDeleteCheckin(actor, goal, c)))
                .toList();
    }

    @Transactional
    public GoalDtos.CheckinDto addCheckin(Long goalId, GoalDtos.CheckinRequest request, User actor) {
        if (request == null) throw ApiException.badRequest("Request body is required");
        Goal goal = requireGoal(goalId);
        requireCheckIn(actor, goal);
        GoalCheckin saved = record(goal, request.date(), request.value(), request.note(), GoalCheckin.Source.UI,
                actor.getId(), actor.getEmail());
        auditService.log("checkin_recorded", actor.getEmail(), "Check-in for " + describe(goal) + ": "
                + saved.getValue().toPlainString() + " " + goal.getUnit());
        return toDto(saved, true);
    }

    @Transactional
    public void deleteCheckin(Long goalId, Long checkinId, User actor) {
        Goal goal = requireGoal(goalId);
        GoalCheckin checkin = checkinRepository.findById(checkinId)
                .filter(c -> c.getGoalId().equals(goalId))
                .orElseThrow(() -> ApiException.notFound("Check-in not found"));
        if (!canDeleteCheckin(actor, goal, checkin)) {
            throw ApiException.forbidden("Only the person who recorded it or a goal manager can delete this check-in");
        }
        checkinRepository.delete(checkin);
        auditService.log("checkin_deleted", actor.getEmail(), "Check-in of " + checkin.getDate() + " deleted from "
                + describe(goal));
    }

    public static void requireCheckIn(User actor, Goal goal) {
        if (!BusinessAccess.canCheckIn(actor, goal)) {
            throw ApiException.forbidden("You can only record check-ins for your own department's goals");
        }
    }

    private static boolean canDeleteCheckin(User actor, Goal goal, GoalCheckin checkin) {
        return BusinessAccess.canManageGoals(actor, goal.getDepartment())
                || Objects.equals(checkin.getRecordedById(), actor.getId());
    }

    /**
     * Validates and stores a check-in. Shared by the UI, the CSV import and the API-key ingest; it
     * starts no transaction of its own, so an invalid row of an import does not roll back the others.
     */
    public GoalCheckin record(Goal goal, LocalDate rawDate, BigDecimal rawValue, String note, GoalCheckin.Source source,
                              Long recordedById, String recordedBy) {
        LocalDate date = rawDate == null ? LocalDate.now() : rawDate;
        if (date.isAfter(LocalDate.now())) throw ApiException.badRequest("The check-in date cannot be in the future");
        FiscalPeriods.Quarter period = new FiscalPeriods.Quarter(goal.getYear(), goal.getQuarter());
        if (date.isBefore(period.start()) || date.isAfter(period.end())) {
            throw ApiException.badRequest("The check-in date must be inside the goal's quarter (" + period + ")");
        }
        BigDecimal value = Money.requireValue(rawValue, "Value");
        return checkinRepository.save(GoalCheckin.builder()
                .goalId(goal.getId())
                .date(date)
                .value(value)
                .note(BudgetService.optional(note, 500, "Note"))
                .source(source)
                .recordedById(recordedById)
                .recordedBy(recordedBy)
                .build());
    }

    // ------------------------------------------------------------------ performance

    @Transactional(readOnly = true)
    public GoalDtos.PerformanceOverview performance(Integer year, Integer quarter) {
        FiscalPeriods.Quarter period = FiscalPeriods.resolve(year, quarter);
        if (year != null && quarter == null) FiscalPeriods.requireQuarter(null);

        YearMonth last = YearMonth.from(period.end());
        YearMonth now = YearMonth.now();
        if (last.isAfter(now) && !YearMonth.from(period.start()).isAfter(now)) last = now;
        List<YearMonth> months = new ArrayList<>();
        for (int i = TREND_MONTHS - 1; i >= 0; i--) months.add(last.minusMonths(i));

        Map<FiscalPeriods.Quarter, List<Goal>> goalsByQuarter = new LinkedHashMap<>();
        goalsByQuarter.put(period, goalRepository.findByPeriod(period.year(), period.quarter()));
        for (YearMonth m : months) {
            FiscalPeriods.Quarter q = FiscalPeriods.of(m.atDay(1));
            goalsByQuarter.computeIfAbsent(q, k -> goalRepository.findByPeriod(k.year(), k.quarter()));
        }
        Map<Long, List<GoalCheckin>> checkins = checkinsByGoal(goalsByQuarter.values().stream()
                .flatMap(List::stream).toList());

        List<GoalDtos.DepartmentPerformance> result = new ArrayList<>();
        for (Department department : departmentRepository.findAllByOrderByIdAsc()) {
            List<Goal> goals = inDepartment(goalsByQuarter.get(period), department);
            List<GoalDtos.GoalAttainment> rows = new ArrayList<>();
            for (Goal g : goals) {
                GoalCheckin current = latest(checkins.getOrDefault(g.getId(), List.of()), null);
                BigDecimal value = current == null ? null : current.getValue();
                rows.add(new GoalDtos.GoalAttainment(g.getId(), g.getName(), g.getUnit(), g.getDirection().name(),
                        g.getBaseline(), g.getTarget(), g.getWeight(), value,
                        current == null ? null : current.getDate(), attainment(g, value)));
            }
            Double score = weightedScore(rows.stream().map(GoalDtos.GoalAttainment::attainment).toList(),
                    rows.stream().map(GoalDtos.GoalAttainment::weight).toList());
            int withData = (int) rows.stream().filter(r -> r.attainment() != null).count();

            List<GoalDtos.TrendPoint> trend = new ArrayList<>();
            for (YearMonth m : months) {
                List<Goal> monthGoals = inDepartment(goalsByQuarter.get(FiscalPeriods.of(m.atDay(1))), department);
                trend.add(new GoalDtos.TrendPoint(m.toString(), scoreAsOf(monthGoals, checkins, m.atEndOfMonth())));
            }
            result.add(new GoalDtos.DepartmentPerformance(department.getId(), department.getName(), department.getColor(),
                    score, goals.size(), withData, rows, trend));
        }
        return new GoalDtos.PerformanceOverview(period.year(), period.quarter(), result);
    }

    /** Score per department id for one quarter, as of now. Departments without data are absent. */
    @Transactional(readOnly = true)
    public Map<Long, Double> departmentScores(FiscalPeriods.Quarter period) {
        List<Goal> goals = goalRepository.findByPeriod(period.year(), period.quarter());
        Map<Long, List<GoalCheckin>> checkins = checkinsByGoal(goals);
        Map<Long, List<Goal>> byDepartment = goals.stream()
                .collect(Collectors.groupingBy(g -> g.getDepartment().getId()));
        Map<Long, Double> result = new HashMap<>();
        byDepartment.forEach((departmentId, list) -> {
            Double score = scoreAsOf(list, checkins, null);
            if (score != null) result.put(departmentId, score);
        });
        return result;
    }

    private static Double scoreAsOf(List<Goal> goals, Map<Long, List<GoalCheckin>> checkins, LocalDate asOf) {
        List<Double> attainments = new ArrayList<>();
        List<Integer> weights = new ArrayList<>();
        for (Goal g : goals) {
            GoalCheckin c = latest(checkins.getOrDefault(g.getId(), List.of()), asOf);
            attainments.add(c == null ? null : attainment(g, c.getValue()));
            weights.add(g.getWeight());
        }
        return weightedScore(attainments, weights);
    }

    private static List<Goal> inDepartment(List<Goal> goals, Department department) {
        if (goals == null) return List.of();
        return goals.stream().filter(g -> g.getDepartment().getId().equals(department.getId())).toList();
    }

    private Map<Long, List<GoalCheckin>> checkinsByGoal(List<Goal> goals) {
        if (goals.isEmpty()) return Map.of();
        return checkinRepository.findByGoalIdIn(goals.stream().map(Goal::getId).toList()).stream()
                .collect(Collectors.groupingBy(GoalCheckin::getGoalId));
    }

    // ------------------------------------------------------------------ mapping

    private GoalDtos.GoalDto toDto(Goal g, List<GoalCheckin> checkins, User actor) {
        GoalCheckin current = latest(checkins, null);
        BigDecimal value = current == null ? null : current.getValue();
        return new GoalDtos.GoalDto(g.getId(), g.getDepartment().getId(), g.getDepartment().getName(), g.getName(),
                g.getDescription(), g.getUnit(), g.getDirection().name(), g.getBaseline(), g.getTarget(), g.getWeight(),
                g.getYear(), g.getQuarter(),
                g.getOwner() != null ? g.getOwner().getId() : null,
                g.getOwner() != null ? g.getOwner().getFullName() : null,
                value, current == null ? null : current.getDate(), checkins.size(), attainment(g, value),
                BusinessAccess.canManageGoals(actor, g.getDepartment()), BusinessAccess.canCheckIn(actor, g),
                Times.toOffset(g.getCreatedAt()), Times.toOffset(g.getUpdatedAt()));
    }

    private static GoalDtos.CheckinDto toDto(GoalCheckin c, boolean canDelete) {
        return new GoalDtos.CheckinDto(c.getId(), c.getGoalId(), c.getDate(), c.getValue(), c.getNote(),
                c.getSource().name(), c.getRecordedBy(), Times.toOffset(c.getCreatedAt()), canDelete);
    }
}
