package com.msframework.backend.dto;

import com.msframework.backend.config.Permission;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

/** Everything the user profile page shows about one user. */
public record UserDetailsDto(
        Long id,
        String fullName,
        String email,
        String phone,
        String title,
        String status,
        Long departmentId,
        String departmentName,
        String departmentColor,
        @Schema(description = "The head of the user's department, if it has one") Long departmentManagerId,
        String departmentManagerName,
        List<String> roles,
        @Schema(description = "Everything the user's roles allow") Set<Permission> permissions,
        @Schema(description = "The department this user is the head of, or null") Long managerOf,
        String managerOfName,
        OffsetDateTime createdAt,
        OffsetDateTime lastLoginAt,
        OffsetDateTime passwordChangedAt,
        @Schema(description = "Whether the caller may edit this user (USER_UPDATE and the manager scope rules)")
        boolean canEdit
) {}
