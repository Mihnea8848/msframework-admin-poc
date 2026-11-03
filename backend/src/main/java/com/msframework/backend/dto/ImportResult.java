package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record ImportResult(int created, int skipped, List<RowError> errors) {

    /** {@code row} is 1-based and refers to data rows (the header is not counted). */
    @Schema(name = "ImportRowError")
    public record RowError(int row, String message) {}
}
