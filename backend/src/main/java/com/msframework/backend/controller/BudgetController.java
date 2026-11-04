package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.FinanceDtos;
import com.msframework.backend.entity.User;
import com.msframework.backend.service.BudgetService;
import com.msframework.backend.service.CurrentUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@Tag(name = "Budgets", description = "Budget lines per department, quarter and category, and the expense categories")
@RestController
@RequiredArgsConstructor
public class BudgetController {

    private final BudgetService budgetService;
    private final CurrentUserService currentUserService;

    @Operation(operationId = "listBudgets", summary = "Budget lines with spent, committed and remaining amounts",
            description = "Defaults to the current quarter. Give only the year for all its quarters. Spent is APPROVED "
                    + "plus PAID expenses dated in the quarter, committed is SUBMITTED ones. Lines with a null id have "
                    + "spending but no budget.")
    @GetMapping("/api/budgets")
    public FinanceDtos.BudgetSummary list(@RequestParam(required = false) Integer year,
                                          @RequestParam(required = false) Integer quarter,
                                          @RequestParam(required = false) Long departmentId,
                                          Principal principal) {
        currentUserService.requirePermission(principal, Permission.FINANCE_READ);
        return budgetService.summary(year, quarter, departmentId);
    }

    @Operation(operationId = "getBudget", summary = "One budget line")
    @GetMapping("/api/budgets/{id}")
    public FinanceDtos.BudgetLine get(@PathVariable Long id, Principal principal) {
        currentUserService.requirePermission(principal, Permission.FINANCE_READ);
        return budgetService.get(id);
    }

    @Operation(operationId = "createBudget", summary = "Set a budget line",
            description = "One line per department, category and quarter; a second one is a conflict (409).")
    @ApiResponse(responseCode = "201", description = "Created")
    @PostMapping("/api/budgets")
    public ResponseEntity<FinanceDtos.BudgetLine> create(@RequestBody FinanceDtos.BudgetRequest request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.FINANCE_MANAGE);
        return ResponseEntity.status(HttpStatus.CREATED).body(budgetService.create(request, actor));
    }

    @Operation(operationId = "updateBudget", summary = "Change a budget line")
    @PutMapping("/api/budgets/{id}")
    public FinanceDtos.BudgetLine update(@PathVariable Long id, @RequestBody FinanceDtos.BudgetRequest request,
                                         Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.FINANCE_MANAGE);
        return budgetService.update(id, request, actor);
    }

    @Operation(operationId = "deleteBudget", summary = "Remove a budget line", description = "Expenses are kept.")
    @ApiResponse(responseCode = "204", description = "Deleted")
    @DeleteMapping("/api/budgets/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.FINANCE_MANAGE);
        budgetService.delete(id, actor);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ categories

    @Operation(operationId = "listExpenseCategories", summary = "Expense categories, by name",
            description = "Any signed-in user may read them (the expense form needs them).")
    @GetMapping("/api/finance/categories")
    public List<FinanceDtos.CategoryDto> categories(Principal principal) {
        currentUserService.require(principal);
        return budgetService.listCategories();
    }

    @Operation(operationId = "createExpenseCategory", summary = "Add an expense category")
    @ApiResponse(responseCode = "201", description = "Created")
    @PostMapping("/api/finance/categories")
    public ResponseEntity<FinanceDtos.CategoryDto> createCategory(@RequestBody FinanceDtos.CategoryRequest request,
                                                                  Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.FINANCE_MANAGE);
        return ResponseEntity.status(HttpStatus.CREATED).body(budgetService.createCategory(request, actor));
    }

    @Operation(operationId = "updateExpenseCategory", summary = "Rename, describe or (de)activate an expense category")
    @PutMapping("/api/finance/categories/{id}")
    public FinanceDtos.CategoryDto updateCategory(@PathVariable Long id, @RequestBody FinanceDtos.CategoryRequest request,
                                                  Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.FINANCE_MANAGE);
        return budgetService.updateCategory(id, request, actor);
    }

    @Operation(operationId = "deleteExpenseCategory", summary = "Delete an unused expense category",
            description = "A category with budget lines or expenses cannot be deleted (409); make it inactive instead.")
    @ApiResponse(responseCode = "204", description = "Deleted")
    @DeleteMapping("/api/finance/categories/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.FINANCE_MANAGE);
        budgetService.deleteCategory(id, actor);
        return ResponseEntity.noContent().build();
    }
}
