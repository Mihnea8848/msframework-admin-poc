package com.msframework.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.OffsetDateTime;
import java.util.List;

/** {@code secret} is only present in the response that creates the key. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiKeyDto(
        Long id,
        String name,
        String maskedDisplay,
        String createdBy,
        OffsetDateTime createdAt,
        String lastUsed,
        List<String> scopes,
        String secret
) {}
