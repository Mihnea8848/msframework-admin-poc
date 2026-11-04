package com.msframework.backend.config;

import com.msframework.backend.entity.ApiKey;
import com.msframework.backend.repository.ApiKeyRepository;
import com.msframework.backend.service.IngestService;
import com.msframework.backend.service.SecureTokens;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * Authenticates {@code Authorization: Bearer <api key>} on the ingest chain only (see
 * {@link IngestSecurityConfig}). Keys are looked up by their SHA-256 hash; each scope becomes an
 * authority {@code SCOPE_<scope>}. A missing or unknown key is answered with 401 here; a known key
 * without the needed scope gets 403 from the authorization rules.
 *
 * <p>Not a Spring bean on purpose: Boot would register a bean filter for every request.</p>
 */
public class ApiKeyAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER = "Bearer ";

    private final ApiKeyRepository apiKeyRepository;

    public ApiKeyAuthenticationFilter(ApiKeyRepository apiKeyRepository) {
        this.apiKeyRepository = apiKeyRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.regionMatches(true, 0, BEARER, 0, BEARER.length())) {
            IngestSecurityConfig.writeError(response, 401, "Unauthorized",
                    "Send an API key as: Authorization: Bearer <key>");
            return;
        }
        String secret = header.substring(BEARER.length()).trim();
        Optional<ApiKey> key = secret.isEmpty() ? Optional.empty()
                : apiKeyRepository.findByKeyHash(SecureTokens.sha256Hex(secret));
        if (key.isEmpty()) {
            IngestSecurityConfig.writeError(response, 401, "Unauthorized", "Invalid API key");
            return;
        }

        ApiKey apiKey = key.get();
        List<SimpleGrantedAuthority> authorities = apiKey.scopeSet().stream()
                .map(scope -> new SimpleGrantedAuthority("SCOPE_" + scope))
                .toList();
        UsernamePasswordAuthenticationToken authentication = UsernamePasswordAuthenticationToken.authenticated(
                new IngestService.KeyPrincipal(apiKey.getId(), apiKey.getName()), null, authorities);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
