package com.msframework.backend.service;

import com.msframework.backend.config.ThrottleProperties;
import com.msframework.backend.exception.TooManyRequestsException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Database-backed throttling of the public auth endpoints, so the limits hold across instances
 * and restarts. Each limit is a fixed-window counter in {@code auth_throttle}, updated with one
 * atomic upsert. Over a limit the caller gets a 429 with {@code Retry-After}, and the first
 * rejected request of each window is audited.
 *
 * <p>Sign-in also has a per-account lockout: too many failed attempts lock the account for a
 * while, whether or not the email exists, so the lock reveals nothing about which accounts do.</p>
 */
@Service
@RequiredArgsConstructor
public class AuthThrottleService {

    /** What is being throttled. The key prefix keeps the counters of each rule apart. */
    public enum Action {
        LOGIN("login-ip", "sign-in attempts"),
        FORGOT_PASSWORD("forgot-ip", "password reset requests"),
        RESET_PASSWORD("reset-ip", "password reset attempts"),
        REGISTER("register-ip", "registrations");

        private final String prefix;
        private final String label;

        Action(String prefix, String label) {
            this.prefix = prefix;
            this.label = label;
        }
    }

    private static final String LOCKOUT_PREFIX = "login-fail:";

    /** Increments the counter, starting a new window when the old one has ended. */
    private static final String HIT = """
            INSERT INTO auth_throttle AS t (key, window_start, count, locked_until)
            VALUES (?, ?, 1, NULL)
            ON CONFLICT (key) DO UPDATE SET
                window_start = CASE WHEN t.window_start <= ? THEN EXCLUDED.window_start ELSE t.window_start END,
                count = CASE WHEN t.window_start <= ? THEN 1 ELSE t.count + 1 END
            RETURNING window_start, count""";

    private final JdbcTemplate jdbcTemplate;
    private final ThrottleProperties properties;
    private final AuditService auditService;
    private final ClientIpResolver clientIpResolver;
    private final Clock clock = Clock.systemUTC();

    // ------------------------------------------------------------------ entry points for AuthController
    // Each is one call, so the controller's own logic stays unchanged around them.

    /** Before checking the password: the per-IP sign-in limit, then the account lock. */
    public void beforeLogin(String email) {
        check(Action.LOGIN, email);
        requireNotLocked(email);
    }

    /** After a wrong password: counts the failure and may lock the account (then throws a 429). */
    public void loginFailed(String email) {
        recordFailure(email);
    }

    /** After a correct password: clears the account's failure counter. */
    public void loginSucceeded(String email) {
        clearFailures(email);
    }

    /**
     * Counts one request from the current client IP and throws a 429 when it is over the limit.
     *
     * @param actor the email the request is about, if any (for the audit entry)
     */
    public void check(Action action, String actor) {
        check(action, clientIpResolver.resolve(currentRequest()), actor == null ? null : UserService.normalizeEmail(actor));
    }

    private static HttpServletRequest currentRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            return attributes.getRequest();
        }
        throw new IllegalStateException("Throttling needs an HTTP request");
    }

    // ------------------------------------------------------------------ the counters

    /**
     * Counts one request from {@code clientIp} and throws a 429 when it is over the limit.
     *
     * @param actor the email the request is about, if any (for the audit entry)
     */
    public void check(Action action, String clientIp, String actor) {
        ThrottleProperties.Rule rule = rule(action);
        Instant now = clock.instant();
        Window window = hit(action.prefix + ":" + clientIp, now, rule.getWindow());
        if (window.count() <= rule.getLimit()) {
            return;
        }
        long retryAfter = secondsUntil(window.start().plus(rule.getWindow()), now);
        if (window.count() == rule.getLimit() + 1) {
            auditService.log("rate_limited", actor,
                    "Too many " + action.label + " from " + clientIp + "; blocked for " + retryAfter + " s");
        }
        throw new TooManyRequestsException(
                "Too many " + action.label + ". Please wait " + describe(retryAfter) + " and try again.", retryAfter);
    }

    /** Throws a 429 while the account is locked. Call before checking the password. */
    public void requireNotLocked(String email) {
        Instant now = clock.instant();
        List<Timestamp> locked = jdbcTemplate.queryForList(
                "SELECT locked_until FROM auth_throttle WHERE key = ? AND locked_until > ?",
                Timestamp.class, LOCKOUT_PREFIX + email, Timestamp.from(now));
        if (!locked.isEmpty()) {
            throw lockedException(secondsUntil(locked.get(0).toInstant(), now));
        }
    }

    /**
     * Records a failed sign-in for the account. When it reaches the limit the account is locked,
     * the lock is audited and a 429 is thrown; otherwise this returns normally.
     */
    public void recordFailure(String email) {
        ThrottleProperties.Lockout lockout = properties.getLockout();
        Instant now = clock.instant();
        String key = LOCKOUT_PREFIX + email;
        Window window = hit(key, now, lockout.getWindow());
        if (window.count() < lockout.getMaxFailures()) {
            return;
        }
        Instant until = now.plus(lockout.getDuration());
        // Start counting again from zero once the lock ends.
        jdbcTemplate.update("UPDATE auth_throttle SET locked_until = ?, count = 0, window_start = ? WHERE key = ?",
                Timestamp.from(until), Timestamp.from(now), key);
        auditService.log("account_locked", email, "Account " + email + " locked for "
                + describe(lockout.getDuration().toSeconds()) + " after " + window.count() + " failed sign-ins");
        throw lockedException(lockout.getDuration().toSeconds());
    }

    /** A successful sign-in clears the account's failure counter. */
    public void clearFailures(String email) {
        jdbcTemplate.update("DELETE FROM auth_throttle WHERE key = ?", LOCKOUT_PREFIX + email);
    }

    /** Drops counters whose window ended a day ago and that hold no active lock. */
    @Scheduled(fixedDelayString = "PT1H", initialDelayString = "PT5M")
    public void purgeExpired() {
        Instant now = clock.instant();
        jdbcTemplate.update("DELETE FROM auth_throttle WHERE window_start < ? AND (locked_until IS NULL OR locked_until < ?)",
                Timestamp.from(now.minus(Duration.ofDays(1))), Timestamp.from(now));
    }

    private Window hit(String key, Instant now, Duration window) {
        Timestamp expired = Timestamp.from(now.minus(window));
        return jdbcTemplate.queryForObject(HIT,
                (rs, i) -> new Window(rs.getTimestamp("window_start").toInstant(), rs.getInt("count")),
                key, Timestamp.from(now), expired, expired);
    }

    private ThrottleProperties.Rule rule(Action action) {
        return switch (action) {
            case LOGIN -> properties.getLogin();
            case FORGOT_PASSWORD -> properties.getForgotPassword();
            case RESET_PASSWORD -> properties.getResetPassword();
            case REGISTER -> properties.getRegister();
        };
    }

    private static TooManyRequestsException lockedException(long retryAfter) {
        return new TooManyRequestsException("Too many failed sign-in attempts. This account is locked for "
                + describe(retryAfter) + ". Try again later or reset your password.", retryAfter);
    }

    private static long secondsUntil(Instant end, Instant now) {
        long millis = Duration.between(now, end).toMillis();
        return Math.max(1, (millis + 999) / 1000);
    }

    /** "45 seconds", "1 minute", "15 minutes". */
    static String describe(long seconds) {
        if (seconds < 60) return seconds == 1 ? "1 second" : seconds + " seconds";
        long minutes = (seconds + 59) / 60;
        return minutes == 1 ? "1 minute" : minutes + " minutes";
    }

    private record Window(Instant start, int count) {
    }
}
