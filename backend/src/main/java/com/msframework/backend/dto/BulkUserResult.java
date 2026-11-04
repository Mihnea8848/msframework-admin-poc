package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/** The outcome of a bulk action, one entry per requested id, in request order. */
public record BulkUserResult(int succeeded, int failed, List<Item> results) {

    @Schema(name = "BulkUserResultItem")
    public record Item(
            Long id,
            boolean ok,
            @Schema(description = "Why this user was not changed (written for the end user); null when ok")
            String error,
            @Schema(description = "The user after the change; null when not ok") UserDto user
    ) {}
}
