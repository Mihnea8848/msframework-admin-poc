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

    // Business imports. Cells are the raw CSV strings; each row is validated on the server.

    @Schema(name = "ExpenseImportRow", description = "Department and category by name; date as YYYY-MM-DD; status "
            + "DRAFT, SUBMITTED, APPROVED or PAID (default SUBMITTED); submitterEmail defaults to the importer")
    public record ExpenseRow(String department, String category, String amount, String date, String vendor,
                             String description, String reference, String status, String submitterEmail) {}

    @Schema(name = "ExpenseImportRequest")
    public record Expenses(List<ExpenseRow> rows) {}

    @Schema(name = "BudgetImportRow", description = "Department and category by name; quarter 1 to 4 (or Q1 to Q4)")
    public record BudgetRow(String department, String category, String year, String quarter, String amount, String notes) {}

    @Schema(name = "BudgetImportRequest")
    public record Budgets(List<BudgetRow> rows) {}

    @Schema(name = "CheckinImportRow", description = "The goal by goalId, or by department and goal name (the goal of "
            + "the quarter that contains the date); date as YYYY-MM-DD, default today")
    public record CheckinRow(String goalId, String department, String goal, String date, String value, String note) {}

    @Schema(name = "CheckinImportRequest")
    public record Checkins(List<CheckinRow> rows) {}
}
