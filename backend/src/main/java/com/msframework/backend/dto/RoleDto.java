package com.msframework.backend.dto;

import com.msframework.backend.config.Permission;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.Set;

/** A role with what it allows and how many users have it. */
public record RoleDto(
        String name,
        String description,
        @Schema(description = "Whether the role is defined in SystemRoles (reset on every start-up)") boolean builtIn,
        Set<Permission> permissions,
        long memberCount,
        long activeMemberCount
) {}
