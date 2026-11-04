package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Rejects an access request. */
public record AccessRequestRejectRequest(
        @Schema(description = "Optional reason, at most 500 characters") String note
) {}
