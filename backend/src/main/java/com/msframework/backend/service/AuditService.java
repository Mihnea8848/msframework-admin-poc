package com.msframework.backend.service;

import com.msframework.backend.dto.AuditEventDto;
import com.msframework.backend.entity.AuditEvent;
import com.msframework.backend.repository.AuditEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditService {

    private static final int MAX_LENGTH = 255;

    private final AuditEventRepository auditEventRepository;

    public void log(String eventType, String actorEmail, String description) {
        AuditEvent event = AuditEvent.builder()
                .eventType(truncate(eventType))
                .actorEmail(truncate(actorEmail != null && !actorEmail.isBlank() ? actorEmail : "system"))
                .description(truncate(description != null ? description : ""))
                .build();
        auditEventRepository.save(event);
    }

    public static AuditEventDto toDto(AuditEvent event) {
        return new AuditEventDto(event.getId(), event.getEventType(), event.getActorEmail(),
                event.getDescription(), Times.toOffset(event.getCreatedAt()));
    }

    private static String truncate(String value) {
        return value.length() <= MAX_LENGTH ? value : value.substring(0, MAX_LENGTH - 1) + "…";
    }
}
