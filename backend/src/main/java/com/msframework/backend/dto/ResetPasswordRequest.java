package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Body of {@code POST /api/auth/reset-password}. Both fields are checked by {@code PasswordResetService}. */
public record ResetPasswordRequest(
        @Schema(description = "The single-use token from the reset link", requiredMode = Schema.RequiredMode.REQUIRED)
        String token,

        @Schema(description = "Must satisfy the password policy", requiredMode = Schema.RequiredMode.REQUIRED)
        String newPassword
) {}
