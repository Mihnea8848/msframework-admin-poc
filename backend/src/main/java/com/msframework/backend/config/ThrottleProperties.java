package com.msframework.backend.config;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Limits for the public auth endpoints ({@code app.throttle.*} in application.properties).
 * Mutable so the throttle tests can lower them for a moment in the shared test context.
 */
@ConfigurationProperties("app.throttle")
@Getter
@Setter
public class ThrottleProperties {

    /** Sign-in attempts per client IP. */
    private Rule login = new Rule(20, Duration.ofMinutes(1));
    /** Password-reset requests per client IP. */
    private Rule forgotPassword = new Rule(5, Duration.ofMinutes(15));
    /** Password resets (token submissions) per client IP. */
    private Rule resetPassword = new Rule(10, Duration.ofMinutes(15));
    /** Registrations per client IP. */
    private Rule register = new Rule(10, Duration.ofHours(1));
    /** Failed sign-ins per account before it is locked. */
    private Lockout lockout = new Lockout(5, Duration.ofMinutes(15), Duration.ofMinutes(15));

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Rule {
        private int limit;
        private Duration window;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Lockout {
        private int maxFailures;
        private Duration window;
        private Duration duration;
    }
}
