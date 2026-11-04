package com.msframework.backend;

import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A browser for MockMvc tests: the {@code SESSION} cookie (Spring Session) and the CSRF token,
 * sent as the {@code XSRF-TOKEN} cookie plus the {@code X-XSRF-TOKEN} header like the frontend
 * does. Apply it with {@code .with(session)}; it replaces any session or token set before it.
 *
 * <p>{@link #ANONYMOUS} has a token but no session. The token is any value the client chooses
 * (Spring checks that the header matches the cookie), so no round trip is needed.</p>
 */
public record TestSession(String sessionId, String xsrfToken) implements RequestPostProcessor {

    public static final String SESSION_COOKIE = "SESSION";
    public static final String XSRF_COOKIE = "XSRF-TOKEN";
    public static final String XSRF_HEADER = "X-XSRF-TOKEN";

    public static final TestSession ANONYMOUS = new TestSession(null, "test-" + UUID.randomUUID());

    /** Signs in through the API and returns the resulting session. */
    public static TestSession login(MockMvc mvc, String email, String password) throws Exception {
        MockHttpServletResponse response = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}")
                        .with(ANONYMOUS))
                .andReturn().getResponse();
        assertThat(response.getStatus()).as("sign-in of %s: %s", email, response.getContentAsString())
                .isEqualTo(200);
        return fromResponse(response, ANONYMOUS.xsrfToken());
    }

    /** The session and CSRF cookies a response set, falling back to {@code xsrfToken}. */
    public static TestSession fromResponse(MockHttpServletResponse response, String xsrfToken) {
        Cookie session = response.getCookie(SESSION_COOKIE);
        assertThat(session).as("SESSION cookie").isNotNull();
        Cookie xsrf = response.getCookie(XSRF_COOKIE);
        String token = xsrf != null && xsrf.getValue() != null && !xsrf.getValue().isEmpty() ? xsrf.getValue() : xsrfToken;
        return new TestSession(session.getValue(), token);
    }

    /** The same session without a CSRF token. */
    public TestSession withoutCsrf() {
        return new TestSession(sessionId, null);
    }

    @Override
    public MockHttpServletRequest postProcessRequest(MockHttpServletRequest request) {
        List<Cookie> cookies = new ArrayList<>();
        if (request.getCookies() != null) {
            Arrays.stream(request.getCookies())
                    .filter(c -> !SESSION_COOKIE.equals(c.getName()) && !XSRF_COOKIE.equals(c.getName()))
                    .forEach(cookies::add);
        }
        request.removeHeader(XSRF_HEADER);
        if (sessionId != null) {
            cookies.add(new Cookie(SESSION_COOKIE, sessionId));
        }
        if (xsrfToken != null) {
            cookies.add(new Cookie(XSRF_COOKIE, xsrfToken));
            request.addHeader(XSRF_HEADER, xsrfToken);
        }
        request.setCookies(cookies.isEmpty() ? null : cookies.toArray(Cookie[]::new));
        return request;
    }
}
