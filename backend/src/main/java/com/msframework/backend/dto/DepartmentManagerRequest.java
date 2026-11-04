package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Sets or clears the head of a department. */
public record DepartmentManagerRequest(
        @Schema(description = "An active member of the department with the MANAGER or ADMIN role; null clears it")
        Long userId
) {}
