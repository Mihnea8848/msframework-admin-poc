package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;

public record AuditEventDto(
        Long id,
        String eventType,
        String actorEmail,
        String description,
        OffsetDateTime createdAt,
        @Schema(description = "The user the event is about, if any") Long subjectUserId,
        @Schema(description = "The department the event is about, if any") Long subjectDepartmentId
) {}
