package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/** One page of a user search. */
public record UserPage(
        List<UserDto> items,
        @Schema(description = "Users matching the filters, on all pages") long total,
        @Schema(description = "Zero-based page number") int page,
        int size,
        int totalPages
) {}
