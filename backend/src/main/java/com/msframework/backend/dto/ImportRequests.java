package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public final class ImportRequests {

    private ImportRequests() {
    }

    @Schema(name = "UserImportRow")
    public record UserRow(String fullName, String email, String phone, String role, String status, String department) {}

    @Schema(name = "DepartmentImportRow")
    public record DepartmentRow(String name, String color) {}

    @Schema(name = "UserImportRequest")
    public record Users(List<UserRow> rows) {}

    @Schema(name = "DepartmentImportRequest")
    public record Departments(List<DepartmentRow> rows) {}
}
