package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Body of {@code PUT /api/settings/{key}}. */
public record SettingValueRequest(
        @Schema(description = "For orgTimezone, an IANA zone id such as \"Europe/Bucharest\". For worldClocks, "
                + "a JSON array of {\"label\", \"tz\"} objects encoded as a string",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String value
) {}
