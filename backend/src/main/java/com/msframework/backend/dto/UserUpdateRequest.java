package com.msframework.backend.dto;

/**
 * Full update of a user's profile. {@code phone} and {@code title} are optional: null keeps the
 * current value, an empty string clears it. A null {@code departmentId} removes the user from their
 * department.
 */
public record UserUpdateRequest(
        String fullName,
        String email,
        String phone,
        String role,
        String status,
        Long departmentId,
        String title
) {}
