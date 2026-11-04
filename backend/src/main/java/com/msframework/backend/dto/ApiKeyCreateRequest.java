package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/** Body of {@code POST /api/keys}. The body itself is optional. */
public record ApiKeyCreateRequest(
        @Schema(description = "Display name, at most 60 characters. Defaults to \"API key\" when missing or blank",
                maxLength = 60)
        String name,

        @Schema(description = "What the key may do. Known scopes: ingest:checkins (POST /api/ingest/checkins). "
                + "Defaults to none")
        List<String> scopes
) {}
