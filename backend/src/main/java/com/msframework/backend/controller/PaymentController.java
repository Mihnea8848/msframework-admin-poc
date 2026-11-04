package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.FinanceDtos;
import com.msframework.backend.entity.User;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.ExpenseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.time.LocalDate;

@Tag(name = "Payments", description = "The ledger of outgoing payments (paid expenses)")
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final ExpenseService expenseService;
    private final CurrentUserService currentUserService;

    @Operation(operationId = "listPayments", summary = "Paid expenses with monthly totals",
            description = "Filters on the payment date. Defaults to the last six whole months up to today. No payment "
                    + "provider is connected (provider.connected is false).")
    @GetMapping
    public FinanceDtos.PaymentLedger list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long departmentId,
            @Parameter(description = "0-based") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "1 to 200") @RequestParam(defaultValue = "50") int size,
            Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.FINANCE_READ);
        return expenseService.payments(from, to, departmentId, page, size, actor);
    }
}
