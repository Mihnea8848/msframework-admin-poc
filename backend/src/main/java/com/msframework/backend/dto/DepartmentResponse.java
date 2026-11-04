package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record DepartmentResponse(
        Long id,
        String name,
        String color,
        long memberCount,
        @Schema(description = "The head of the department; null when it has none, or for anonymous callers")
        Long managerId,
        String managerName
) {}
