package com.msframework.backend.service;

import com.msframework.backend.config.FinanceSettings;
import com.msframework.backend.dto.FinanceDtos;
import com.msframework.backend.dto.GoalDtos;
import com.msframework.backend.dto.ReportDtos;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.ExpenseCategory;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.ExpenseCategoryRepository;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.Writer;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Cross-cutting reports: spending by department, category and month, spend against budget,
 * department performance and headcount; and the CSV exports.
 */
@Service
@RequiredArgsConstructor
public class ReportService {

    public enum ExportType { EXPENSES, BUDGETS, PERFORMANCE }

    private final SpendLedger ledger;
    private final BudgetService budgetService;
    private final GoalService goalService;
    private final DepartmentRepository departmentRepository;
    private final ExpenseCategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final FinanceSettings finance;
    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public ReportDtos.Overview overview(LocalDate fromRaw, LocalDate toRaw) {
        LocalDate[] range = FiscalPeriods.resolveRange(fromRaw, toRaw);
        LocalDate from = range[0];
        LocalDate to = range[1];
        List<Department> departments = departmentRepository.findAllByOrderByIdAsc();

        Map<Long, SpendLedger.Spend> byDepartment = ledger.byDepartment(from, to);
        List<ReportDtos.DepartmentSpend> spendByDepartment = new ArrayList<>();
        for (Department d : departments) {
            spendByDepartment.add(new ReportDtos.DepartmentSpend(d.getId(), d.getName(), d.getColor(),
                    spend(byDepartment, d.getId()).spent()));
        }
        spendByDepartment.sort(Comparator.comparing(ReportDtos.DepartmentSpend::spent).reversed());

        Map<Long, SpendLedger.Spend> byCategory = ledger.byCategory(from, to);
        List<ReportDtos.CategorySpend> spendByCategory = new ArrayList<>();
        for (ExpenseCategory c : categoryRepository.findAllByOrderByNameAsc()) {
            SpendLedger.Spend s = spend(byCategory, c.getId());
            if (!c.isActive() && s.spent().signum() == 0) continue;
            spendByCategory.add(new ReportDtos.CategorySpend(c.getId(), c.getName(), s.spent()));
        }
        spendByCategory.sort(Comparator.comparing(ReportDtos.CategorySpend::spent).reversed());

        // A quarter's budget counts for the share of its days that fall inside the range.
        Map<Long, BigDecimal> budgets = new HashMap<>();
        for (FinanceDtos.BudgetLine line : budgetService.lines(from, to, null)) {
            if (line.id() == null) continue;
            FiscalPeriods.Quarter q = new FiscalPeriods.Quarter(line.year(), line.quarter());
            LocalDate start = q.start().isBefore(from) ? from : q.start();
            LocalDate end = q.end().isAfter(to) ? to : q.end();
            long days = ChronoUnit.DAYS.between(start, end) + 1;
            long quarterDays = ChronoUnit.DAYS.between(q.start(), q.end()) + 1;
            BigDecimal share = line.amount().multiply(BigDecimal.valueOf(days))
                    .divide(BigDecimal.valueOf(quarterDays), 2, RoundingMode.HALF_UP);
            budgets.merge(line.departmentId(), share, BigDecimal::add);
        }
        List<ReportDtos.BudgetVsSpend> budgetVsSpend = new ArrayList<>();
        BigDecimal totalBudget = zero();
        BigDecimal totalSpent = zero();
        BigDecimal totalCommitted = zero();
        for (Department d : departments) {
            BigDecimal budget = Money.zeroIfNull(budgets.get(d.getId()));
            SpendLedger.Spend s = spend(byDepartment, d.getId());
            totalBudget = totalBudget.add(budget);
            totalSpent = totalSpent.add(s.spent());
            totalCommitted = totalCommitted.add(s.committed());
            Double utilisation = budget.signum() == 0 ? null
                    : s.spent().multiply(BigDecimal.valueOf(100)).divide(budget, 1, RoundingMode.HALF_UP).doubleValue();
            budgetVsSpend.add(new ReportDtos.BudgetVsSpend(d.getId(), d.getName(), d.getColor(), budget, s.spent(),
                    s.committed(), budget.subtract(s.spent()).subtract(s.committed()), utilisation));
        }

        Map<String, SpendLedger.Spend> byMonth = ledger.byMonth(from, to);
        List<ReportDtos.MonthSpend> monthly = new ArrayList<>();
        for (YearMonth m : FiscalPeriods.monthsBetween(from, to)) {
            SpendLedger.Spend s = byMonth.getOrDefault(m.toString(), SpendLedger.Spend.NONE);
            monthly.add(new ReportDtos.MonthSpend(m.toString(), Money.zeroIfNull(s.spent()), Money.zeroIfNull(s.committed())));
        }

        FiscalPeriods.Quarter performanceQuarter = FiscalPeriods.of(to);
        Map<Long, Double> scores = goalService.departmentScores(performanceQuarter);
        List<ReportDtos.DepartmentScore> performance = departments.stream()
                .map(d -> new ReportDtos.DepartmentScore(d.getId(), d.getName(), d.getColor(), scores.get(d.getId())))
                .toList();

        Map<Long, long[]> counts = new LinkedHashMap<>();
        long activeTotal = 0;
        for (User u : userRepository.findAll()) {
            Long id = u.getDepartment() != null ? u.getDepartment().getId() : null;
            long[] c = counts.computeIfAbsent(id, k -> new long[2]);
            c[1]++;
            if (u.isActive()) {
                c[0]++;
                activeTotal++;
            }
        }
        List<ReportDtos.Headcount> headcount = new ArrayList<>();
        for (Department d : departments) {
            long[] c = counts.getOrDefault(d.getId(), new long[2]);
            headcount.add(new ReportDtos.Headcount(d.getId(), d.getName(), c[0], c[1]));
        }
        if (counts.containsKey(null)) {
            long[] c = counts.get(null);
            headcount.add(new ReportDtos.Headcount(null, "Unassigned", c[0], c[1]));
        }

        ReportDtos.Totals totals = new ReportDtos.Totals(totalBudget, totalSpent, totalCommitted,
                totalBudget.subtract(totalSpent).subtract(totalCommitted), activeTotal);
        return new ReportDtos.Overview(from, to, finance.currency(), performanceQuarter.year(),
                performanceQuarter.quarter(), totals, spendByDepartment, spendByCategory, budgetVsSpend, monthly,
                performance, headcount);
    }

    private static SpendLedger.Spend spend(Map<Long, SpendLedger.Spend> map, Long id) {
        SpendLedger.Spend s = map.getOrDefault(id, SpendLedger.Spend.NONE);
        return new SpendLedger.Spend(Money.zeroIfNull(s.spent()), Money.zeroIfNull(s.committed()));
    }

    private static BigDecimal zero() {
        return BigDecimal.ZERO.setScale(2);
    }

    // ------------------------------------------------------------------ CSV export

    public static ExportType parseType(String raw) {
        if (raw == null || raw.isBlank()) throw ApiException.badRequest("Choose what to export: expenses, budgets or performance");
        try {
            return ExportType.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Export type must be expenses, budgets or performance");
        }
    }

    /**
     * Writes the CSV to {@code out} row by row. Expenses are those dated in the range; budgets and
     * performance cover every quarter that overlaps it. Returns the number of data rows.
     */
    @Transactional(readOnly = true)
    public int export(ExportType type, LocalDate fromRaw, LocalDate toRaw, Writer out) throws IOException {
        LocalDate[] range = FiscalPeriods.resolveRange(fromRaw, toRaw);
        CsvWriter csv = new CsvWriter(out);
        return switch (type) {
            case EXPENSES -> exportExpenses(range[0], range[1], csv);
            case BUDGETS -> exportBudgets(range[0], range[1], csv);
            case PERFORMANCE -> exportPerformance(range[0], range[1], csv);
        };
    }

    private int exportExpenses(LocalDate from, LocalDate to, CsvWriter csv) throws IOException {
        csv.row("id", "date", "department", "category", "vendor", "description", "reference", "amount", "currency",
                "status", "over_budget", "submitted_by", "submitted_at", "decided_by", "decided_at", "decision_note",
                "paid_on", "payment_reference");
        int[] rows = {0};
        IOException[] failure = {null};
        jdbc.query("SELECT e.id, e.expense_date, d.name, c.name, e.vendor, e.description, e.reference, e.amount, "
                        + "e.currency, e.status, e.over_budget, e.submitted_by_email, e.submitted_at, e.decided_by_email, "
                        + "e.decided_at, e.decision_note, e.paid_on, e.payment_reference "
                        + "FROM expenses e JOIN departments d ON d.id = e.department_id "
                        + "JOIN expense_categories c ON c.id = e.category_id "
                        + "WHERE e.expense_date BETWEEN ? AND ? ORDER BY e.expense_date, e.id",
                rs -> {
                    if (failure[0] != null) return;
                    try {
                        csv.row(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5),
                                rs.getString(6), rs.getString(7), rs.getBigDecimal(8).toPlainString(), rs.getString(9),
                                rs.getString(10), String.valueOf(rs.getBoolean(11)), rs.getString(12),
                                timestamp(rs.getTimestamp(13)), rs.getString(14), timestamp(rs.getTimestamp(15)),
                                rs.getString(16), rs.getString(17), rs.getString(18));
                        rows[0]++;
                    } catch (IOException e) {
                        failure[0] = e;
                    }
                },
                Date.valueOf(from), Date.valueOf(to));
        if (failure[0] != null) throw failure[0];
        return rows[0];
    }

    private int exportBudgets(LocalDate from, LocalDate to, CsvWriter csv) throws IOException {
        csv.row("year", "quarter", "department", "category", "budget", "spent", "committed", "remaining", "currency", "notes");
        int rows = 0;
        for (FinanceDtos.BudgetLine line : budgetService.lines(from, to, null)) {
            csv.row(String.valueOf(line.year()), String.valueOf(line.quarter()), line.departmentName(),
                    line.categoryName(), line.amount().toPlainString(), line.spent().toPlainString(),
                    line.committed().toPlainString(), line.remaining().toPlainString(), line.currency(), line.notes());
            rows++;
        }
        return rows;
    }

    private int exportPerformance(LocalDate from, LocalDate to, CsvWriter csv) throws IOException {
        csv.row("year", "quarter", "department", "department_score", "goal", "unit", "direction", "baseline", "target",
                "weight", "current_value", "last_checkin", "attainment");
        int rows = 0;
        for (FiscalPeriods.Quarter q : FiscalPeriods.quartersBetween(from, to)) {
            GoalDtos.PerformanceOverview overview = goalService.performance(q.year(), q.quarter());
            for (GoalDtos.DepartmentPerformance d : overview.departments()) {
                for (GoalDtos.GoalAttainment g : d.goals()) {
                    csv.row(String.valueOf(q.year()), String.valueOf(q.quarter()), d.departmentName(),
                            number(d.score()), g.name(), g.unit(), g.direction(), g.baseline().toPlainString(),
                            g.target().toPlainString(), String.valueOf(g.weight()),
                            g.currentValue() == null ? null : g.currentValue().toPlainString(),
                            g.lastCheckinDate() == null ? null : g.lastCheckinDate().toString(), number(g.attainment()));
                    rows++;
                }
            }
        }
        return rows;
    }

    private static String number(Double value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String timestamp(java.sql.Timestamp value) {
        return value == null ? null : Times.toOffset(value.toLocalDateTime()).toString();
    }

    /** RFC 4180 CSV with a guard against spreadsheet formulas in text cells. */
    static final class CsvWriter {

        private final Writer out;

        CsvWriter(Writer out) {
            this.out = out;
        }

        void row(String... cells) throws IOException {
            StringBuilder line = new StringBuilder();
            for (int i = 0; i < cells.length; i++) {
                if (i > 0) line.append(',');
                line.append(cell(cells[i]));
            }
            out.write(line.append("\r\n").toString());
        }

        static String cell(String raw) {
            if (raw == null) return "";
            String value = raw;
            if (!value.isEmpty() && "=+-@\t\r".indexOf(value.charAt(0)) >= 0 && !isNumber(value)) {
                value = "'" + value;
            }
            if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
                value = "\"" + value.replace("\"", "\"\"") + "\"";
            }
            return value;
        }

        private static boolean isNumber(String value) {
            try {
                new BigDecimal(value);
                return true;
            } catch (NumberFormatException e) {
                return false;
            }
        }
    }
}
