package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.FinanceDtos;
import com.msframework.backend.entity.User;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.ExpenseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDate;

/**
 * Expenses and their approval workflow. Department scoping and the "not your own expense" rule
 * live in ExpenseService / BusinessAccess.
 */
@Tag(name = "Expenses", description = "Expenses and their approval workflow")
@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
public class ExpenseController {

    private final ExpenseService expenseService;
    private final CurrentUserService currentUserService;

    @Operation(operationId = "listExpenses", summary = "Expenses the caller may see, newest first, one page",
            description = "FINANCE_READ sees every expense, approvers their department's and their own, everyone "
                    + "else their own. Dates filter on the expense date; q searches vendor, description and reference.")
    @GetMapping
    public FinanceDtos.ExpensePage list(
            @Parameter(description = "DRAFT, SUBMITTED, APPROVED, REJECTED or PAID") @RequestParam(required = false) String status,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long submitterId,
            @RequestParam(required = false) String q,
            @Parameter(description = "0-based") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "1 to 200") @RequestParam(defaultValue = "25") int size,
            Principal principal) {
        User actor = currentUserService.require(principal);
        return expenseService.list(ExpenseService.Filter.of(status, departmentId, categoryId, from, to, submitterId, q),
                page, size, actor);
    }

    @Operation(operationId = "getExpense", summary = "One expense")
    @GetMapping("/{id}")
    public FinanceDtos.ExpenseDto get(@PathVariable Long id, Principal principal) {
        return expenseService.get(id, currentUserService.require(principal));
    }

    @Operation(operationId = "createExpense", summary = "Create an expense as a draft, or submit it straight away",
            description = "Members file for their own department; FINANCE_MANAGE for any. When submitted, overBudget "
                    + "says whether it needs more than the remaining budget (allowed, but flagged).")
    @ApiResponse(responseCode = "201", description = "Created")
    @PostMapping
    public ResponseEntity<FinanceDtos.ExpenseDto> create(@RequestBody FinanceDtos.ExpenseRequest request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.EXPENSE_SUBMIT);
        return ResponseEntity.status(HttpStatus.CREATED).body(expenseService.create(request, actor));
    }

    @Operation(operationId = "updateExpense", summary = "Edit your own expense while it is a draft or submitted",
            description = "Editing a submitted expense keeps it submitted and re-checks the budget.")
    @PutMapping("/{id}")
    public FinanceDtos.ExpenseDto update(@PathVariable Long id, @RequestBody FinanceDtos.ExpenseRequest request,
                                         Principal principal) {
        return expenseService.update(id, request, currentUserService.require(principal));
    }

    @Operation(operationId = "submitExpense", summary = "Submit your draft for approval")
    @PostMapping("/{id}/submit")
    public FinanceDtos.ExpenseDto submit(@PathVariable Long id, Principal principal) {
        return expenseService.submit(id, currentUserService.require(principal));
    }

    @Operation(operationId = "approveExpense", summary = "Approve a submitted expense",
            description = "The department's approver (EXPENSE_APPROVE) or FINANCE_MANAGE; never your own expense.")
    @PostMapping("/{id}/approve")
    public FinanceDtos.ExpenseDto approve(@PathVariable Long id,
                                          @RequestBody(required = false) FinanceDtos.DecisionRequest request,
                                          Principal principal) {
        User actor = currentUserService.require(principal);
        return expenseService.approve(id, request == null ? null : request.note(), actor);
    }

    @Operation(operationId = "rejectExpense", summary = "Reject a submitted expense, with a reason",
            description = "Same people as approve. The note is required.")
    @PostMapping("/{id}/reject")
    public FinanceDtos.ExpenseDto reject(@PathVariable Long id, @RequestBody FinanceDtos.DecisionRequest request,
                                         Principal principal) {
        User actor = currentUserService.require(principal);
        return expenseService.reject(id, request == null ? null : request.note(), actor);
    }

    @Operation(operationId = "markExpensePaid", summary = "Mark an approved expense as paid (FINANCE_MANAGE)",
            description = "Records the payment; no money is moved. The body is optional.")
    @PostMapping("/{id}/pay")
    public FinanceDtos.ExpenseDto pay(@PathVariable Long id,
                                      @RequestBody(required = false) FinanceDtos.PaymentRequest request,
                                      Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.FINANCE_MANAGE);
        return expenseService.markPaid(id, request, actor);
    }

    @Operation(operationId = "deleteExpense", summary = "Delete a draft")
    @ApiResponse(responseCode = "204", description = "Deleted")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Principal principal) {
        expenseService.delete(id, currentUserService.require(principal));
        return ResponseEntity.noContent().build();
    }
}
