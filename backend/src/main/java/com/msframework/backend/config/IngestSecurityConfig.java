package com.msframework.backend.config;

import com.msframework.backend.repository.ApiKeyRepository;
import jakarta.servlet.http.HttpServletResponse;
import com.msframework.backend.service.IngestService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.context.NullSecurityContextRepository;

import java.io.IOException;

/**
 * The machine-to-machine API under {@code /api/ingest/**}: its own filter chain, ordered before the
 * session chain in {@link SecurityConfig}, so none of the browser rules (session cookie, CSRF)
 * apply here and the session chain never sees these paths.
 *
 * <ul>
 *   <li>Every request authenticates with an API key ({@link ApiKeyAuthenticationFilter});</li>
 *   <li>it is stateless: no session is read or created, and nothing is remembered between requests;</li>
 *   <li>each endpoint needs the key's scope, e.g. {@code ingest:checkins}.</li>
 * </ul>
 */
@Configuration
public class IngestSecurityConfig {

    public static final String PATHS = "/api/ingest/**";

    @Bean
    @Order(1)
    public SecurityFilterChain ingestFilterChain(HttpSecurity http, ApiKeyRepository apiKeyRepository) throws Exception {
        http
                .securityMatcher(PATHS)
                // CSRF-exempt on purpose: these requests carry an API key in the Authorization header
                // and never a session cookie, so a cross-site page has nothing to ride on.
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .securityContext(context -> context.securityContextRepository(new NullSecurityContextRepository()))
                .addFilterBefore(new ApiKeyAuthenticationFilter(apiKeyRepository), AnonymousAuthenticationFilter.class)
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, e) ->
                                writeError(response, 401, "Unauthorized", "Invalid API key"))
                        .accessDeniedHandler((request, response, e) ->
                                writeError(response, 403, "Forbidden",
                                        "This API key does not have the scope this endpoint needs"))
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/ingest/checkins")
                        .hasAuthority("SCOPE_" + IngestService.SCOPE_CHECKINS)
                        .anyRequest().denyAll()
                );
        return http.build();
    }

    /** The same JSON error body as the rest of the API (ErrorResponse). */
    static void writeError(HttpServletResponse response, int status, String error, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(
                "{\"status\":" + status + ",\"error\":\"" + error + "\",\"message\":\"" + message + "\"}");
    }
}
