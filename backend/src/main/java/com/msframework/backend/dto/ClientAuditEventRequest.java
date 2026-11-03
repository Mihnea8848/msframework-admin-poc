package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Body of {@code POST /api/audit/event}: an action that happened only in the browser. */
public record ClientAuditEventRequest(
        @Schema(description = "Only export_generated is accepted; any other value is rejected with 400",
                example = "export_generated", requiredMode = Schema.RequiredMode.REQUIRED)
        String eventType,

        @Schema(description = "Shown in the audit log. Defaults to \"Exported data\" when missing or blank")
        String description
) {}
