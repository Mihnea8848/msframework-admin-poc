package com.msframework.backend.dto;

import com.msframework.backend.entity.AccessRequest;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;

/** A self-registration request. Never contains the password hash. */
public record AccessRequestDto(
        Long id,
        String fullName,
        String email,
        String phone,
        @Schema(description = "The department the person asked to join") Long departmentId,
        String departmentName,
        AccessRequest.Status status,
        OffsetDateTime createdAt,
        @Schema(description = "Email of the administrator who decided") String decidedBy,
        OffsetDateTime decidedAt,
        @Schema(description = "The reason given when the request was rejected") String note,
        @Schema(description = "The account created on approval") Long userId
) {}
