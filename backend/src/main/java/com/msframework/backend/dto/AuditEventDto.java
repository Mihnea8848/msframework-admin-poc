package com.msframework.backend.dto;

import java.time.OffsetDateTime;

public record AuditEventDto(Long id, String eventType, String actorEmail, String description, OffsetDateTime createdAt) {}
