package com.msframework.backend.service;

import com.msframework.backend.config.FinanceSettings;
import com.msframework.backend.dto.FinanceDtos;
import com.msframework.backend.entity.Budget;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.ExpenseCategory;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.BudgetRepository;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.ExpenseCategoryRepository;
import com.msframework.backend.repository.ExpenseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Expense categories and budget lines. A budget line is the amount a department may spend in one
 * category during one quarter; what was spent against it comes from {@link SpendLedger}.
 * Write access (FINANCE_MANAGE) is checked by the controller.
 */
@Service
@RequiredArgsConstructor
public class BudgetService {

    private final BudgetRepository budgetRepository;
    private final ExpenseCategoryRepository categoryRepository;
    private final ExpenseRepository expenseRepository;
    private final DepartmentRepository departmentRepository;
    private final SpendLedger ledger;
    private final FinanceSettings finance;
    private final AuditService auditService;
    private final JdbcTemplate jdbc;

    // ------------------------------------------------------------------ categories

    @Transactional(readOnly = true)
    public List<FinanceDtos.CategoryDto> listCategories() {
        Map<Long, Long> usage = new HashMap<>();
        jdbc.query("SELECT category_id, COUNT(*) FROM (SELECT category_id FROM budgets "
                        + "UNION ALL SELECT category_id FROM expenses) used GROUP BY category_id",
                rs -> {
                    usage.put(rs.getLong(1), rs.getLong(2));
                });
        return categoryRepository.findAllByOrderByNameAsc().stream()
                .map(c -> new FinanceDtos.CategoryDto(c.getId(), c.getName(), c.getDescription(), c.isActive(),
                        usage.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    @Transactional
    public FinanceDtos.CategoryDto createCategory(FinanceDtos.CategoryRequest request, User actor) {
        String name = requireCategoryName(request.name());
        ensureCategoryNameFree(name, null);
        ExpenseCategory saved = categoryRepository.save(ExpenseCategory.builder()
                .name(name)
                .description(optional(request.description(), 255, "Description"))
                .active(request.active() == null || request.active())
                .build());
        auditService.log("category_created", actor.getEmail(), "Expense category created: " + name);
        return new FinanceDtos.CategoryDto(saved.getId(), saved.getName(), saved.getDescription(), saved.isActive(), 0);
    }

    @Transactional
    public FinanceDtos.CategoryDto updateCategory(Long id, FinanceDtos.CategoryRequest request, User actor) {
        ExpenseCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Category not found"));
        String name = requireCategoryName(request.name());
        ensureCategoryNameFree(name, id);
        String oldName = category.getName();
        category.setName(name);
        category.setDescription(optional(request.description(), 255, "Description"));
        if (request.active() != null) category.setActive(request.active());
        categoryRepository.save(category);
        auditService.log("category_updated", actor.getEmail(), oldName.equals(name)
                ? "Expense category updated: " + name + (category.isActive() ? "" : " (inactive)")
                : "Expense category renamed: " + oldName + " → " + name);
        long usage = budgetRepository.countByCategoryId(id) + expenseRepository.countByCategoryId(id);
        return new FinanceDtos.CategoryDto(category.getId(), name, category.getDescription(), category.isActive(), usage);
    }

    @Transactional
    public void deleteCategory(Long id, User actor) {
        ExpenseCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Category not found"));
        long usage = budgetRepository.countByCategoryId(id) + expenseRepository.countByCategoryId(id);
        if (usage > 0) {
            throw ApiException.conflict("\"" + category.getName() + "\" is used by " + usage
                    + " budget line(s) or expense(s). Make it inactive instead.");
        }
        categoryRepository.delete(category);
        auditService.log("category_deleted", actor.getEmail(), "Expense category deleted: " + category.getName());
    }

    /** A category that new budgets and expenses may use. */
    public ExpenseCategory requireActiveCategory(Long id) {
        if (id == null) throw ApiException.badRequest("Category is required");
        ExpenseCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> ApiException.badRequest("Category not found"));
        if (!category.isActive()) {
            throw ApiException.badRequest("The category \"" + category.getName() + "\" is no longer in use");
        }
        return category;
    }

    private static String requireCategoryName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (name.isEmpty()) throw ApiException.badRequest("Category name is required");
        if (name.length() > 60) throw ApiException.badRequest("Category name must be at most 60 characters");
        return name;
    }

    private void ensureCategoryNameFree(String name, Long exceptId) {
        categoryRepository.findByNameIgnoreCase(name)
                .filter(c -> !c.getId().equals(exceptId))
                .ifPresent(c -> {
                    throw ApiException.conflict("A category named \"" + c.getName() + "\" already exists");
                });
    }

    // ------------------------------------------------------------------ budget lines

    /**
     * Budget lines of one quarter, or of every quarter of the year when {@code quarter} is null,
     * with spent, committed and remaining amounts.
     */
    @Transactional(readOnly = true)
    public FinanceDtos.BudgetSummary summary(Integer year, Integer quarter, Long departmentId) {
        FiscalPeriods.Quarter resolved = FiscalPeriods.resolve(year, quarter);
        boolean wholeYear = year != null && quarter == null;
        LocalDate from = wholeYear ? LocalDate.of(resolved.year(), 1, 1) : resolved.start();
        LocalDate to = wholeYear ? LocalDate.of(resolved.year(), 12, 31) : resolved.end();
        List<FinanceDtos.BudgetLine> lines = lines(from, to, departmentId);
        return new FinanceDtos.BudgetSummary(resolved.year(), wholeYear ? null : resolved.quarter(),
                departmentId, finance.currency(), lines, totals(lines));
    }

    /**
     * Every budget line of the quarters that overlap [from, to], plus a line with a zero budget
     * for each department and category that has spending but no budget. Amounts cover whole quarters.
     */
    @Transactional(readOnly = true)
    public List<FinanceDtos.BudgetLine> lines(LocalDate from, LocalDate to, Long departmentId) {
        List<FiscalPeriods.Quarter> quarters = FiscalPeriods.quartersBetween(from, to);
        FiscalPeriods.Quarter first = quarters.getFirst();
        FiscalPeriods.Quarter last = quarters.getLast();
        Set<FiscalPeriods.Quarter> wanted = new HashSet<>(quarters);

        Map<SpendLedger.Line, SpendLedger.Spend> spend = ledger.byLine(first.start(), last.end(), null);
        Map<Long, Department> departments = new HashMap<>();
        departmentRepository.findAll().forEach(d -> departments.put(d.getId(), d));
        Map<Long, ExpenseCategory> categories = new HashMap<>();
        categoryRepository.findAll().forEach(c -> categories.put(c.getId(), c));

        List<FinanceDtos.BudgetLine> result = new ArrayList<>();
        Set<SpendLedger.Line> budgeted = new HashSet<>();
        for (Budget budget : budgetRepository.findByYearBetween(first.year(), last.year())) {
            if (!wanted.contains(new FiscalPeriods.Quarter(budget.getYear(), budget.getQuarter()))) continue;
            if (departmentId != null && !departmentId.equals(budget.getDepartment().getId())) continue;
            SpendLedger.Line key = new SpendLedger.Line(budget.getDepartment().getId(), budget.getCategory().getId(),
                    budget.getYear(), budget.getQuarter());
            budgeted.add(key);
            result.add(line(budget.getId(), budget.getDepartment(), budget.getCategory(), budget.getYear(),
                    budget.getQuarter(), budget.getAmount(), spend.getOrDefault(key, SpendLedger.Spend.NONE),
                    budget.getNotes(), Times.toOffset(budget.getUpdatedAt())));
        }
        spend.forEach((key, value) -> {
            if (budgeted.contains(key)) return;
            if (!wanted.contains(new FiscalPeriods.Quarter(key.year(), key.quarter()))) return;
            if (departmentId != null && departmentId != key.departmentId()) return;
            if (value.total().signum() == 0) return;
            result.add(line(null, departments.get(key.departmentId()), categories.get(key.categoryId()),
                    key.year(), key.quarter(), BigDecimal.ZERO, value, null, null));
        });
        result.sort(Comparator.comparing(FinanceDtos.BudgetLine::year)
                .thenComparing(FinanceDtos.BudgetLine::quarter)
                .thenComparing(FinanceDtos.BudgetLine::departmentName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                .thenComparing(FinanceDtos.BudgetLine::categoryName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
        return result;
    }

    private FinanceDtos.BudgetLine line(Long id, Department department, ExpenseCategory category, int year, int quarter,
                                        BigDecimal amount, SpendLedger.Spend spend, String notes,
                                        java.time.OffsetDateTime updatedAt) {
        BigDecimal budget = Money.zeroIfNull(amount);
        return new FinanceDtos.BudgetLine(id,
                department != null ? department.getId() : null,
                department != null ? department.getName() : null,
                department != null ? department.getColor() : null,
                category != null ? category.getId() : null,
                category != null ? category.getName() : null,
                year, quarter, budget, Money.zeroIfNull(spend.spent()), Money.zeroIfNull(spend.committed()),
                budget.subtract(spend.spent()).subtract(spend.committed()).setScale(2),
                finance.currency(), notes, updatedAt);
    }

    public static FinanceDtos.Totals totals(List<FinanceDtos.BudgetLine> lines) {
        BigDecimal budget = BigDecimal.ZERO.setScale(2);
        BigDecimal spent = BigDecimal.ZERO.setScale(2);
        BigDecimal committed = BigDecimal.ZERO.setScale(2);
        for (FinanceDtos.BudgetLine line : lines) {
            budget = budget.add(line.amount());
            spent = spent.add(line.spent());
            committed = committed.add(line.committed());
        }
        return new FinanceDtos.Totals(budget, spent, committed, budget.subtract(spent).subtract(committed));
    }

    /**
     * What is left on the budget line of this department, category and quarter, not counting the
     * given expense. A line without a budget has nothing left.
     */
    public BigDecimal remaining(Department department, ExpenseCategory category, FiscalPeriods.Quarter quarter,
                                Long excludeExpenseId) {
        BigDecimal budget = budgetRepository.findLine(department.getId(), category.getId(), quarter.year(), quarter.quarter())
                .map(Budget::getAmount)
                .orElse(BigDecimal.ZERO);
        SpendLedger.Spend spend = ledger.forLine(department.getId(), category.getId(), quarter, excludeExpenseId);
        return budget.subtract(spend.total());
    }

    @Transactional(readOnly = true)
    public FinanceDtos.BudgetLine get(Long id) {
        Budget budget = requireBudget(id);
        return toLine(budget);
    }

    @Transactional
    public FinanceDtos.BudgetLine create(FinanceDtos.BudgetRequest request, User actor) {
        Budget budget = validate(new Budget(), request);
        budget.setCurrency(finance.currency());
        budget.setCreatedBy(actor.getEmail());
        Budget saved = budgetRepository.save(budget);
        auditService.log("budget_created", actor.getEmail(), "Budget set: " + describe(saved));
        return toLine(saved);
    }

    @Transactional
    public FinanceDtos.BudgetLine update(Long id, FinanceDtos.BudgetRequest request, User actor) {
        Budget budget = requireBudget(id);
        BigDecimal before = budget.getAmount();
        validate(budget, request);
        Budget saved = budgetRepository.save(budget);
        auditService.log("budget_updated", actor.getEmail(), "Budget changed: " + describe(saved)
                + (before.compareTo(saved.getAmount()) != 0 ? " (was " + before.toPlainString() + ")" : ""));
        return toLine(saved);
    }

    @Transactional
    public void delete(Long id, User actor) {
        Budget budget = requireBudget(id);
        budgetRepository.delete(budget);
        auditService.log("budget_deleted", actor.getEmail(), "Budget removed: " + describe(budget));
    }

    /** Validates a request onto the entity. Used by the API and the CSV import. */
    public Budget validate(Budget budget, FinanceDtos.BudgetRequest request) {
        if (request == null) throw ApiException.badRequest("Request body is required");
        if (request.departmentId() == null) throw ApiException.badRequest("Department is required");
        Department department = departmentRepository.findById(request.departmentId())
                .orElseThrow(() -> ApiException.badRequest("Department not found"));
        ExpenseCategory category = Objects.equals(budget.getCategory() == null ? null : budget.getCategory().getId(),
                request.categoryId()) ? budget.getCategory() : requireActiveCategory(request.categoryId());
        int year = FiscalPeriods.requireYear(request.year());
        int quarter = FiscalPeriods.requireQuarter(request.quarter());
        BigDecimal amount = Money.requireNonNegative(request.amount(), "Amount");

        budgetRepository.findLine(department.getId(), category.getId(), year, quarter)
                .filter(other -> !other.getId().equals(budget.getId()))
                .ifPresent(other -> {
                    throw ApiException.conflict("A budget for " + department.getName() + " / " + category.getName()
                            + " in " + year + " Q" + quarter + " already exists");
                });

        budget.setDepartment(department);
        budget.setCategory(category);
        budget.setYear(year);
        budget.setQuarter(quarter);
        budget.setAmount(amount);
        budget.setNotes(optional(request.notes(), 255, "Notes"));
        return budget;
    }

    private Budget requireBudget(Long id) {
        return budgetRepository.findById(id).orElseThrow(() -> ApiException.notFound("Budget not found"));
    }

    private FinanceDtos.BudgetLine toLine(Budget budget) {
        FiscalPeriods.Quarter quarter = new FiscalPeriods.Quarter(budget.getYear(), budget.getQuarter());
        SpendLedger.Spend spend = ledger.forLine(budget.getDepartment().getId(), budget.getCategory().getId(), quarter, null);
        return line(budget.getId(), budget.getDepartment(), budget.getCategory(), budget.getYear(), budget.getQuarter(),
                budget.getAmount(), spend, budget.getNotes(), Times.toOffset(budget.getUpdatedAt()));
    }

    private String describe(Budget budget) {
        return budget.getDepartment().getName() + " / " + budget.getCategory().getName() + " " + budget.getYear()
                + " Q" + budget.getQuarter() + " = " + budget.getAmount().toPlainString() + " " + finance.currency();
    }

    static String optional(String raw, int max, String field) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();
        if (value.length() > max) throw ApiException.badRequest(field + " must be at most " + max + " characters");
        return value;
    }
}
