package com.msframework.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Currency;
import java.util.Locale;

/**
 * The organisation's single currency (ISO 4217, {@code app.finance.currency}, EUR by default).
 * Every budget and expense is recorded in it and nothing is converted, so change it only before
 * any money has been recorded.
 */
@Component
public class FinanceSettings {

    private final String currency;

    public FinanceSettings(@Value("${app.finance.currency:EUR}") String currency) {
        String code = currency == null ? "" : currency.trim().toUpperCase(Locale.ROOT);
        try {
            this.currency = Currency.getInstance(code).getCurrencyCode();
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("app.finance.currency must be an ISO 4217 code such as EUR, got \"" + currency + "\"");
        }
    }

    public String currency() {
        return currency;
    }
}
