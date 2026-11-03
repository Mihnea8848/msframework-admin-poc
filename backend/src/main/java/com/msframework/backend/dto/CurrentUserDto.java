package com.msframework.backend.dto;

import com.msframework.backend.config.Permission;

import java.util.List;
import java.util.Set;

/** The signed-in user, as returned by /api/auth/me and /api/auth/login. */
public record CurrentUserDto(
        Long id,
        String fullName,
        String email,
        String phone,
        String status,
        Long departmentId,
        String departmentName,
        List<String> roles,
        Set<Permission> permissions
) {}
