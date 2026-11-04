package com.msframework.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Background requests (polls the browser makes on its own) must not keep a session alive.
 *
 * <p>The browser marks them with {@code X-Background-Request: 1}. Spring Session sets a session's
 * last-accessed time to "now" as soon as the request touches it, and writes it back at the end of
 * the request. For a marked GET, {@link Filter} (which runs just before Spring Session's filter)
 * flags the thread; {@link Repository}, the session repository Spring Session uses, then remembers
 * the last-accessed time each session had when it was loaded and puts it back before saving. The
 * request is still authenticated normally, and an idle session still expires on time.</p>
 */
public final class BackgroundRequests {

    public static final String HEADER = "X-Background-Request";

    /** Sessions loaded during the current background request: id to original last-accessed time. */
    private static final ThreadLocal<Map<String, Instant>> LOADED = new ThreadLocal<>();

    private BackgroundRequests() {
    }

    static boolean isBackground(HttpServletRequest request) {
        return "1".equals(request.getHeader(HEADER))
                && ("GET".equals(request.getMethod()) || "HEAD".equals(request.getMethod()));
    }

    /** Flags the thread for the whole request, including Spring Session's final save. */
    public static class Filter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            if (!isBackground(request)) {
                chain.doFilter(request, response);
                return;
            }
            LOADED.set(new HashMap<>());
            try {
                chain.doFilter(request, response);
            } finally {
                LOADED.remove();
            }
        }
    }

    /** Delegates to the JDBC repository, restoring the last-accessed time during background requests. */
    public static class Repository implements FindByIndexNameSessionRepository<Session> {

        private final FindByIndexNameSessionRepository<Session> delegate;

        @SuppressWarnings("unchecked")
        public Repository(FindByIndexNameSessionRepository<? extends Session> delegate) {
            // The JDBC session class is package-private; every session passed back to save()
            // came from the delegate, so the unchecked view is safe.
            this.delegate = (FindByIndexNameSessionRepository<Session>) delegate;
        }

        @Override
        public Session createSession() {
            return delegate.createSession();
        }

        @Override
        public void save(Session session) {
            Map<String, Instant> loaded = LOADED.get();
            if (loaded != null) {
                Instant original = loaded.get(session.getId());
                if (original != null) {
                    session.setLastAccessedTime(original);
                }
            }
            delegate.save(session);
        }

        @Override
        public Session findById(String id) {
            Session session = delegate.findById(id);
            Map<String, Instant> loaded = LOADED.get();
            if (session != null && loaded != null) {
                loaded.putIfAbsent(session.getId(), session.getLastAccessedTime());
            }
            return session;
        }

        @Override
        public void deleteById(String id) {
            delegate.deleteById(id);
        }

        @Override
        public Map<String, Session> findByIndexNameAndIndexValue(String indexName, String indexValue) {
            return delegate.findByIndexNameAndIndexValue(indexName, indexValue);
        }

        @Override
        public Map<String, Session> findByPrincipalName(String principalName) {
            return delegate.findByPrincipalName(principalName);
        }
    }
}
