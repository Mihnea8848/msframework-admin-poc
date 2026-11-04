package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Body of {@code PUT /api/org/settings}. Fields left out (or null) keep their current value. */
public record OrgSettingsRequest(
        @Schema(description = "1 to 100 characters", example = "Multimedia Entertainment Hub", nullable = true)
        String companyName,

        @Schema(description = "Whether the public Register page may create accounts", nullable = true)
        Boolean registrationEnabled,

        @Schema(description = "Minimum length of new passwords, 8 to 64", example = "12", nullable = true)
        Integer passwordMinLength,

        @Schema(description = "An IANA timezone id", example = "Europe/Bucharest", nullable = true)
        String defaultTimezone
) {}
