package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/** One action applied to several users. Each user is checked and saved on its own. */
public record BulkUserRequest(
        @Schema(description = "User ids, 1 to 200") List<Long> ids,
        Action action,
        @Schema(description = "Required for SET_ROLE") String role,
        @Schema(description = "For SET_DEPARTMENT; null removes the users from their department") Long departmentId
) {
    public enum Action { ACTIVATE, DEACTIVATE, SET_ROLE, SET_DEPARTMENT }
}
