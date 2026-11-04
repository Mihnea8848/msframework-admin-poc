package com.msframework.backend.service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.stereotype.Service;

/** Stores the authenticated principal in the HTTP session (kept in PostgreSQL by Spring Session). */
@Service
public class AuthSessionService {

    private final SecurityContextRepository securityContextRepository;
    private final UserDetailsService userDetailsService;
    private final CsrfTokenRepository csrfTokenRepository;
    private final ClientIpResolver clientIpResolver;

    public AuthSessionService(SecurityContextRepository securityContextRepository,
                              UserDetailsService userDetailsService,
                              CsrfTokenRepository csrfTokenRepository,
                              ClientIpResolver clientIpResolver) {
        this.securityContextRepository = securityContextRepository;
        this.userDetailsService = userDetailsService;
        this.clientIpResolver = clientIpResolver;
        this.csrfTokenRepository = csrfTokenRepository;
    }

    /**
     * Signs the request in. Rotates the session id (against session fixation) and the CSRF token,
     * and records the client's IP and browser for the sessions list.
     */
    public void establish(Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        save(authentication, request, response);
        UserSessionService.describe(request.getSession(), clientIpResolver.resolve(request), request.getHeader("User-Agent"));
        // A new CSRF token for the new session; the cookie is replaced in this response.
        csrfTokenRepository.saveToken(csrfTokenRepository.generateToken(request), request, response);
    }

    /** Re-binds the session to a user whose email (= principal name) just changed. */
    public void refreshPrincipal(String email, HttpServletRequest request, HttpServletResponse response) {
        UserDetails details = userDetailsService.loadUserByUsername(email);
        Authentication authentication =
                UsernamePasswordAuthenticationToken.authenticated(details, null, details.getAuthorities());
        save(authentication, request, response);
    }

    public void clear(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
    }

    private void save(Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }
}
