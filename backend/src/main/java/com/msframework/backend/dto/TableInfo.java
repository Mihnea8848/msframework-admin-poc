package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/** Live metadata for one database table. {@code sizeBytes} is null when the database cannot report it. */
public record TableInfo(String name, long rowCount, Long sizeBytes, List<Column> columns) {

    @Schema(name = "TableColumn")
    public record Column(String name, String type, boolean nullable) {}
}
