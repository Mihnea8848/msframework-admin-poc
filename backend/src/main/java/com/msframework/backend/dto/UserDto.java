package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;

/** A user as shown in lists. Never contains the password hash. */
public record UserDto(
        Long id,
        String fullName,
        String email,
        String phone,
        String status,
        Long departmentId,
        String departmentName,
        List<String> roles,
        OffsetDateTime createdAt,
        @Schema(description = "Job title, e.g. \"Senior Producer\"") String title,
        @Schema(description = "Last successful sign-in; null if the user never signed in") OffsetDateTime lastLoginAt,
        @Schema(description = "The id of the department this user is the manager (head) of, or null") Long managerOf
) {}
