package com.msframework.backend.service;

import com.msframework.backend.exception.ApiException;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Amounts are numeric(14,2): at most 12 digits before the decimal point and 2 after. */
public final class Money {

    private static final BigDecimal MAX = new BigDecimal("999999999999.99");

    private Money() {
    }

    public static BigDecimal requirePositive(BigDecimal value, String field) {
        BigDecimal amount = requireAmount(value, field);
        if (amount.signum() <= 0) throw ApiException.badRequest(field + " must be greater than zero");
        return amount;
    }

    public static BigDecimal requireNonNegative(BigDecimal value, String field) {
        BigDecimal amount = requireAmount(value, field);
        if (amount.signum() < 0) throw ApiException.badRequest(field + " cannot be negative");
        return amount;
    }

    /** A KPI value: any sign, same precision as money. */
    public static BigDecimal requireValue(BigDecimal value, String field) {
        if (value == null) throw ApiException.badRequest(field + " is required");
        return requireAmount(value, field);
    }

    /** Parses a CSV cell such as "1 234.50" or "1234,5". */
    public static BigDecimal parse(String raw, String field) {
        if (raw == null || raw.isBlank()) throw ApiException.badRequest(field + " is required");
        String cleaned = raw.trim().replace(" ", "").replace(" ", "");
        if (cleaned.contains(",") && !cleaned.contains(".")) cleaned = cleaned.replace(',', '.');
        else cleaned = cleaned.replace(",", "");
        try {
            return new BigDecimal(cleaned);
        } catch (NumberFormatException e) {
            throw ApiException.badRequest(field + " must be a number (got \"" + raw.trim() + "\")");
        }
    }

    private static BigDecimal requireAmount(BigDecimal value, String field) {
        if (value == null) throw ApiException.badRequest(field + " is required");
        if (value.scale() > 2 && value.stripTrailingZeros().scale() > 2) {
            throw ApiException.badRequest(field + " can have at most 2 decimals");
        }
        if (value.abs().compareTo(MAX) > 0) throw ApiException.badRequest(field + " is too large");
        return value.setScale(2, RoundingMode.UNNECESSARY);
    }

    public static BigDecimal zeroIfNull(BigDecimal value) {
        return value == null ? BigDecimal.ZERO.setScale(2) : value.setScale(2, RoundingMode.HALF_UP);
    }
}
