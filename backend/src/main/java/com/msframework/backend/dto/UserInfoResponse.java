package com.msframework.backend.dto;

public record UserInfoResponse(
        Long id,
        String fullName,
        String email,
        String role,
        String status,
        String departmentName
) {}