package com.msframework.backend.dto;

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
        OffsetDateTime createdAt
) {}
