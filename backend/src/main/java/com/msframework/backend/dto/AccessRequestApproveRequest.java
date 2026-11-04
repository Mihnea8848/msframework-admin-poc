package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Approves an access request. */
public record AccessRequestApproveRequest(
        @Schema(description = "Role of the new account; defaults to MEMBER") String role,
        @Schema(description = "Department of the new account; defaults to the one requested") Long departmentId
) {}
