package com.msframework.backend.dto;

import java.util.List;

public record ImportResult(int created, int skipped, List<RowError> errors) {

    /** {@code row} is 1-based and refers to data rows (the header is not counted). */
    public record RowError(int row, String message) {}
}
