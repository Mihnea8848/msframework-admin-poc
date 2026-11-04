package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** The organisation settings, as returned by {@code GET /api/org/settings}. */
public record OrgSettingsDto(
        @Schema(description = "The company name shown in the app", example = "Multimedia Entertainment Hub",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String companyName,

        @Schema(description = "Whether the public Register page may create accounts",
                requiredMode = Schema.RequiredMode.REQUIRED)
        boolean registrationEnabled,

        @Schema(description = "Minimum length of new passwords (8 to 64)", example = "8",
                requiredMode = Schema.RequiredMode.REQUIRED)
        int passwordMinLength,

        @Schema(description = "Minutes without activity after which a session ends. Read-only: set by the "
                + "SESSION_TIMEOUT environment variable", example = "30", requiredMode = Schema.RequiredMode.REQUIRED)
        long sessionTimeoutMinutes,

        @Schema(description = "The organisation's default IANA timezone, or null when none was chosen",
                example = "Europe/Bucharest", nullable = true)
        String defaultTimezone
) {}
