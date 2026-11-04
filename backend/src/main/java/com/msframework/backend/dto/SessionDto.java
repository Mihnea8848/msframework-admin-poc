package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;

/** One signed-in session of a user. */
public record SessionDto(
        @Schema(description = "SHA-256 of the session id (hex). Use it to sign the session out; the real "
                + "session id is never sent", requiredMode = Schema.RequiredMode.REQUIRED)
        String id,

        @Schema(description = "When the user signed in", requiredMode = Schema.RequiredMode.REQUIRED)
        OffsetDateTime createdAt,

        @Schema(description = "The last request made by the user (background polls are not counted)",
                requiredMode = Schema.RequiredMode.REQUIRED)
        OffsetDateTime lastActiveAt,

        @Schema(description = "When the session ends unless it is used again",
                requiredMode = Schema.RequiredMode.REQUIRED)
        OffsetDateTime expiresAt,

        @Schema(description = "The client IP address at sign-in", example = "203.0.113.7", nullable = true)
        String ipAddress,

        @Schema(description = "The browser's User-Agent at sign-in", nullable = true)
        String userAgent,

        @Schema(description = "True for the session that made this request",
                requiredMode = Schema.RequiredMode.REQUIRED)
        boolean current
) {}
