package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/** One page of an activity feed, newest first. */
public record AuditPage(
        List<AuditEventDto> items,
        @Schema(description = "Pass as `cursor` to get the next (older) page; null on the last page")
        String nextCursor
) {}
