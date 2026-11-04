package com.msframework.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Sums of expenses for budgets and reports, computed in SQL. "Spent" is APPROVED plus PAID and
 * "committed" is SUBMITTED; drafts and rejected expenses count for nothing. Expenses belong to the
 * period of their expense date.
 */
@Component
@RequiredArgsConstructor
public class SpendLedger {

    private static final String SPENT = "COALESCE(SUM(CASE WHEN status IN ('APPROVED', 'PAID') THEN amount END), 0)";
    private static final String COMMITTED = "COALESCE(SUM(CASE WHEN status = 'SUBMITTED' THEN amount END), 0)";

    private final JdbcTemplate jdbc;

    public record Line(long departmentId, long categoryId, int year, int quarter) {}

    public record Spend(BigDecimal spent, BigDecimal committed) {
        public static final Spend NONE = new Spend(BigDecimal.ZERO.setScale(2), BigDecimal.ZERO.setScale(2));

        public BigDecimal total() {
            return spent.add(committed);
        }
    }

    /** Spend per budget line (department, category, quarter of the expense date) in [from, to]. */
    public Map<Line, Spend> byLine(LocalDate from, LocalDate to, Long excludeExpenseId) {
        Map<Line, Spend> result = new HashMap<>();
        jdbc.query("SELECT department_id, category_id, "
                        + "CAST(EXTRACT(YEAR FROM expense_date) AS integer) AS y, "
                        + "CAST(EXTRACT(QUARTER FROM expense_date) AS integer) AS q, "
                        + SPENT + " AS spent, " + COMMITTED + " AS committed "
                        + "FROM expenses WHERE expense_date BETWEEN ? AND ? AND id <> ? "
                        + "GROUP BY department_id, category_id, y, q",
                rs -> {
                    result.put(new Line(rs.getLong(1), rs.getLong(2), rs.getInt(3), rs.getInt(4)),
                            new Spend(rs.getBigDecimal(5), rs.getBigDecimal(6)));
                },
                Date.valueOf(from), Date.valueOf(to), excludeExpenseId == null ? -1L : excludeExpenseId);
        return result;
    }

    /** Spend for one budget line, without the given expense (null to count every expense). */
    public Spend forLine(long departmentId, long categoryId, FiscalPeriods.Quarter quarter, Long excludeExpenseId) {
        return jdbc.query("SELECT " + SPENT + ", " + COMMITTED + " FROM expenses "
                        + "WHERE department_id = ? AND category_id = ? AND expense_date BETWEEN ? AND ? AND id <> ?",
                rs -> rs.next() ? new Spend(rs.getBigDecimal(1), rs.getBigDecimal(2)) : Spend.NONE,
                departmentId, categoryId, Date.valueOf(quarter.start()), Date.valueOf(quarter.end()),
                excludeExpenseId == null ? -1L : excludeExpenseId);
    }

    /** Spend per department in [from, to]. */
    public Map<Long, Spend> byDepartment(LocalDate from, LocalDate to) {
        return grouped("department_id", from, to);
    }

    /** Spend per category in [from, to]. */
    public Map<Long, Spend> byCategory(LocalDate from, LocalDate to) {
        return grouped("category_id", from, to);
    }

    /** Spend per month ("YYYY-MM") in [from, to]. */
    public Map<String, Spend> byMonth(LocalDate from, LocalDate to) {
        Map<String, Spend> result = new LinkedHashMap<>();
        jdbc.query("SELECT to_char(expense_date, 'YYYY-MM') AS m, " + SPENT + ", " + COMMITTED
                        + " FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY m ORDER BY m",
                rs -> {
                    result.put(rs.getString(1), new Spend(rs.getBigDecimal(2), rs.getBigDecimal(3)));
                },
                Date.valueOf(from), Date.valueOf(to));
        return result;
    }

    private Map<Long, Spend> grouped(String column, LocalDate from, LocalDate to) {
        Map<Long, Spend> result = new HashMap<>();
        jdbc.query("SELECT " + column + ", " + SPENT + ", " + COMMITTED
                        + " FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY " + column,
                rs -> {
                    result.put(rs.getLong(1), new Spend(rs.getBigDecimal(2), rs.getBigDecimal(3)));
                },
                Date.valueOf(from), Date.valueOf(to));
        return result;
    }
}
