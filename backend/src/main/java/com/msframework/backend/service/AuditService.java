package com.msframework.backend.service;

import com.msframework.backend.entity.AuditEvent;
import com.msframework.backend.repository.AuditEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditEventRepository auditEventRepository;

    public void log(String eventType, String actorEmail, String description) {
        AuditEvent event = AuditEvent.builder()
                .eventType(eventType)
                .actorEmail(actorEmail != null ? actorEmail : "system")
                .description(description)
                .build();
        auditEventRepository.save(event);
    }
}
