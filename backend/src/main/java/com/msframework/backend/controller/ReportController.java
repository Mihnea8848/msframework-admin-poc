package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.ReportDtos;
import com.msframework.backend.entity.User;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.FiscalPeriods;
import com.msframework.backend.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.Writer;
import java.security.Principal;
import java.time.LocalDate;
import java.util.Locale;

@Tag(name = "Reports", description = "Spending, budget, performance and headcount reports, and CSV exports")
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;

    @Operation(operationId = "getReportOverview", summary = "Spending, budget, performance and headcount for a date range",
            description = "Defaults to the last six whole months up to today. Spend is APPROVED plus PAID expenses dated "
                    + "in the range; budget is prorated by day (a quarter's budget times the share of its days inside the "
                    + "range); performance is for the quarter that contains 'to'.")
    @GetMapping("/overview")
    public ReportDtos.Overview overview(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Principal principal) {
        currentUserService.requirePermission(principal, Permission.REPORTS_READ);
        return reportService.overview(from, to);
    }

    @Operation(operationId = "exportReportCsv", summary = "Download a CSV export",
            description = "expenses (needs FINANCE_READ too): every expense dated in the range; budgets: the budget lines "
                    + "of the quarters that overlap it, with spent and remaining; performance: every goal of those "
                    + "quarters with its attainment. UTF-8, comma separated, header row first.")
    @ApiResponse(responseCode = "200", description = "The CSV file",
            content = @Content(mediaType = "text/csv", schema = @Schema(type = "string")))
    @GetMapping("/export.csv")
    public void export(
            @Parameter(description = "expenses, budgets or performance") @RequestParam(required = false) String type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Principal principal, HttpServletResponse response) throws IOException {
        User actor = currentUserService.requirePermission(principal, Permission.REPORTS_READ);
        ReportService.ExportType exportType = ReportService.parseType(type);
        if (exportType == ReportService.ExportType.EXPENSES) {
            currentUserService.requirePermission(principal, Permission.FINANCE_READ);
        }
        LocalDate[] range = FiscalPeriods.resolveRange(from, to);
        String name = exportType.name().toLowerCase(Locale.ROOT);

        response.setContentType("text/csv");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Content-Disposition",
                "attachment; filename=\"msframework-" + name + "-" + range[0] + "-to-" + range[1] + ".csv\"");
        Writer writer = response.getWriter();
        int rows = reportService.export(exportType, range[0], range[1], writer);
        writer.flush();
        auditService.log("report_exported", actor.getEmail(),
                "Exported " + rows + " " + name + " row(s) to CSV (" + range[0] + " to " + range[1] + ")");
    }
}
