package com.msframework.backend.config;

import com.msframework.backend.repository.UserRepository;
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
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

import java.io.IOException;

/**
 * Session-cookie authentication for the JSON API.
 *
 * <p>Fine-grained authorization (permissions, manager/department scoping) is enforced per endpoint
 * through {@code CurrentUserService}, which reads the user's roles from the database on every
 * request so role changes take effect immediately.</p>
 *
 * <p>CSRF tokens are disabled because the session cookie is {@code SameSite=Lax} (see
 * application.properties) and every state-changing endpoint only accepts JSON, which a
 * cross-site form cannot send.</p>
 *
 * <p>{@code /api/ingest/**} is not handled here: {@link IngestSecurityConfig} gives it its own
 * stateless chain (API key, no session, CSRF-exempt), ordered before this one.</p>
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, SecurityContextRepository securityContextRepository) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .securityContext(context -> context.securityContextRepository(securityContextRepository))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, e) ->
                                writeError(response, 401, "Unauthorized", "Not authenticated"))
                        .accessDeniedHandler((request, response, e) ->
                                writeError(response, 403, "Forbidden", "Access denied"))
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
                        // /me answers "null" for anonymous visitors; departments feed the register form.
                        .requestMatchers(HttpMethod.GET, "/api/auth/me", "/api/departments").permitAll()
                        .anyRequest().authenticated()
                );

        return http.build();
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService userDetailsService(UserRepository userRepository) {
        return email -> {
            com.msframework.backend.entity.User user = userRepository.findByEmailIgnoreCase(email)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found"));

            // Account status is checked after the password, in AuthController, so that the
            // "inactive" state is never revealed to someone who does not know the password.
            return User.builder()
                    .username(user.getEmail())
                    .password(user.getPassword() == null ? "" : user.getPassword())
                    .roles("USER")
                    .build();
        };
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
