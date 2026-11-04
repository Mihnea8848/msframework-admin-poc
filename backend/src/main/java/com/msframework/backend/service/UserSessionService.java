package com.msframework.backend.service;

import com.msframework.backend.dto.SessionDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The signed-in sessions of a user, found by principal name (the email) in the Spring Session
 * tables. The API identifies a session by the SHA-256 of its id, so the id itself, which is the
 * cookie value, is never sent to the browser.
 */
@Service
public class UserSessionService {

    /** Session attributes written at sign-in. */
    public static final String ATTR_IP = "msf.ip";
    public static final String ATTR_USER_AGENT = "msf.userAgent";

    private static final int MAX_USER_AGENT = 300;

    private final FindByIndexNameSessionRepository<? extends Session> sessions;

    public UserSessionService(FindByIndexNameSessionRepository<? extends Session> sessions) {
        this.sessions = sessions;
    }

    /** Remembers where the session was started from, for the sessions list. */
    public static void describe(HttpSession session, String ip, String userAgent) {
        session.setAttribute(ATTR_IP, ip);
        if (userAgent != null && !userAgent.isBlank()) {
            session.setAttribute(ATTR_USER_AGENT,
                    userAgent.length() > MAX_USER_AGENT ? userAgent.substring(0, MAX_USER_AGENT) : userAgent);
        }
    }

    /** The user's sessions, most recently active first, marking the one {@code request} belongs to. */
    public List<SessionDto> list(String email, HttpServletRequest request) {
        String currentId = currentId(request);
        return find(email).values().stream()
                .sorted(Comparator.comparing(Session::getLastAccessedTime).reversed())
                .map(s -> toDto(s, s.getId().equals(currentId)))
                .toList();
    }

    /** Deletes one of the user's sessions by its hashed id. Returns false when there is none. */
    public boolean revoke(String email, String hashedId) {
        Optional<String> id = find(email).keySet().stream()
                .filter(sessionId -> SecureTokens.sha256Hex(sessionId).equalsIgnoreCase(hashedId))
                .findFirst();
        id.ifPresent(sessions::deleteById);
        return id.isPresent();
    }

    /** True when {@code hashedId} is the session that made this request. */
    public boolean isCurrent(String hashedId, HttpServletRequest request) {
        String currentId = currentId(request);
        return currentId != null && SecureTokens.sha256Hex(currentId).equalsIgnoreCase(hashedId);
    }

    /** Deletes every session of the user except the one {@code request} belongs to. Returns how many. */
    public int revokeOthers(String email, HttpServletRequest request) {
        String currentId = currentId(request);
        int count = 0;
        for (String id : find(email).keySet()) {
            if (!id.equals(currentId)) {
                sessions.deleteById(id);
                count++;
            }
        }
        return count;
    }

    /** Signs the user out everywhere. Returns how many sessions were deleted. */
    public int revokeAll(String email) {
        Map<String, ? extends Session> found = find(email);
        found.keySet().forEach(sessions::deleteById);
        return found.size();
    }

    private Map<String, ? extends Session> find(String email) {
        if (email == null || email.isBlank()) return Map.of();
        return sessions.findByPrincipalName(email);
    }

    private static String currentId(HttpServletRequest request) {
        HttpSession session = request == null ? null : request.getSession(false);
        return session == null ? null : session.getId();
    }

    private static SessionDto toDto(Session session, boolean current) {
        Instant lastActive = session.getLastAccessedTime();
        return new SessionDto(
                SecureTokens.sha256Hex(session.getId()),
                toOffset(session.getCreationTime()),
                toOffset(lastActive),
                toOffset(lastActive.plus(session.getMaxInactiveInterval())),
                session.getAttribute(ATTR_IP),
                session.getAttribute(ATTR_USER_AGENT),
                current);
    }

    private static OffsetDateTime toOffset(Instant instant) {
        return instant.atZone(ZoneId.systemDefault()).toOffsetDateTime();
    }
}
