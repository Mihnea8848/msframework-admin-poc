package com.msframework.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record RegisterRequest(
        @NotBlank(message = "Full name is required") String fullName,
        @NotBlank(message = "Phone number is required") String phone,
        @NotBlank(message = "Email is required") @Email String email,
        @NotNull(message = "Department ID is required") Long departmentId,
        @NotBlank(message = "Password is required") String password
) {}