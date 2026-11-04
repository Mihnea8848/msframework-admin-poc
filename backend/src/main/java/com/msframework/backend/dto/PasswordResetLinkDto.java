package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;

/** A password reset link made by an administrator. It is shown once and never stored in clear. */
public record PasswordResetLinkDto(
        @Schema(description = "Single-use link to the reset page; give it to the user") String link,
        OffsetDateTime expiresAt
) {}
