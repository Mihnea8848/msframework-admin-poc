package com.msframework.backend.dto;

import java.util.List;

public final class ImportRequests {

    private ImportRequests() {
    }

    public record UserRow(String fullName, String email, String phone, String role, String status, String department) {}

    public record DepartmentRow(String name, String color) {}

    public record Users(List<UserRow> rows) {}

    public record Departments(List<DepartmentRow> rows) {}
}
