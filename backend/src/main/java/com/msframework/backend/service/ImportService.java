package com.msframework.backend.service;

import com.msframework.backend.config.FinanceSettings;
import com.msframework.backend.config.SystemRoles;
import com.msframework.backend.dto.FinanceDtos;
import com.msframework.backend.dto.ImportRequests;
import com.msframework.backend.dto.ImportResult;
import com.msframework.backend.entity.Budget;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.Expense;
import com.msframework.backend.entity.ExpenseCategory;
import com.msframework.backend.entity.Goal;
import com.msframework.backend.entity.GoalCheckin;
import com.msframework.backend.entity.Role;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.BudgetRepository;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.ExpenseCategoryRepository;
import com.msframework.backend.repository.ExpenseRepository;
import com.msframework.backend.repository.GoalRepository;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Bulk import of rows parsed from CSV by the frontend. Every row is validated first; valid rows are
 * created, invalid ones are reported back with their row number and skipped.
 */
@Service
@RequiredArgsConstructor
public class ImportService {

    public static final int MAX_ROWS = 1000;

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final ExpenseCategoryRepository categoryRepository;
    private final ExpenseRepository expenseRepository;
    private final BudgetRepository budgetRepository;
    private final GoalRepository goalRepository;
    private final BudgetService budgetService;
    private final ExpenseService expenseService;
    private final GoalService goalService;
    private final FinanceSettings financeSettings;

    @Transactional
    public ImportResult importDepartments(List<ImportRequests.DepartmentRow> rows, User actor) {
        requireRows(rows);
        List<ImportResult.RowError> errors = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int created = 0;

        for (int i = 0; i < rows.size(); i++) {
            ImportRequests.DepartmentRow row = rows.get(i);
            int rowNumber = i + 1;
            try {
                String name = DepartmentRules.requireName(row == null ? null : row.name());
                String color = DepartmentRules.normalizeColor(row == null ? null : row.color());
                String key = name.toLowerCase(Locale.ROOT);
                if (!seen.add(key) || departmentRepository.findByNameIgnoreCase(name).isPresent()) {
                    throw ApiException.conflict("Department \"" + name + "\" already exists");
                }
                departmentRepository.save(Department.builder().name(name).color(color).build());
                created++;
            } catch (ApiException e) {
                errors.add(new ImportResult.RowError(rowNumber, e.getMessage()));
            }
        }

        auditService.log("import_completed", actor.getEmail(),
                "Imported " + created + " department(s) from CSV (" + errors.size() + " skipped)");
        return new ImportResult(created, errors.size(), errors);
    }

    /**
     * Imported users get a random password; they set their own through "Forgot password".
     */
    @Transactional
    public ImportResult importUsers(List<ImportRequests.UserRow> rows, User actor) {
        requireRows(rows);
        Map<String, Department> departmentsByName = new HashMap<>();
        departmentRepository.findAll().forEach(d -> departmentsByName.put(d.getName().toLowerCase(Locale.ROOT), d));

        List<ImportResult.RowError> errors = new ArrayList<>();
        Set<String> seenEmails = new HashSet<>();
        boolean actorIsAdmin = actor.hasRole(SystemRoles.ADMIN);
        int created = 0;

        for (int i = 0; i < rows.size(); i++) {
            ImportRequests.UserRow row = rows.get(i);
            int rowNumber = i + 1;
            try {
                if (row == null) throw ApiException.badRequest("Empty row");
                String fullName = UserService.requireFullName(row.fullName());
                String email = UserService.requireValidEmail(row.email());
                String phone = UserService.normalizePhone(row.phone(), false);
                Role role = userService.requireRole(row.role());
                String status = UserService.requireStatus(row.status());

                if (!actorIsAdmin && SystemRoles.isPrivileged(role.getName())) {
                    throw ApiException.forbidden("Only admins can assign the " + role.getName() + " role");
                }

                Department department = null;
                if (row.department() != null && !row.department().isBlank()) {
                    department = departmentsByName.get(row.department().trim().toLowerCase(Locale.ROOT));
                    if (department == null) {
                        throw ApiException.badRequest("Unknown department \"" + row.department().trim() + "\"");
                    }
                }

                if (!seenEmails.add(email) || userService.isEmailTaken(email, null)) {
                    throw ApiException.conflict("Email " + email + " is already in use");
                }

                userRepository.save(User.builder()
                        .fullName(fullName)
                        .email(email)
                        .phone(phone)
                        .password(passwordEncoder.encode(SecureTokens.random(24)))
                        .status(status)
                        .department(department)
                        .roles(new HashSet<>(Set.of(role)))
                        .build());
                created++;
            } catch (ApiException e) {
                errors.add(new ImportResult.RowError(rowNumber, e.getMessage()));
            }
        }

        auditService.log("import_completed", actor.getEmail(),
                "Imported " + created + " user(s) from CSV (" + errors.size() + " skipped)");
        return new ImportResult(created, errors.size(), errors);
    }

    // ------------------------------------------------------------------ business data

    /**
     * Imports expenses, e.g. from the accounting system. Rows may already be approved or paid: the
     * importer is recorded as the one who decided, with the note "Imported from CSV".
     */
    @Transactional
    public ImportResult importExpenses(List<ImportRequests.ExpenseRow> rows, User actor) {
        requireRows(rows);
        Map<String, Department> departments = departmentsByName();
        Map<String, ExpenseCategory> categories = categoriesByName();
        List<ImportResult.RowError> errors = new ArrayList<>();
        int created = 0;

        for (int i = 0; i < rows.size(); i++) {
            ImportRequests.ExpenseRow row = rows.get(i);
            try {
                if (row == null) throw ApiException.badRequest("Empty row");
                Department department = lookup(departments, row.department(), "department");
                ExpenseCategory category = lookup(categories, row.category(), "category");
                if (!category.isActive()) {
                    throw ApiException.badRequest("The category \"" + category.getName() + "\" is no longer in use");
                }
                BigDecimal amount = Money.requirePositive(Money.parse(row.amount(), "Amount"), "Amount");
                LocalDate date = ExpenseService.requireDate(parseDate(row.date(), "Date", false));
                String vendor = BudgetService.optional(row.vendor(), 120, "Vendor");
                if (vendor == null) throw ApiException.badRequest("Vendor is required");
                Expense.Status status = row.status() == null || row.status().isBlank()
                        ? Expense.Status.SUBMITTED : ExpenseService.parseStatus(row.status());
                if (status == Expense.Status.REJECTED) {
                    throw ApiException.badRequest("Rejected expenses cannot be imported");
                }
                User submitter = actor;
                if (row.submitterEmail() != null && !row.submitterEmail().isBlank()) {
                    submitter = userRepository.findByEmailIgnoreCase(row.submitterEmail().trim())
                            .orElseThrow(() -> ApiException.badRequest("Unknown submitter " + row.submitterEmail().trim()));
                }

                LocalDateTime now = LocalDateTime.now();
                Expense expense = Expense.builder()
                        .department(department)
                        .category(category)
                        .amount(amount)
                        .currency(financeSettings.currency())
                        .expenseDate(date)
                        .vendor(vendor)
                        .description(BudgetService.optional(row.description(), 500, "Description"))
                        .reference(BudgetService.optional(row.reference(), 80, "Reference"))
                        .status(status)
                        .submittedById(submitter.getId())
                        .submittedByEmail(submitter.getEmail())
                        .submittedAt(status == Expense.Status.DRAFT ? null : now)
                        .build();
                if (status == Expense.Status.APPROVED || status == Expense.Status.PAID) {
                    expense.setDecidedById(actor.getId());
                    expense.setDecidedByEmail(actor.getEmail());
                    expense.setDecidedAt(now);
                    expense.setDecisionNote("Imported from CSV");
                }
                if (status == Expense.Status.PAID) {
                    expense.setPaidOn(date);
                    expense.setPaidAt(now);
                    expense.setPaidByEmail(actor.getEmail());
                }
                expense = expenseRepository.saveAndFlush(expense);
                if (status != Expense.Status.DRAFT) {
                    expense.setOverBudget(expenseService.isOverBudget(expense));
                    expenseRepository.saveAndFlush(expense);
                }
                created++;
            } catch (ApiException e) {
                errors.add(new ImportResult.RowError(i + 1, e.getMessage()));
            }
        }

        auditService.log("import_completed", actor.getEmail(),
                "Imported " + created + " expense(s) from CSV (" + errors.size() + " skipped)");
        return new ImportResult(created, errors.size(), errors);
    }

    @Transactional
    public ImportResult importBudgets(List<ImportRequests.BudgetRow> rows, User actor) {
        requireRows(rows);
        Map<String, Department> departments = departmentsByName();
        Map<String, ExpenseCategory> categories = categoriesByName();
        List<ImportResult.RowError> errors = new ArrayList<>();
        int created = 0;

        for (int i = 0; i < rows.size(); i++) {
            ImportRequests.BudgetRow row = rows.get(i);
            try {
                if (row == null) throw ApiException.badRequest("Empty row");
                Department department = lookup(departments, row.department(), "department");
                ExpenseCategory category = lookup(categories, row.category(), "category");
                Integer year = parseInt(row.year(), "Year");
                String q = row.quarter() == null ? "" : row.quarter().trim();
                if (q.toUpperCase(Locale.ROOT).startsWith("Q")) q = q.substring(1);
                Integer quarter = parseInt(q, "Quarter");
                FinanceDtos.BudgetRequest request = new FinanceDtos.BudgetRequest(department.getId(), category.getId(),
                        year, quarter, Money.parse(row.amount(), "Amount"), row.notes());
                Budget budget = budgetService.validate(new Budget(), request);
                budget.setCurrency(financeSettings.currency());
                budget.setCreatedBy(actor.getEmail());
                budgetRepository.saveAndFlush(budget);
                created++;
            } catch (ApiException e) {
                errors.add(new ImportResult.RowError(i + 1, e.getMessage()));
            }
        }

        auditService.log("import_completed", actor.getEmail(),
                "Imported " + created + " budget line(s) from CSV (" + errors.size() + " skipped)");
        return new ImportResult(created, errors.size(), errors);
    }

    /** Check-ins for goals; every row needs the same rights as recording it in the UI. */
    @Transactional
    public ImportResult importCheckins(List<ImportRequests.CheckinRow> rows, User actor) {
        requireRows(rows);
        Map<String, Department> departments = departmentsByName();
        List<ImportResult.RowError> errors = new ArrayList<>();
        int created = 0;

        for (int i = 0; i < rows.size(); i++) {
            ImportRequests.CheckinRow row = rows.get(i);
            try {
                if (row == null) throw ApiException.badRequest("Empty row");
                LocalDate date = parseDate(row.date(), "Date", true);
                Goal goal;
                if (row.goalId() != null && !row.goalId().isBlank()) {
                    goal = goalService.requireGoal(parseInt(row.goalId(), "Goal id").longValue());
                } else {
                    Department department = lookup(departments, row.department(), "department");
                    String name = row.goal() == null ? "" : row.goal().trim();
                    if (name.isEmpty()) throw ApiException.badRequest("Give a goalId, or a department and a goal name");
                    LocalDate when = date != null ? date : LocalDate.now();
                    FiscalPeriods.Quarter quarter = FiscalPeriods.of(when);
                    goal = goalRepository.findByDepartmentAndName(department.getId(), name).stream()
                            .filter(g -> g.getYear() == quarter.year() && g.getQuarter() == quarter.quarter())
                            .findFirst()
                            .orElseThrow(() -> ApiException.badRequest("No goal \"" + name + "\" in "
                                    + department.getName() + " for " + quarter));
                }
                GoalService.requireCheckIn(actor, goal);
                goalService.record(goal, date, Money.parse(row.value(), "Value"), row.note(),
                        GoalCheckin.Source.CSV, actor.getId(), actor.getEmail());
                created++;
            } catch (ApiException e) {
                errors.add(new ImportResult.RowError(i + 1, e.getMessage()));
            }
        }

        auditService.log("import_completed", actor.getEmail(),
                "Imported " + created + " goal check-in(s) from CSV (" + errors.size() + " skipped)");
        return new ImportResult(created, errors.size(), errors);
    }

    private Map<String, Department> departmentsByName() {
        Map<String, Department> result = new HashMap<>();
        departmentRepository.findAll().forEach(d -> result.put(d.getName().toLowerCase(Locale.ROOT), d));
        return result;
    }

    private Map<String, ExpenseCategory> categoriesByName() {
        Map<String, ExpenseCategory> result = new HashMap<>();
        categoryRepository.findAll().forEach(c -> result.put(c.getName().toLowerCase(Locale.ROOT), c));
        return result;
    }

    private static <T> T lookup(Map<String, T> byName, String raw, String what) {
        String name = raw == null ? "" : raw.trim();
        if (name.isEmpty()) throw ApiException.badRequest(Character.toUpperCase(what.charAt(0)) + what.substring(1) + " is required");
        T found = byName.get(name.toLowerCase(Locale.ROOT));
        if (found == null) throw ApiException.badRequest("Unknown " + what + " \"" + name + "\"");
        return found;
    }

    private static LocalDate parseDate(String raw, String field, boolean optional) {
        if (raw == null || raw.isBlank()) {
            if (optional) return null;
            throw ApiException.badRequest(field + " is required");
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest(field + " must be a date like 2026-03-31 (got \"" + raw.trim() + "\")");
        }
    }

    private static Integer parseInt(String raw, String field) {
        if (raw == null || raw.isBlank()) throw ApiException.badRequest(field + " is required");
        try {
            return Integer.valueOf(raw.trim());
        } catch (NumberFormatException e) {
            throw ApiException.badRequest(field + " must be a whole number (got \"" + raw.trim() + "\")");
        }
    }

    private static void requireRows(List<?> rows) {
        if (rows == null || rows.isEmpty()) {
            throw ApiException.badRequest("The file contains no data rows");
        }
        if (rows.size() > MAX_ROWS) {
            throw ApiException.badRequest("Too many rows (maximum " + MAX_ROWS + " per import)");
        }
    }
}
