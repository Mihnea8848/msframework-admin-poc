package com.msframework.backend;

import com.jayway.jsonpath.JsonPath;
import com.msframework.backend.config.ThrottleProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Throttling and lockout of the public auth endpoints. The test profile sets very high limits so
 * other tests never hit them; these tests lower them for a moment and use their own client IPs.
 */
@IntegrationTest
class AuthThrottleTests {

    private static final String PASSWORD = "Secret#123";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ThrottleProperties properties;

    @Autowired
    private JdbcTemplate jdbc;

    private ThrottleProperties saved;

    @BeforeEach
    void lowerLimits() {
        saved = new ThrottleProperties();
        saved.setLogin(copy(properties.getLogin()));
        saved.setForgotPassword(copy(properties.getForgotPassword()));
        saved.setResetPassword(copy(properties.getResetPassword()));
        saved.setRegister(copy(properties.getRegister()));
        saved.setLockout(new ThrottleProperties.Lockout(properties.getLockout().getMaxFailures(),
                properties.getLockout().getWindow(), properties.getLockout().getDuration()));

        properties.setLogin(new ThrottleProperties.Rule(3, Duration.ofMinutes(1)));
        properties.setForgotPassword(new ThrottleProperties.Rule(2, Duration.ofMinutes(15)));
        properties.setResetPassword(new ThrottleProperties.Rule(2, Duration.ofMinutes(15)));
        properties.setRegister(new ThrottleProperties.Rule(2, Duration.ofHours(1)));
        properties.setLockout(new ThrottleProperties.Lockout(3, Duration.ofMinutes(15), Duration.ofMinutes(15)));
    }

    @AfterEach
    void restoreLimits() {
        properties.setLogin(saved.getLogin());
        properties.setForgotPassword(saved.getForgotPassword());
        properties.setResetPassword(saved.getResetPassword());
        properties.setRegister(saved.getRegister());
        properties.setLockout(saved.getLockout());
    }

    private static ThrottleProperties.Rule copy(ThrottleProperties.Rule rule) {
        return new ThrottleProperties.Rule(rule.getLimit(), rule.getWindow());
    }

    // ------------------------------------------------------------------ helpers

    /** A client IP of its own, from the documentation range, so tests never share a counter. */
    private static String newIp() {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        return "198.51." + random.nextInt(256) + "." + random.nextInt(1, 255);
    }

    private static RequestPostProcessor from(String ip) {
        return request -> {
            request.setRemoteAddr(ip);
            return request;
        };
    }

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body).with(TestSession.ANONYMOUS);
    }

    private static MockHttpServletRequestBuilder login(String email, String password) {
        return json(post("/api/auth/login"), "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    }

    /** The admin, signed in from an IP of its own so the lowered sign-in limit never applies. */
    private TestSession admin() throws Exception {
        return TestSession.fromResponse(mvc.perform(login("admin@test.com", "password123").with(from(newIp())))
                .andExpect(status().isOk())
                .andReturn().getResponse(), TestSession.ANONYMOUS.xsrfToken());
    }

    private void createUser(String email) throws Exception {
        String body = "{\"fullName\":\"Test User\",\"email\":\"" + email + "\",\"role\":\"MEMBER\","
                + "\"status\":\"Active\",\"password\":\"" + PASSWORD + "\",\"departmentId\":1}";
        mvc.perform(json(post("/api/users"), body).with(admin()))
                .andExpect(status().isCreated());
    }

    private List<String> auditDescriptions(String eventType) throws Exception {
        String body = mvc.perform(get("/api/audit").param("limit", "200")
                        .with(admin()))
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$[?(@.eventType == '" + eventType + "')].description");
    }

    // ------------------------------------------------------------------ per-IP limits

    @Test
    void tooManySignInsFromOneIpGet429WithRetryAfter() throws Exception {
        String ip = newIp();
        for (int i = 0; i < 3; i++) {
            mvc.perform(login(unique("nobody"), "wrong").with(from(ip))).andExpect(status().isUnauthorized());
        }
        mvc.perform(login(unique("nobody"), "wrong").with(from(ip)))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.message").value(containsString("Too many sign-in attempts")));
        mvc.perform(login(unique("nobody"), "wrong").with(from(ip))).andExpect(status().isTooManyRequests());

        String retryAfter = mvc.perform(login(unique("nobody"), "wrong").with(from(ip)))
                .andReturn().getResponse().getHeader("Retry-After");
        assertThat(Long.parseLong(retryAfter)).isBetween(1L, 60L);

        // Another client is not affected.
        mvc.perform(login(unique("nobody"), "wrong").with(from(newIp()))).andExpect(status().isUnauthorized());

        // Audited once per window, not once per rejected request.
        assertThat(auditDescriptions("rate_limited")).filteredOn(d -> d.contains(" " + ip + ";")).hasSize(1);
    }

    @Test
    void forwardedForIsIgnoredWithoutATrustedProxy() throws Exception {
        String ip = newIp();
        for (int i = 0; i < 3; i++) {
            mvc.perform(login(unique("nobody"), "wrong").with(from(ip)).header("X-Forwarded-For", newIp()))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(login(unique("nobody"), "wrong").with(from(ip)).header("X-Forwarded-For", newIp()))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void passwordResetAndRegistrationAreLimitedPerIp() throws Exception {
        String ip = newIp();
        for (int i = 0; i < 2; i++) {
            mvc.perform(json(post("/api/auth/forgot-password"), "{\"email\":\"" + unique("fp") + "\"}").with(from(ip)))
                    .andExpect(status().isNoContent());
        }
        mvc.perform(json(post("/api/auth/forgot-password"), "{\"email\":\"" + unique("fp") + "\"}").with(from(ip)))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));

        for (int i = 0; i < 2; i++) {
            mvc.perform(json(post("/api/auth/reset-password"), "{\"token\":\"nope\",\"newPassword\":\"Fresh#4821\"}")
                            .with(from(ip)))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(json(post("/api/auth/reset-password"), "{\"token\":\"nope\",\"newPassword\":\"Fresh#4821\"}")
                        .with(from(ip)))
                .andExpect(status().isTooManyRequests());

        for (int i = 0; i < 2; i++) {
            mvc.perform(json(post("/api/auth/register"), "{\"fullName\":\"Jane Doe\",\"phone\":\"0712345678\","
                            + "\"email\":\"" + unique("reg") + "\",\"departmentId\":1,\"password\":\"" + PASSWORD + "\"}")
                            .with(from(ip)))
                    .andExpect(status().isAccepted());
        }
        mvc.perform(json(post("/api/auth/register"), "{\"fullName\":\"Jane Doe\",\"phone\":\"0712345678\","
                        + "\"email\":\"" + unique("reg") + "\",\"departmentId\":1,\"password\":\"" + PASSWORD + "\"}")
                        .with(from(ip)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(containsString("Too many registrations")));
    }

    // ------------------------------------------------------------------ account lockout

    @Test
    void repeatedFailuresLockTheAccountUntilTheLockEnds() throws Exception {
        String email = unique("locked");
        createUser(email);
        String ip = newIp();

        mvc.perform(login(email, "wrong").with(from(ip))).andExpect(status().isUnauthorized());
        mvc.perform(login(email, "wrong").with(from(ip))).andExpect(status().isUnauthorized());
        mvc.perform(login(email, "wrong").with(from(ip)))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.message").value(containsString("This account is locked for 15 minutes")));

        // Locked: even the right password is refused, before it is checked, from any IP.
        mvc.perform(login(email, PASSWORD).with(from(newIp())))
                .andExpect(status().isTooManyRequests());
        String retryAfter = mvc.perform(login(email, PASSWORD).with(from(newIp())))
                .andReturn().getResponse().getHeader("Retry-After");
        assertThat(Long.parseLong(retryAfter)).isBetween(800L, 900L);
        assertThat(auditDescriptions("account_locked")).filteredOn(d -> d.contains(email)).hasSize(1);

        // When the lock ends, the right password works and clears the counter.
        jdbc.update("UPDATE auth_throttle SET locked_until = now() - interval '1 second' WHERE key = ?",
                "login-fail:" + email);
        mvc.perform(login(email, PASSWORD).with(from(newIp()))).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM auth_throttle WHERE key = ?", Integer.class,
                "login-fail:" + email)).isZero();
    }

    @Test
    void aSuccessfulSignInClearsTheFailureCount() throws Exception {
        String email = unique("cleared");
        createUser(email);

        mvc.perform(login(email, "wrong").with(from(newIp()))).andExpect(status().isUnauthorized());
        mvc.perform(login(email, "wrong").with(from(newIp()))).andExpect(status().isUnauthorized());
        mvc.perform(login(email, PASSWORD).with(from(newIp()))).andExpect(status().isOk());
        // Without the reset, this would be the third failure and lock the account.
        mvc.perform(login(email, "wrong").with(from(newIp()))).andExpect(status().isUnauthorized());
        mvc.perform(login(email, "wrong").with(from(newIp()))).andExpect(status().isUnauthorized());
        mvc.perform(login(email, PASSWORD).with(from(newIp()))).andExpect(status().isOk());
    }

    @Test
    void unknownAccountsAreLockedTooSoNothingIsRevealed() throws Exception {
        String email = unique("ghost");
        for (int i = 0; i < 2; i++) {
            mvc.perform(login(email, "wrong").with(from(newIp()))).andExpect(status().isUnauthorized());
        }
        mvc.perform(login(email, "wrong").with(from(newIp())))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(containsString("This account is locked")));
    }
}
