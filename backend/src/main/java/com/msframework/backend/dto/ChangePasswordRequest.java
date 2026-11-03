package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Body of {@code POST /api/auth/password}. Both fields are checked by {@code UserService}. */
public record ChangePasswordRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        String currentPassword,

        @Schema(description = "Must satisfy the password policy", requiredMode = Schema.RequiredMode.REQUIRED)
        String newPassword
) {}
