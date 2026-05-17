package com.msframework.backend.dto;

import com.msframework.backend.config.Permission;

import java.util.Set;

public record CurrentUserDto(
        Long id,
        String fullName,
        String email,
        Set<String> roles,
        Set<Permission> permissions
) {}