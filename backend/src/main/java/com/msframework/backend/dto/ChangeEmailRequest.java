package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Body of {@code POST /api/auth/email}. Both fields are checked by {@code UserService}. */
public record ChangeEmailRequest(
        @Schema(description = "The new email address", requiredMode = Schema.RequiredMode.REQUIRED)
        String email,

        @Schema(description = "The caller's current password, to confirm the change",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String currentPassword
) {}
