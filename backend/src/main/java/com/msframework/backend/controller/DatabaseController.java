package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.TableInfo;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.DatabaseInfoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.sql.SQLException;
import java.util.List;

@Tag(name = "Database", description = "Live database metadata")
@RestController
@RequestMapping("/api/database")
@RequiredArgsConstructor
public class DatabaseController {

    private final DatabaseInfoService databaseInfoService;
    private final CurrentUserService currentUserService;

    @Operation(operationId = "listDatabaseTables", summary = "Row counts, sizes and columns of every table")
    @GetMapping("/tables")
    public List<TableInfo> tables(Principal principal) throws SQLException {
        currentUserService.requirePermission(principal, Permission.DATABASE_READ);
        return databaseInfoService.describeTables();
    }
}
