package com.msframework.backend;

import com.jayway.jsonpath.JsonPath;
import com.msframework.backend.service.PasswordResetService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sessions in the database, CSRF, the idle timeout and background requests, password hashing and
 * the blocklist, the sessions API and the organisation settings.
 */
@IntegrationTest
class SessionSecurityTests {

    private static final String ADMIN_EMAIL = "admin@test.com";
    private static final String ADMIN_PASSWORD = "password123";
    private static final String PASSWORD = "Secret#123";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PasswordResetService passwordResetService;

    // ------------------------------------------------------------------ helpers

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private TestSession admin() throws Exception {
        return TestSession.login(mvc, ADMIN_EMAIL, ADMIN_PASSWORD);
    }

    private long createUser(String email, String role) throws Exception {
        String body = "{\"fullName\":\"Test User\",\"email\":\"" + email + "\",\"role\":\"" + role + "\","
                + "\"status\":\"Active\",\"password\":\"" + PASSWORD + "\",\"departmentId\":1}";
        MvcResult result = mvc.perform(json(post("/api/users"), body).with(admin()))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    private TestSession loginWithAgent(String email, String userAgent) throws Exception {
        MockHttpServletResponse response = mvc.perform(json(post("/api/auth/login"),
                        "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}")
                        .header("User-Agent", userAgent)
                        .with(TestSession.ANONYMOUS))
                .andExpect(status().isOk())
                .andReturn().getResponse();
        return TestSession.fromResponse(response, TestSession.ANONYMOUS.xsrfToken());
    }

    private int sessionRows(String email) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM spring_session WHERE principal_name = ?", Integer.class, email);
    }

    private long lastAccess(String email) {
        return jdbc.queryForObject("SELECT last_access_time FROM spring_session WHERE principal_name = ?", Long.class, email);
    }

    private static MockHttpServletRequestBuilder background(MockHttpServletRequestBuilder builder) {
        return builder.header("X-Background-Request", "1");
    }

    // ------------------------------------------------------------------ sessions in the database

    @Test
    void sessionsAreStoredInTheDatabase() throws Exception {
        String email = unique("stored");
        createUser(email, "MEMBER");
        TestSession session = TestSession.login(mvc, email, PASSWORD);

        assertThat(sessionRows(email)).isEqualTo(1);
        mvc.perform(get("/api/auth/me").with(session)).andExpect(jsonPath("$.email").value(email));

        mvc.perform(post("/api/auth/logout").with(session)).andExpect(status().isNoContent());
        assertThat(sessionRows(email)).isZero();
        mvc.perform(get("/api/users").with(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void signingInRotatesTheSessionIdAndTheCsrfToken() throws Exception {
        String email = unique("rotate");
        createUser(email, "MEMBER");
        TestSession first = TestSession.login(mvc, email, PASSWORD);

        MockHttpServletResponse again = mvc.perform(json(post("/api/auth/login"),
                        "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}").with(first))
                .andExpect(status().isOk())
                .andReturn().getResponse();
        TestSession second = TestSession.fromResponse(again, first.xsrfToken());

        assertThat(second.sessionId()).isNotEqualTo(first.sessionId());
        Cookie xsrf = again.getCookie(TestSession.XSRF_COOKIE);
        assertThat(xsrf).isNotNull();
        assertThat(xsrf.getMaxAge()).as("a new cookie, not a deletion").isNotZero();
        assertThat(xsrf.getValue()).isNotBlank().isNotEqualTo(first.xsrfToken());
        // The new token works (checked last, because signing out ends the session).
        mvc.perform(get("/api/users").with(first)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users").with(second)).andExpect(status().isOk());
        mvc.perform(post("/api/auth/logout").with(new TestSession(second.sessionId(), xsrf.getValue())))
                .andExpect(status().isNoContent());
    }

    @Test
    void theFirstSignInSetsATokenCookieToo() throws Exception {
        String email = unique("firstxsrf");
        createUser(email, "MEMBER");
        MockHttpServletResponse response = mvc.perform(json(post("/api/auth/login"),
                        "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}").with(TestSession.ANONYMOUS))
                .andExpect(status().isOk())
                .andReturn().getResponse();
        Cookie xsrf = response.getCookie(TestSession.XSRF_COOKIE);
        assertThat(xsrf).isNotNull();
        assertThat(xsrf.getValue()).isNotBlank().isNotEqualTo(TestSession.ANONYMOUS.xsrfToken());
        assertThat(xsrf.getMaxAge()).isNotZero();
    }

    // ------------------------------------------------------------------ CSRF

    @Test
    void unsafeRequestsNeedTheCsrfToken() throws Exception {
        TestSession admin = admin();
        String department = "{\"name\":\"Csrf " + UUID.randomUUID().toString().substring(0, 8) + "\"}";

        mvc.perform(json(post("/api/departments"), department).with(admin.withoutCsrf()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(containsString("CSRF")));
        // A header that does not match the cookie is rejected too.
        mvc.perform(json(post("/api/departments"), department).with(admin).with(request -> {
                    request.removeHeader(TestSession.XSRF_HEADER);
                    request.addHeader(TestSession.XSRF_HEADER, "forged");
                    return request;
                }))
                .andExpect(status().isForbidden());
        // Signing in is protected as well.
        mvc.perform(json(post("/api/auth/login"), "{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"" + ADMIN_PASSWORD + "\"}"))
                .andExpect(status().isForbidden());

        mvc.perform(json(post("/api/departments"), department).with(admin)).andExpect(status().isCreated());
        // Reads never need the token.
        mvc.perform(get("/api/departments").with(admin.withoutCsrf())).andExpect(status().isOk());
    }

    @Test
    void csrfEndpointSetsAReadableTokenCookie() throws Exception {
        MockHttpServletResponse response = mvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isNoContent())
                .andExpect(cookie().exists(TestSession.XSRF_COOKIE))
                .andExpect(cookie().httpOnly(TestSession.XSRF_COOKIE, false))
                .andExpect(cookie().path(TestSession.XSRF_COOKIE, "/"))
                .andReturn().getResponse();
        String token = response.getCookie(TestSession.XSRF_COOKIE).getValue();

        // The token the server issued works for an anonymous unsafe request.
        mvc.perform(json(post("/api/auth/forgot-password"), "{\"email\":\"nobody@example.com\"}")
                        .with(new TestSession(null, token)))
                .andExpect(status().isNoContent());
    }

    // ------------------------------------------------------------------ idle timeout

    @Test
    void backgroundRequestsDoNotExtendTheIdleTime() throws Exception {
        String email = unique("idle");
        createUser(email, "MEMBER");
        TestSession session = TestSession.login(mvc, email, PASSWORD);
        long signedIn = lastAccess(email);

        Thread.sleep(20);
        mvc.perform(background(get("/api/users")).with(session)).andExpect(status().isOk());
        assertThat(lastAccess(email)).as("a background poll leaves the last access alone").isEqualTo(signedIn);

        mvc.perform(get("/api/users").with(session)).andExpect(status().isOk());
        assertThat(lastAccess(email)).as("a user request counts as activity").isGreaterThan(signedIn);
    }

    @Test
    void backgroundRequestsAloneDoNotKeepASessionAlive() throws Exception {
        String polled = unique("polled");
        String active = unique("active");
        createUser(polled, "MEMBER");
        createUser(active, "MEMBER");
        TestSession polledSession = TestSession.login(mvc, polled, PASSWORD);
        TestSession activeSession = TestSession.login(mvc, active, PASSWORD);

        // A 2-second idle timeout for these two sessions only. The application's timeout
        // (SESSION_TIMEOUT, 30 minutes) is read once at start-up, and changing it would need a
        // second Spring context, so the stored sessions are shortened instead.
        jdbc.update("UPDATE spring_session SET max_inactive_interval = 3, expiry_time = last_access_time + 3000 "
                + "WHERE principal_name IN (?, ?)", polled, active);
        long polledSince = lastAccess(polled);

        for (int i = 0; i < 3; i++) {
            Thread.sleep(500);
            mvc.perform(background(get("/api/users")).with(polledSession)).andExpect(status().isOk());
            mvc.perform(get("/api/users").with(activeSession)).andExpect(status().isOk());
        }
        Thread.sleep(Math.max(0, polledSince + 3300 - System.currentTimeMillis()));
        // More than 3 s after the polled session's last real use: it expired, the used one did not.
        mvc.perform(background(get("/api/users")).with(polledSession)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users").with(activeSession)).andExpect(status().isOk());
    }

    // ------------------------------------------------------------------ ending sessions

    @Test
    void deactivatingAUserDeletesTheirSessions() throws Exception {
        String email = unique("deact");
        long id = createUser(email, "MEMBER");
        TestSession session = TestSession.login(mvc, email, PASSWORD);
        TestSession.login(mvc, email, PASSWORD);
        assertThat(sessionRows(email)).isEqualTo(2);

        mvc.perform(json(put("/api/users/" + id), "{\"fullName\":\"Test User\",\"email\":\"" + email
                        + "\",\"role\":\"MEMBER\",\"status\":\"Inactive\",\"departmentId\":1}").with(admin()))
                .andExpect(status().isOk());

        assertThat(sessionRows(email)).isZero();
        mvc.perform(get("/api/users").with(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void deletingAUserDeletesTheirSessions() throws Exception {
        String email = unique("del");
        long id = createUser(email, "MEMBER");
        TestSession.login(mvc, email, PASSWORD);

        mvc.perform(delete("/api/users/" + id).with(admin())).andExpect(status().isNoContent());
        assertThat(sessionRows(email)).isZero();
    }

    @Test
    void resettingThePasswordDeletesTheSessions() throws Exception {
        String email = unique("reset");
        createUser(email, "MEMBER");
        TestSession session = TestSession.login(mvc, email, PASSWORD);

        String link = passwordResetService.requestReset(email).orElseThrow();
        String token = link.substring(link.indexOf("token=") + "token=".length());
        mvc.perform(json(post("/api/auth/reset-password"), "{\"token\":\"" + token + "\",\"newPassword\":\"Fresh#4821\"}")
                        .with(TestSession.ANONYMOUS))
                .andExpect(status().isNoContent());

        assertThat(sessionRows(email)).isZero();
        mvc.perform(get("/api/users").with(session)).andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------ password hashing

    @Test
    void weakerHashesAreUpgradedAtSignIn() throws Exception {
        String email = unique("rehash");
        createUser(email, "MEMBER");
        assertThat(storedHash(email)).startsWith("$2a$12$");

        jdbc.update("UPDATE users SET password = ? WHERE email = ?", new BCryptPasswordEncoder(10).encode(PASSWORD), email);
        assertThat(storedHash(email)).startsWith("$2a$10$");
        String changedAt = jdbc.queryForObject("SELECT password_changed_at::text FROM users WHERE email = ?", String.class, email);

        TestSession.login(mvc, email, PASSWORD);

        assertThat(storedHash(email)).startsWith("$2a$12$");
        assertThat(new BCryptPasswordEncoder().matches(PASSWORD, storedHash(email))).isTrue();
        assertThat(jdbc.queryForObject("SELECT password_changed_at::text FROM users WHERE email = ?", String.class, email))
                .as("a re-hash is not a password change").isEqualTo(changedAt);
    }

    private String storedHash(String email) {
        return jdbc.queryForObject("SELECT password FROM users WHERE email = ?", String.class, email);
    }

    @Test
    void commonPasswordsAreRejected() throws Exception {
        TestSession admin = admin();
        String body = "{\"fullName\":\"Test User\",\"email\":\"" + unique("common") + "\",\"role\":\"MEMBER\","
                + "\"status\":\"Active\",\"password\":\"P@ssw0rd1\",\"departmentId\":1}";
        mvc.perform(json(post("/api/users"), body).with(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("This password is too common. Choose one that is harder to guess."));

        String email = unique("commonpw");
        createUser(email, "MEMBER");
        TestSession session = TestSession.login(mvc, email, PASSWORD);
        mvc.perform(json(post("/api/auth/password"), "{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"Welcome@123\"}")
                        .with(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("too common")));
    }

    // ------------------------------------------------------------------ sessions API

    @Test
    void usersCanListAndSignOutTheirSessions() throws Exception {
        String email = unique("list");
        createUser(email, "MEMBER");
        TestSession laptop = loginWithAgent(email, "Laptop browser");
        TestSession phone = loginWithAgent(email, "Phone browser");
        TestSession tablet = loginWithAgent(email, "Tablet browser");

        String list = mvc.perform(get("/api/sessions/me").with(laptop))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[?(@.current == true)].userAgent").value(hasItem("Laptop browser")))
                .andExpect(jsonPath("$[0].ipAddress").value("127.0.0.1"))
                .andReturn().getResponse().getContentAsString();
        assertThat(list).doesNotContain(laptop.sessionId()).doesNotContain(phone.sessionId());

        List<String> phoneIds = JsonPath.read(list, "$[?(@.userAgent == 'Phone browser')].id");
        mvc.perform(delete("/api/sessions/me/" + phoneIds.get(0)).with(laptop)).andExpect(status().isNoContent());
        mvc.perform(get("/api/users").with(phone)).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/sessions/me/" + phoneIds.get(0)).with(laptop)).andExpect(status().isNotFound());

        mvc.perform(delete("/api/sessions/me/others").with(laptop)).andExpect(status().isNoContent());
        mvc.perform(get("/api/users").with(tablet)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/sessions/me").with(laptop)).andExpect(jsonPath("$", hasSize(1)));

        // Signing out the current session from the list is a sign-out.
        String current = JsonPath.read(mvc.perform(get("/api/sessions/me").with(laptop))
                .andReturn().getResponse().getContentAsString(), "$[0].id");
        mvc.perform(delete("/api/sessions/me/" + current).with(laptop)).andExpect(status().isNoContent());
        mvc.perform(get("/api/users").with(laptop)).andExpect(status().isUnauthorized());
    }

    @Test
    void adminsCanSignAUserOutEverywhere() throws Exception {
        String email = unique("everywhere");
        long id = createUser(email, "MEMBER");
        TestSession one = TestSession.login(mvc, email, PASSWORD);
        TestSession.login(mvc, email, PASSWORD);

        mvc.perform(get("/api/sessions").param("userId", Long.toString(id)).with(one)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/sessions/user/" + id).with(one)).andExpect(status().isForbidden());

        TestSession admin = admin();
        mvc.perform(get("/api/sessions").param("userId", Long.toString(id)).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].current").value(false));
        mvc.perform(delete("/api/sessions/user/" + id).with(admin)).andExpect(status().isNoContent());
        mvc.perform(get("/api/users").with(one)).andExpect(status().isUnauthorized());
        assertThat(sessionRows(email)).isZero();

        mvc.perform(get("/api/audit").param("limit", "5").with(admin))
                .andExpect(jsonPath("$[*].eventType").value(hasItem("sessions_revoked")));
        mvc.perform(get("/api/sessions").param("userId", "999999").with(admin)).andExpect(status().isNotFound());
    }

    // ------------------------------------------------------------------ organisation settings

    @Test
    void organisationSettingsAreReadableAndOnlyAdminsChangeThem() throws Exception {
        String email = unique("orgmember");
        createUser(email, "MEMBER");
        TestSession member = TestSession.login(mvc, email, PASSWORD);

        mvc.perform(get("/api/org/settings").with(member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companyName").isString())
                .andExpect(jsonPath("$.sessionTimeoutMinutes").value(30))
                .andExpect(jsonPath("$.passwordMinLength").value(8))
                .andExpect(jsonPath("$.registrationEnabled").value(true));
        mvc.perform(json(put("/api/org/settings"), "{\"companyName\":\"Hacked\"}").with(member))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/org/settings")).andExpect(status().isUnauthorized());

        TestSession admin = admin();
        mvc.perform(json(put("/api/org/settings"), "{\"passwordMinLength\":7}").with(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(json(put("/api/org/settings"), "{\"passwordMinLength\":65}").with(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(json(put("/api/org/settings"), "{\"defaultTimezone\":\"Mars/Olympus\"}").with(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(json(put("/api/org/settings"), "{\"companyName\":\"   \"}").with(admin))
                .andExpect(status().isBadRequest());

        mvc.perform(json(put("/api/org/settings"),
                        "{\"companyName\":\"  Multimedia   Entertainment Hub \",\"defaultTimezone\":\"Europe/Bucharest\"}")
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companyName").value("Multimedia Entertainment Hub"))
                .andExpect(jsonPath("$.defaultTimezone").value("Europe/Bucharest"))
                .andExpect(jsonPath("$.registrationEnabled").value(true));
    }

    @Test
    void thePasswordPolicyMinimumLengthIsEnforced() throws Exception {
        TestSession admin = admin();
        try {
            mvc.perform(json(put("/api/org/settings"), "{\"passwordMinLength\":12}").with(admin))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.passwordMinLength").value(12));

            String body = "{\"fullName\":\"Test User\",\"email\":\"" + unique("minlen") + "\",\"role\":\"MEMBER\","
                    + "\"status\":\"Active\",\"password\":\"" + PASSWORD + "\",\"departmentId\":1}";
            mvc.perform(json(post("/api/users"), body).with(admin))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Password must be at least 12 characters long"));
            mvc.perform(get("/api/auth/registration")).andExpect(jsonPath("$.passwordMinLength").value(12));
        } finally {
            mvc.perform(json(put("/api/org/settings"), "{\"passwordMinLength\":8}").with(admin))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void closedRegistrationIsRefused() throws Exception {
        TestSession admin = admin();
        String register = "{\"fullName\":\"Jane Doe\",\"phone\":\"0712345678\",\"email\":\"" + unique("closed")
                + "\",\"departmentId\":1,\"password\":\"" + PASSWORD + "\"}";
        try {
            mvc.perform(json(put("/api/org/settings"), "{\"registrationEnabled\":false}").with(admin))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.registrationEnabled").value(false));

            mvc.perform(get("/api/auth/registration"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.open").value(false));
            mvc.perform(json(post("/api/auth/register"), register).with(TestSession.ANONYMOUS))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value(containsString("Registration is closed")));
        } finally {
            mvc.perform(json(put("/api/org/settings"), "{\"registrationEnabled\":true}").with(admin))
                    .andExpect(status().isOk());
        }
        mvc.perform(get("/api/auth/registration")).andExpect(jsonPath("$.open").value(true));
        mvc.perform(json(post("/api/auth/register"), register).with(TestSession.ANONYMOUS))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/audit").param("limit", "10").with(admin))
                .andExpect(jsonPath("$[*].eventType").value(hasItem("org_settings_changed")));
    }
}
