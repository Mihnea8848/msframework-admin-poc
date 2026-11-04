package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.GoalDtos;
import com.msframework.backend.entity.User;
import com.msframework.backend.service.BusinessAccess;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.GoalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@Tag(name = "Goals", description = "Department goals (KPIs), their check-ins and the performance scores")
@RestController
@RequiredArgsConstructor
public class GoalController {

    private final GoalService goalService;
    private final CurrentUserService currentUserService;

    @Operation(operationId = "listGoals", summary = "Goals of one quarter with their latest value and attainment",
            description = "Defaults to the current quarter.")
    @GetMapping("/api/goals")
    public List<GoalDtos.GoalDto> list(@RequestParam(required = false) Integer year,
                                       @RequestParam(required = false) Integer quarter,
                                       @RequestParam(required = false) Long departmentId,
                                       Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.GOALS_READ);
        return goalService.list(year, quarter, departmentId, actor);
    }

    @Operation(operationId = "getGoal", summary = "One goal")
    @GetMapping("/api/goals/{id}")
    public GoalDtos.GoalDto get(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.GOALS_READ);
        return goalService.get(id, actor);
    }

    @Operation(operationId = "createGoal", summary = "Create a goal",
            description = "GOALS_MANAGE: admins for any department, managers for their own.")
    @ApiResponse(responseCode = "201", description = "Created")
    @PostMapping("/api/goals")
    public ResponseEntity<GoalDtos.GoalDto> create(@RequestBody GoalDtos.GoalRequest request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.GOALS_MANAGE);
        return ResponseEntity.status(HttpStatus.CREATED).body(goalService.create(request, actor));
    }

    @Operation(operationId = "updateGoal", summary = "Edit a goal")
    @PutMapping("/api/goals/{id}")
    public GoalDtos.GoalDto update(@PathVariable Long id, @RequestBody GoalDtos.GoalRequest request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.GOALS_MANAGE);
        return goalService.update(id, request, actor);
    }

    @Operation(operationId = "deleteGoal", summary = "Delete a goal and its check-ins")
    @ApiResponse(responseCode = "204", description = "Deleted")
    @DeleteMapping("/api/goals/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.GOALS_MANAGE);
        goalService.delete(id, actor);
        return ResponseEntity.noContent().build();
    }

    @Operation(operationId = "listGoalCheckins", summary = "Check-ins of a goal, newest first")
    @GetMapping("/api/goals/{id}/checkins")
    public List<GoalDtos.CheckinDto> checkins(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.GOALS_READ);
        return goalService.checkins(id, actor);
    }

    @Operation(operationId = "createGoalCheckin", summary = "Record a check-in",
            description = "Members and managers of the goal's department, and admins.")
    @ApiResponse(responseCode = "201", description = "Created")
    @PostMapping("/api/goals/{id}/checkins")
    public ResponseEntity<GoalDtos.CheckinDto> addCheckin(@PathVariable Long id, @RequestBody GoalDtos.CheckinRequest request,
                                                          Principal principal) {
        User actor = currentUserService.require(principal);
        BusinessAccess.requireAny(actor, Permission.GOALS_READ, Permission.GOALS_MANAGE);
        return ResponseEntity.status(HttpStatus.CREATED).body(goalService.addCheckin(id, request, actor));
    }

    @Operation(operationId = "deleteGoalCheckin", summary = "Delete a check-in",
            description = "The person who recorded it, or someone who manages the goal.")
    @ApiResponse(responseCode = "204", description = "Deleted")
    @DeleteMapping("/api/goals/{id}/checkins/{checkinId}")
    public ResponseEntity<Void> deleteCheckin(@PathVariable Long id, @PathVariable Long checkinId, Principal principal) {
        User actor = currentUserService.require(principal);
        BusinessAccess.requireAny(actor, Permission.GOALS_READ, Permission.GOALS_MANAGE);
        goalService.deleteCheckin(id, checkinId, actor);
        return ResponseEntity.noContent().build();
    }

    @Operation(operationId = "getPerformance", summary = "Department performance for a quarter",
            description = "Per department: the score (weighted average attainment of its goals with data), each goal's "
                    + "attainment, and a six-month trend. Defaults to the current quarter. GOALS_READ or REPORTS_READ.")
    @GetMapping("/api/performance")
    public GoalDtos.PerformanceOverview performance(@RequestParam(required = false) Integer year,
                                                    @RequestParam(required = false) Integer quarter,
                                                    Principal principal) {
        User actor = currentUserService.require(principal);
        BusinessAccess.requireAny(actor, Permission.GOALS_READ, Permission.REPORTS_READ);
        return goalService.performance(year, quarter);
    }
}
