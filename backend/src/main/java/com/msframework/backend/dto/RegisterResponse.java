package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** The answer to a self-registration: the request now waits for an administrator. */
public record RegisterResponse(
        @Schema(description = "Message to show to the person who registered") String message
) {}
