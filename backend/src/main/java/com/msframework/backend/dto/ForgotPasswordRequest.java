package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Body of {@code POST /api/auth/forgot-password}. */
public record ForgotPasswordRequest(
        @Schema(description = "Email address of the account to reset", requiredMode = Schema.RequiredMode.REQUIRED)
        String email
) {}
