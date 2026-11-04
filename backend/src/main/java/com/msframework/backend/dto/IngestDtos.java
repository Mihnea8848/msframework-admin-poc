package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Body of {@code POST /api/ingest/checkins}, sent by integrations with an API key. */
public final class IngestDtos {

    private IngestDtos() {
    }

    @Schema(name = "IngestCheckin")
    public record Item(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long goalId,
            @Schema(description = "Defaults to today. Must be inside the goal's quarter and not in the future")
            LocalDate date,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) BigDecimal value,
            @Schema(maxLength = 500) String note
    ) {}

    @Schema(name = "IngestCheckinsRequest")
    public record CheckinsRequest(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "1 to 500 check-ins")
            List<Item> checkins
    ) {}
}
