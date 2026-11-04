package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Answer of the public {@code GET /api/auth/registration}. */
public record RegistrationStatusDto(
        @Schema(description = "Whether the Register page may create accounts; hide \"Sign up\" when false",
                requiredMode = Schema.RequiredMode.REQUIRED)
        boolean open,

        @Schema(description = "Minimum length of new passwords", example = "8",
                requiredMode = Schema.RequiredMode.REQUIRED)
        int passwordMinLength
) {}
