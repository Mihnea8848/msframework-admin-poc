package com.msframework.backend.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.csrf.CsrfTokenRepository;

import java.io.IOException;

/**
 * Session-cookie authentication for the JSON API.
 *
 * <p>Fine-grained authorization (permissions, manager/department scoping) is enforced per endpoint
 * through {@code CurrentUserService}, which reads the user's roles from the database on every
 * request so role changes take effect immediately.</p>
 *
 * <p>Sessions are stored in PostgreSQL (Spring Session JDBC, see {@link SessionConfig}).</p>
 *
 * <p>CSRF uses Spring Security's single-page-app setup: the token is in the readable
 * {@code XSRF-TOKEN} cookie and every POST, PUT, PATCH and DELETE must echo it in the
 * {@code X-XSRF-TOKEN} header. {@code GET /api/auth/csrf} sets the cookie. The session cookie is
 * also {@code SameSite=Lax}.</p>
 *
 * <p>{@code /api/ingest/**} is not handled here: {@link IngestSecurityConfig} gives it its own
 * stateless chain (API key, no session, CSRF-exempt), ordered before this one.</p>
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /** BCrypt cost factor. Older, weaker hashes are re-hashed at the next sign-in. */
    public static final int BCRYPT_STRENGTH = 12;

    /**
     * Requests that are not authenticated by the session cookie, so CSRF does not apply to them.
     * Keep this empty unless an endpoint is authenticated some other way.
     * INGEST: the API-key metric ingest endpoint ("/api/ingest/**") belongs here once it exists
     * and authenticates by API key only (never by session cookie).
     */
    private static final String[] CSRF_EXEMPT = {};

    static final String CSRF_MESSAGE = "Your security token (CSRF) is missing or out of date. Reload the page and try again.";

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           SecurityContextRepository securityContextRepository,
                                           CsrfTokenRepository csrfTokenRepository) throws Exception {
        http
                .csrf(csrf -> {
                    csrf.spa().csrfTokenRepository(csrfTokenRepository);
                    if (CSRF_EXEMPT.length > 0) {
                        csrf.ignoringRequestMatchers(CSRF_EXEMPT);
                    }
                })
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .securityContext(context -> context.securityContextRepository(securityContextRepository))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, e) ->
                                writeError(response, 401, "Unauthorized", "Not authenticated"))
                        .accessDeniedHandler((request, response, e) -> {
                            if (e instanceof CsrfException) {
                                writeError(response, 403, "Forbidden", CSRF_MESSAGE);
                            } else {
                                writeError(response, 403, "Forbidden", "Access denied");
                            }
                        })
                )
                .authorizeHttpRequests(auth -> auth
                        // Spring's error page must be reachable, otherwise every error is reported as 401/403.
                        .requestMatchers("/error").permitAll()
                        // OpenAPI description; production turns it off (springdoc.api-docs.enabled=false).
                        .requestMatchers(HttpMethod.GET, "/v3/api-docs", "/v3/api-docs/**").permitAll()
                        .requestMatchers(HttpMethod.POST,
                                "/api/auth/login",
                                "/api/auth/register",
                                "/api/auth/logout",
                                "/api/auth/forgot-password",
                                "/api/auth/reset-password").permitAll()
                        // /me answers "null" for anonymous visitors; departments feed the register form;
                        // csrf sets the token cookie; registration says whether sign-up is open.
                        .requestMatchers(HttpMethod.GET,
                                "/api/auth/me",
                                "/api/auth/csrf",
                                "/api/auth/registration",
                                "/api/departments").permitAll()
                        .anyRequest().authenticated()
                );

        return http.build();
    }

    /** The XSRF-TOKEN cookie: readable by the page's JavaScript, SameSite=Lax, path "/". */
    @Bean
    public CsrfTokenRepository csrfTokenRepository() {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookiePath("/");
        repository.setCookieCustomizer(cookie -> cookie.sameSite("Lax"));
        return repository;
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(BCRYPT_STRENGTH);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    private static void writeError(HttpServletResponse response, int status, String error, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(
                "{\"status\":" + status + ",\"error\":\"" + error + "\",\"message\":\"" + message + "\"}");
    }
}
