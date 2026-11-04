package com.msframework.backend.service;

import com.msframework.backend.dto.AuditEventDto;
import com.msframework.backend.dto.AuditPage;
import com.msframework.backend.entity.AuditEvent;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.AuditEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditService {

    private static final int MAX_LENGTH = 255;
    public static final int MAX_PAGE_SIZE = 100;

    private final AuditEventRepository auditEventRepository;
    private final NamedParameterJdbcTemplate jdbc;

    /** What an event is about: a user, a department, both or neither. Feeds the activity endpoints. */
    public record Subject(Long userId, Long departmentId) {
        public static final Subject NONE = new Subject(null, null);

        public static Subject user(Long userId) {
            return new Subject(userId, null);
        }

        public static Subject department(Long departmentId) {
            return new Subject(null, departmentId);
        }
    }

    public void log(String eventType, String actorEmail, String description) {
        log(eventType, actorEmail, description, Subject.NONE);
    }

    public void log(String eventType, String actorEmail, String description, Subject subject) {
        Subject about = subject == null ? Subject.NONE : subject;
        AuditEvent event = AuditEvent.builder()
                .eventType(truncate(eventType))
                .actorEmail(truncate(actorEmail != null && !actorEmail.isBlank() ? actorEmail : "system"))
                .description(truncate(description != null ? description : ""))
                .subjectUserId(about.userId())
                .subjectDepartmentId(about.departmentId())
                .build();
        auditEventRepository.save(event);
    }

    public static AuditEventDto toDto(AuditEvent event) {
        return new AuditEventDto(event.getId(), event.getEventType(), event.getActorEmail(),
                event.getDescription(), Times.toOffset(event.getCreatedAt()),
                event.getSubjectUserId(), event.getSubjectDepartmentId());
    }

    // ------------------------------------------------------------------ activity feeds

    /** Events where the user is the actor (by email) or the subject, newest first. */
    public AuditPage userActivity(long userId, String email, String cursor, int limit) {
        return page("(actor_email = :email OR subject_user_id = :userId)",
                new MapSqlParameterSource().addValue("email", email).addValue("userId", userId), cursor, limit);
    }

    /** Events about the department, newest first. */
    public AuditPage departmentActivity(long departmentId, String cursor, int limit) {
        return page("subject_department_id = :departmentId",
                new MapSqlParameterSource().addValue("departmentId", departmentId), cursor, limit);
    }

    /**
     * Keyset pagination on (created_at, id): the cursor is the position of the last event returned,
     * so pages stay stable while new events are written.
     */
    private AuditPage page(String filter, MapSqlParameterSource params, String cursor, int limit) {
        int size = Math.max(1, Math.min(limit, MAX_PAGE_SIZE));
        StringBuilder sql = new StringBuilder("SELECT id, event_type, actor_email, description, created_at, "
                + "subject_user_id, subject_department_id FROM audit_events WHERE ").append(filter);
        if (cursor != null && !cursor.isBlank()) {
            Position after = Position.decode(cursor);
            sql.append(" AND (created_at < :cursorAt OR (created_at = :cursorAt AND id < :cursorId))");
            params.addValue("cursorAt", Timestamp.valueOf(after.createdAt())).addValue("cursorId", after.id());
        }
        sql.append(" ORDER BY created_at DESC, id DESC LIMIT :limit");
        params.addValue("limit", size + 1);

        List<AuditEvent> rows = jdbc.query(sql.toString(), params, (rs, i) -> AuditEvent.builder()
                .id(rs.getLong("id"))
                .eventType(rs.getString("event_type"))
                .actorEmail(rs.getString("actor_email"))
                .description(rs.getString("description"))
                .createdAt(rs.getTimestamp("created_at").toLocalDateTime())
                .subjectUserId(rs.getObject("subject_user_id", Long.class))
                .subjectDepartmentId(rs.getObject("subject_department_id", Long.class))
                .build());

        boolean more = rows.size() > size;
        List<AuditEvent> items = more ? rows.subList(0, size) : rows;
        String next = more ? new Position(items.getLast().getCreatedAt(), items.getLast().getId()).encode() : null;
        return new AuditPage(items.stream().map(AuditService::toDto).toList(), next);
    }

    /** A keyset position, sent to the client as an opaque base64url string. */
    private record Position(LocalDateTime createdAt, long id) {
        String encode() {
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString((createdAt + "|" + id).getBytes(StandardCharsets.UTF_8));
        }

        static Position decode(String cursor) {
            try {
                String raw = new String(Base64.getUrlDecoder().decode(cursor.trim()), StandardCharsets.UTF_8);
                int bar = raw.indexOf('|');
                return new Position(LocalDateTime.parse(raw.substring(0, bar)), Long.parseLong(raw.substring(bar + 1)));
            } catch (RuntimeException e) {
                throw ApiException.badRequest("Invalid cursor");
            }
        }
    }

    private static String truncate(String value) {
        return value.length() <= MAX_LENGTH ? value : value.substring(0, MAX_LENGTH - 1) + "…";
    }
}
