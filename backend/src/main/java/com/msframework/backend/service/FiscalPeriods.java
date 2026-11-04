package com.msframework.backend.service;

import com.msframework.backend.exception.ApiException;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

/** Fiscal quarters follow the calendar year: Q1 is January to March. */
public final class FiscalPeriods {

    public static final int MIN_YEAR = 2000;
    public static final int MAX_YEAR = 2100;

    private FiscalPeriods() {
    }

    public record Quarter(int year, int quarter) {

        public LocalDate start() {
            return LocalDate.of(year, (quarter - 1) * 3 + 1, 1);
        }

        public LocalDate end() {
            return start().plusMonths(3).minusDays(1);
        }

        public boolean overlaps(LocalDate from, LocalDate to) {
            return !start().isAfter(to) && !end().isBefore(from);
        }

        public Quarter previous() {
            return quarter == 1 ? new Quarter(year - 1, 4) : new Quarter(year, quarter - 1);
        }

        public Quarter next() {
            return quarter == 4 ? new Quarter(year + 1, 1) : new Quarter(year, quarter + 1);
        }

        @Override
        public String toString() {
            return year + " Q" + quarter;
        }
    }

    public static Quarter of(LocalDate date) {
        return new Quarter(date.getYear(), (date.getMonthValue() - 1) / 3 + 1);
    }

    public static Quarter current() {
        return of(LocalDate.now());
    }

    /** Validates the year and quarter, defaulting each one to the current quarter when missing. */
    public static Quarter resolve(Integer year, Integer quarter) {
        Quarter now = current();
        int y = year == null ? now.year() : requireYear(year);
        int q = quarter == null ? (year == null ? now.quarter() : 1) : requireQuarter(quarter);
        return new Quarter(y, q);
    }

    public static int requireYear(Integer year) {
        if (year == null) throw ApiException.badRequest("Year is required");
        if (year < MIN_YEAR || year > MAX_YEAR) {
            throw ApiException.badRequest("Year must be between " + MIN_YEAR + " and " + MAX_YEAR);
        }
        return year;
    }

    public static int requireQuarter(Integer quarter) {
        if (quarter == null) throw ApiException.badRequest("Quarter is required");
        if (quarter < 1 || quarter > 4) throw ApiException.badRequest("Quarter must be 1, 2, 3 or 4");
        return quarter;
    }

    /** Every quarter that overlaps [from, to], oldest first. */
    public static List<Quarter> quartersBetween(LocalDate from, LocalDate to) {
        List<Quarter> result = new ArrayList<>();
        for (Quarter q = of(from); !q.start().isAfter(to); q = q.next()) {
            result.add(q);
        }
        return result;
    }

    /** Every month that overlaps [from, to] as "YYYY-MM", oldest first. */
    public static List<YearMonth> monthsBetween(LocalDate from, LocalDate to) {
        List<YearMonth> result = new ArrayList<>();
        for (YearMonth m = YearMonth.from(from); !m.isAfter(YearMonth.from(to)); m = m.plusMonths(1)) {
            result.add(m);
        }
        return result;
    }

    /**
     * Resolves a report range: {@code to} defaults to today and {@code from} to the first day of
     * the month five months earlier (six whole months). The range may be at most three years.
     */
    public static LocalDate[] resolveRange(LocalDate from, LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : YearMonth.from(end).minusMonths(5).atDay(1);
        if (start.isAfter(end)) throw ApiException.badRequest("The start date must be on or before the end date");
        if (start.plusYears(3).isBefore(end)) throw ApiException.badRequest("The range can be at most three years");
        if (start.getYear() < MIN_YEAR || end.getYear() > MAX_YEAR) {
            throw ApiException.badRequest("Dates must be between " + MIN_YEAR + " and " + MAX_YEAR);
        }
        return new LocalDate[]{start, end};
    }
}
