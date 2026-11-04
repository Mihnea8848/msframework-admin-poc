package com.msframework.backend.service;

import com.msframework.backend.config.FinanceSettings;
import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.FinanceDtos;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.Expense;
import com.msframework.backend.entity.ExpenseCategory;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.ExpenseRepository;
import com.msframework.backend.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * The expense workflow: DRAFT → SUBMITTED → APPROVED → PAID, or SUBMITTED → REJECTED.
 * <ul>
 *   <li>People with EXPENSE_SUBMIT file expenses for their own department (FINANCE_MANAGE for any);</li>
 *   <li>the submitter edits while DRAFT or SUBMITTED and deletes drafts;</li>
 *   <li>the department's approver (EXPENSE_APPROVE) or FINANCE_MANAGE approves or rejects, never
 *       their own expense;</li>
 *   <li>FINANCE_MANAGE marks approved expenses as paid. Paid expenses are the payment ledger.</li>
 * </ul>
 * Going over the remaining budget is allowed and recorded in {@code overBudget}.
 */
@Service
@RequiredArgsConstructor
public class ExpenseService {

    public static final int MAX_PAGE_SIZE = 200;

    private final ExpenseRepository expenseRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final BudgetService budgetService;
    private final FinanceSettings finance;
    private final AuditService auditService;
    private final EntityManager entityManager;
    private final JdbcTemplate jdbc;

    /** List filters; every field is optional. */
    public record Filter(Expense.Status status, Long departmentId, Long categoryId, LocalDate from, LocalDate to,
                         Long submitterId, String query, boolean paidOnly, LocalDate paidFrom, LocalDate paidTo) {

        public static Filter of(String status, Long departmentId, Long categoryId, LocalDate from, LocalDate to,
                                Long submitterId, String query) {
            return new Filter(parseStatus(status), departmentId, categoryId, from, to, submitterId,
                    query == null || query.isBlank() ? null : query.trim(), false, null, null);
        }
    }

    public static Expense.Status parseStatus(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return Expense.Status.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Status must be DRAFT, SUBMITTED, APPROVED, REJECTED or PAID");
        }
    }

    // ------------------------------------------------------------------ queries

    @Transactional(readOnly = true)
    public FinanceDtos.ExpensePage list(Filter filter, int page, int size, User actor) {
        BusinessAccess.requireAny(actor, Permission.FINANCE_READ, Permission.EXPENSE_SUBMIT, Permission.EXPENSE_APPROVE);
        if (filter.from() != null && filter.to() != null && filter.from().isAfter(filter.to())) {
            throw ApiException.badRequest("The start date must be on or before the end date");
        }
        Paged paged = query(filter, page, size, actor, false);
        return new FinanceDtos.ExpensePage(toDtos(paged.items(), actor), paged.page(), paged.size(), paged.total(),
                paged.totalPages(), paged.sum(), finance.currency());
    }

    @Transactional(readOnly = true)
    public FinanceDtos.ExpenseDto get(Long id, User actor) {
        Expense expense = requireVisible(id, actor);
        return toDtos(List.of(expense), actor).getFirst();
    }

    /** Payments are PAID expenses, grouped by the month they were paid. */
    @Transactional(readOnly = true)
    public FinanceDtos.PaymentLedger payments(LocalDate from, LocalDate to, Long departmentId, int page, int size,
                                              User actor) {
        LocalDate[] range = FiscalPeriods.resolveRange(from, to);
        Filter filter = new Filter(Expense.Status.PAID, departmentId, null, null, null, null, null, true, range[0], range[1]);
        Paged paged = query(filter, page, size, actor, true);

        Map<String, FinanceDtos.PaymentMonth> months = new LinkedHashMap<>();
        for (YearMonth m : FiscalPeriods.monthsBetween(range[0], range[1])) {
            months.put(m.toString(), new FinanceDtos.PaymentMonth(m.toString(), BigDecimal.ZERO.setScale(2), 0));
        }
        jdbc.query("SELECT to_char(paid_on, 'YYYY-MM') AS m, SUM(amount), COUNT(*) FROM expenses "
                        + "WHERE status = 'PAID' AND paid_on BETWEEN ? AND ? AND (? = -1 OR department_id = ?) "
                        + "GROUP BY m",
                rs -> {
                    months.put(rs.getString(1), new FinanceDtos.PaymentMonth(rs.getString(1),
                            Money.zeroIfNull(rs.getBigDecimal(2)), rs.getLong(3)));
                },
                Date.valueOf(range[0]), Date.valueOf(range[1]),
                departmentId == null ? -1L : departmentId, departmentId == null ? -1L : departmentId);

        List<FinanceDtos.PaymentDto> items = paged.items().stream().map(e -> new FinanceDtos.PaymentDto(
                e.getId(), e.getPaidOn(), e.getAmount(), e.getCurrency(), e.getVendor(), e.getDescription(),
                e.getReference(), e.getPaymentReference(), e.getDepartment().getId(), e.getDepartment().getName(),
                e.getCategory().getId(), e.getCategory().getName(), e.getSubmittedByEmail(), e.getPaidByEmail())).toList();

        return new FinanceDtos.PaymentLedger(range[0], range[1], finance.currency(), paged.sum(), paged.total(),
                new ArrayList<>(months.values()), items, paged.page(), paged.size(), paged.totalPages(),
                new FinanceDtos.Provider(false, "No payment provider is connected. Payments are recorded here when "
                        + "finance marks an approved expense as paid; MSFramework does not move money."));
    }

    private record Paged(List<Expense> items, int page, int size, long total, int totalPages, BigDecimal sum) {}

    private Paged query(Filter filter, int page, int size, User actor, boolean ledger) {
        if (page < 0) throw ApiException.badRequest("Page must be 0 or more");
        if (size < 1 || size > MAX_PAGE_SIZE) throw ApiException.badRequest("Size must be between 1 and " + MAX_PAGE_SIZE);
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();

        CriteriaQuery<Expense> select = cb.createQuery(Expense.class);
        Root<Expense> root = select.from(Expense.class);
        select.where(predicates(cb, root, filter, actor));
        select.orderBy(ledger
                ? List.of(cb.desc(root.get("paidOn")), cb.desc(root.get("id")))
                : List.of(cb.desc(root.get("expenseDate")), cb.desc(root.get("id"))));
        List<Expense> items = entityManager.createQuery(select)
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();

        CriteriaQuery<Long> count = cb.createQuery(Long.class);
        Root<Expense> countRoot = count.from(Expense.class);
        count.select(cb.count(countRoot)).where(predicates(cb, countRoot, filter, actor));
        long total = entityManager.createQuery(count).getSingleResult();

        CriteriaQuery<BigDecimal> sum = cb.createQuery(BigDecimal.class);
        Root<Expense> sumRoot = sum.from(Expense.class);
        sum.select(cb.sum(sumRoot.get("amount"))).where(predicates(cb, sumRoot, filter, actor));
        BigDecimal totalAmount = Money.zeroIfNull(entityManager.createQuery(sum).getSingleResult());

        return new Paged(items, page, size, total, (int) Math.ceil(total / (double) size), totalAmount);
    }

    private Predicate[] predicates(CriteriaBuilder cb, Root<Expense> root, Filter filter, User actor) {
        List<Predicate> where = new ArrayList<>();
        // Who sees what: FINANCE_READ everything; approvers their department; everyone their own.
        if (!actor.hasPermission(Permission.FINANCE_READ)) {
            Predicate own = cb.equal(root.get("submittedById"), actor.getId());
            Long departmentId = BusinessAccess.departmentId(actor);
            if (actor.hasPermission(Permission.EXPENSE_APPROVE) && departmentId != null) {
                where.add(cb.or(own, cb.equal(root.get("department").get("id"), departmentId)));
            } else {
                where.add(own);
            }
        }
        if (filter.status() != null) where.add(cb.equal(root.get("status"), filter.status()));
        if (filter.departmentId() != null) where.add(cb.equal(root.get("department").get("id"), filter.departmentId()));
        if (filter.categoryId() != null) where.add(cb.equal(root.get("category").get("id"), filter.categoryId()));
        if (filter.submitterId() != null) where.add(cb.equal(root.get("submittedById"), filter.submitterId()));
        if (filter.from() != null) where.add(cb.greaterThanOrEqualTo(root.get("expenseDate"), filter.from()));
        if (filter.to() != null) where.add(cb.lessThanOrEqualTo(root.get("expenseDate"), filter.to()));
        if (filter.paidFrom() != null) where.add(cb.greaterThanOrEqualTo(root.get("paidOn"), filter.paidFrom()));
        if (filter.paidTo() != null) where.add(cb.lessThanOrEqualTo(root.get("paidOn"), filter.paidTo()));
        if (filter.query() != null) {
            String like = "%" + filter.query().toLowerCase(Locale.ROOT).replace("\\", "\\\\")
                    .replace("%", "\\%").replace("_", "\\_") + "%";
            Expression<String> vendor = cb.lower(root.get("vendor"));
            Expression<String> description = cb.lower(cb.coalesce(root.get("description"), ""));
            Expression<String> reference = cb.lower(cb.coalesce(root.get("reference"), ""));
            where.add(cb.or(cb.like(vendor, like, '\\'), cb.like(description, like, '\\'), cb.like(reference, like, '\\')));
        }
        return where.toArray(Predicate[]::new);
    }

    // ------------------------------------------------------------------ commands

    @Transactional
    public FinanceDtos.ExpenseDto create(FinanceDtos.ExpenseRequest request, User actor) {
        BusinessAccess.requireAny(actor, Permission.EXPENSE_SUBMIT, Permission.FINANCE_MANAGE);
        Expense expense = new Expense();
        apply(expense, request, actor);
        expense.setCurrency(finance.currency());
        expense.setStatus(Expense.Status.DRAFT);
        expense.setSubmittedById(actor.getId());
        expense.setSubmittedByEmail(actor.getEmail());
        expense = expenseRepository.save(expense);
        auditService.log("expense_created", actor.getEmail(), "Expense drafted: " + describe(expense));

        if (Boolean.TRUE.equals(request.submit())) {
            doSubmit(expense, actor);
        }
        return toDtos(List.of(expense), actor).getFirst();
    }

    @Transactional
    public FinanceDtos.ExpenseDto update(Long id, FinanceDtos.ExpenseRequest request, User actor) {
        Expense expense = requireVisible(id, actor);
        if (!BusinessAccess.isSubmitter(actor, expense)) {
            throw ApiException.forbidden("Only the person who submitted this expense can edit it");
        }
        if (expense.getStatus() != Expense.Status.DRAFT && expense.getStatus() != Expense.Status.SUBMITTED) {
            throw ApiException.conflict("A " + expense.getStatus().name().toLowerCase(Locale.ROOT)
                    + " expense can no longer be edited");
        }
        apply(expense, request, actor);
        if (expense.getStatus() == Expense.Status.SUBMITTED) {
            expense.setOverBudget(isOverBudget(expense));
        }
        expenseRepository.save(expense);
        auditService.log("expense_updated", actor.getEmail(), "Expense edited: " + describe(expense));
        return toDtos(List.of(expense), actor).getFirst();
    }

    @Transactional
    public FinanceDtos.ExpenseDto submit(Long id, User actor) {
        Expense expense = requireVisible(id, actor);
        if (!BusinessAccess.isSubmitter(actor, expense)) {
            throw ApiException.forbidden("Only the person who drafted this expense can submit it");
        }
        if (expense.getStatus() != Expense.Status.DRAFT) {
            throw ApiException.conflict("Only drafts can be submitted");
        }
        doSubmit(expense, actor);
        return toDtos(List.of(expense), actor).getFirst();
    }

    private void doSubmit(Expense expense, User actor) {
        expense.setStatus(Expense.Status.SUBMITTED);
        expense.setSubmittedAt(LocalDateTime.now());
        expense.setOverBudget(isOverBudget(expense));
        expenseRepository.save(expense);
        auditService.log("expense_submitted", actor.getEmail(), "Expense submitted: " + describe(expense)
                + (expense.isOverBudget() ? " (over budget)" : ""));
    }

    @Transactional
    public FinanceDtos.ExpenseDto approve(Long id, String note, User actor) {
        Expense expense = requireDecidable(id, actor);
        decide(expense, Expense.Status.APPROVED, BudgetService.optional(note, 500, "Note"), actor);
        auditService.log("expense_approved", actor.getEmail(), "Expense approved: " + describe(expense));
        return toDtos(List.of(expense), actor).getFirst();
    }

    @Transactional
    public FinanceDtos.ExpenseDto reject(Long id, String note, User actor) {
        Expense expense = requireDecidable(id, actor);
        String reason = BudgetService.optional(note, 500, "Note");
        if (reason == null) throw ApiException.badRequest("Give a reason for the rejection");
        decide(expense, Expense.Status.REJECTED, reason, actor);
        auditService.log("expense_rejected", actor.getEmail(), "Expense rejected: " + describe(expense) + ": " + reason);
        return toDtos(List.of(expense), actor).getFirst();
    }

    @Transactional
    public FinanceDtos.ExpenseDto markPaid(Long id, FinanceDtos.PaymentRequest request, User actor) {
        if (!actor.hasPermission(Permission.FINANCE_MANAGE)) {
            throw ApiException.forbidden("Only finance can mark expenses as paid (FINANCE_MANAGE)");
        }
        Expense expense = expenseRepository.findById(id).orElseThrow(() -> ApiException.notFound("Expense not found"));
        if (expense.getStatus() != Expense.Status.APPROVED) {
            throw ApiException.conflict("Only approved expenses can be marked as paid");
        }
        LocalDate paidOn = request == null || request.paidOn() == null ? LocalDate.now() : request.paidOn();
        if (paidOn.isAfter(LocalDate.now())) throw ApiException.badRequest("The payment date cannot be in the future");
        if (paidOn.isBefore(expense.getExpenseDate())) {
            throw ApiException.badRequest("The payment date cannot be before the expense date");
        }
        expense.setStatus(Expense.Status.PAID);
        expense.setPaidOn(paidOn);
        expense.setPaidAt(LocalDateTime.now());
        expense.setPaidByEmail(actor.getEmail());
        expense.setPaymentReference(BudgetService.optional(request == null ? null : request.paymentReference(), 80,
                "Payment reference"));
        expenseRepository.save(expense);
        auditService.log("expense_paid", actor.getEmail(), "Expense paid: " + describe(expense));
        return toDtos(List.of(expense), actor).getFirst();
    }

    @Transactional
    public void delete(Long id, User actor) {
        Expense expense = requireVisible(id, actor);
        if (!BusinessAccess.isSubmitter(actor, expense) && !actor.hasPermission(Permission.FINANCE_MANAGE)) {
            throw ApiException.forbidden("Only the person who drafted this expense can delete it");
        }
        if (expense.getStatus() != Expense.Status.DRAFT) {
            throw ApiException.conflict("Only drafts can be deleted");
        }
        expenseRepository.delete(expense);
        auditService.log("expense_deleted", actor.getEmail(), "Expense draft deleted: " + describe(expense));
    }

    // ------------------------------------------------------------------ rules

    /** Copies the editable fields of the request onto the expense after validating them. */
    public void apply(Expense expense, FinanceDtos.ExpenseRequest request, User actor) {
        if (request == null) throw ApiException.badRequest("Request body is required");
        Department department;
        if (request.departmentId() == null) {
            department = actor.getDepartment();
            if (department == null) throw ApiException.badRequest("Choose a department: you are not assigned to one");
        } else {
            department = departmentRepository.findById(request.departmentId())
                    .orElseThrow(() -> ApiException.badRequest("Department not found"));
        }
        if (!BusinessAccess.canSubmitFor(actor, department)) {
            throw ApiException.forbidden("You can only submit expenses for your own department");
        }
        ExpenseCategory category = expense.getCategory() != null && expense.getCategory().getId().equals(request.categoryId())
                ? expense.getCategory()
                : budgetService.requireActiveCategory(request.categoryId());
        BigDecimal amount = Money.requirePositive(request.amount(), "Amount");
        LocalDate date = requireDate(request.date());
        String vendor = request.vendor() == null ? "" : request.vendor().trim();
        if (vendor.isEmpty()) throw ApiException.badRequest("Vendor is required");
        if (vendor.length() > 120) throw ApiException.badRequest("Vendor must be at most 120 characters");

        expense.setDepartment(department);
        expense.setCategory(category);
        expense.setAmount(amount);
        expense.setExpenseDate(date);
        expense.setVendor(vendor);
        expense.setDescription(BudgetService.optional(request.description(), 500, "Description"));
        expense.setReference(BudgetService.optional(request.reference(), 80, "Reference"));
    }

    static LocalDate requireDate(LocalDate date) {
        if (date == null) throw ApiException.badRequest("Date is required");
        if (date.isAfter(LocalDate.now())) throw ApiException.badRequest("The expense date cannot be in the future");
        if (date.getYear() < FiscalPeriods.MIN_YEAR) throw ApiException.badRequest("The expense date is too far in the past");
        return date;
    }

    /** True when the expense needs more than what is left on its budget line. */
    public boolean isOverBudget(Expense expense) {
        BigDecimal remaining = budgetService.remaining(expense.getDepartment(), expense.getCategory(),
                FiscalPeriods.of(expense.getExpenseDate()), expense.getId());
        return expense.getAmount().compareTo(remaining) > 0;
    }

    private Expense requireVisible(Long id, User actor) {
        Expense expense = expenseRepository.findById(id).orElseThrow(() -> ApiException.notFound("Expense not found"));
        if (!BusinessAccess.canView(actor, expense)) throw ApiException.notFound("Expense not found");
        return expense;
    }

    private Expense requireDecidable(Long id, User actor) {
        Expense expense = expenseRepository.findById(id).orElseThrow(() -> ApiException.notFound("Expense not found"));
        if (BusinessAccess.isSubmitter(actor, expense)) {
            throw ApiException.forbidden("You cannot approve or reject your own expense");
        }
        if (!BusinessAccess.canDecide(actor, expense)) {
            if (!BusinessAccess.canView(actor, expense)) throw ApiException.notFound("Expense not found");
            throw ApiException.forbidden("Only the " + expense.getDepartment().getName()
                    + " approver or finance can decide on this expense");
        }
        if (expense.getStatus() != Expense.Status.SUBMITTED) {
            throw ApiException.conflict("Only submitted expenses can be approved or rejected");
        }
        return expense;
    }

    private void decide(Expense expense, Expense.Status status, String note, User actor) {
        expense.setStatus(status);
        expense.setDecidedById(actor.getId());
        expense.setDecidedByEmail(actor.getEmail());
        expense.setDecidedAt(LocalDateTime.now());
        expense.setDecisionNote(note);
        expenseRepository.save(expense);
    }

    private String describe(Expense expense) {
        return "#" + expense.getId() + " " + expense.getVendor() + ", " + expense.getAmount().toPlainString() + " "
                + expense.getCurrency() + " (" + expense.getDepartment().getName() + " / "
                + expense.getCategory().getName() + ")";
    }

    // ------------------------------------------------------------------ mapping

    private List<FinanceDtos.ExpenseDto> toDtos(List<Expense> expenses, User actor) {
        Set<Long> userIds = new HashSet<>();
        expenses.forEach(e -> {
            if (e.getSubmittedById() != null) userIds.add(e.getSubmittedById());
        });
        Map<Long, String> names = new HashMap<>();
        userRepository.findAllById(userIds).forEach(u -> names.put(u.getId(), u.getFullName()));
        return expenses.stream().map(e -> toDto(e, names.get(e.getSubmittedById()), actor)).toList();
    }

    private static FinanceDtos.ExpenseDto toDto(Expense e, String submitterName, User actor) {
        boolean mine = BusinessAccess.isSubmitter(actor, e);
        Expense.Status status = e.getStatus();
        boolean decidable = status == Expense.Status.SUBMITTED && BusinessAccess.canDecide(actor, e);
        FinanceDtos.Actions actions = new FinanceDtos.Actions(
                mine && (status == Expense.Status.DRAFT || status == Expense.Status.SUBMITTED),
                mine && status == Expense.Status.DRAFT,
                decidable,
                decidable,
                status == Expense.Status.APPROVED && actor.hasPermission(Permission.FINANCE_MANAGE),
                status == Expense.Status.DRAFT && (mine || actor.hasPermission(Permission.FINANCE_MANAGE)));
        return new FinanceDtos.ExpenseDto(e.getId(), e.getDepartment().getId(), e.getDepartment().getName(),
                e.getCategory().getId(), e.getCategory().getName(), e.getAmount(), e.getCurrency(), e.getExpenseDate(),
                e.getVendor(), e.getDescription(), e.getReference(), status.name(), e.isOverBudget(),
                e.getSubmittedById(), submitterName, e.getSubmittedByEmail(), Times.toOffset(e.getSubmittedAt()),
                e.getDecidedByEmail(), Times.toOffset(e.getDecidedAt()), e.getDecisionNote(), e.getPaidOn(),
                e.getPaidByEmail(), e.getPaymentReference(), Times.toOffset(e.getCreatedAt()),
                Times.toOffset(e.getUpdatedAt()), actions);
    }
}
