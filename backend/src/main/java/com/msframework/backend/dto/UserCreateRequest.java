package com.msframework.backend.dto;

/** Admin-side user creation. Missing role/status default to MEMBER/Active. */
public record UserCreateRequest(
        String fullName,
        String email,
        String phone,
        String role,
        String status,
        Long departmentId,
        String password
) {}
