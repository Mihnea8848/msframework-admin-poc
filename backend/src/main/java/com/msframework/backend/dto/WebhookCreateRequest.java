package com.msframework.backend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/** Body of {@code POST /api/webhooks}. */
public record WebhookCreateRequest(
        @Schema(description = "http(s) address that receives the events, at most 255 characters",
                example = "https://example.com/hook", maxLength = 255, requiredMode = Schema.RequiredMode.REQUIRED)
        String url,

        // A single comma-separated string ("a,b") is still accepted, as it was before the body was typed.
        @JsonFormat(with = JsonFormat.Feature.ACCEPT_SINGLE_VALUE_AS_ARRAY)
        @ArraySchema(
                arraySchema = @Schema(description = "Event names to deliver; \"*\" means every event. "
                        + "Defaults to [\"*\"] when missing or empty"),
                schema = @Schema(example = "*"))
        List<String> events
) {}
