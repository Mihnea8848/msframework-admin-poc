package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.TableInfo;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.DatabaseInfoService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.sql.SQLException;
import java.util.List;

@RestController
@RequestMapping("/api/database")
@RequiredArgsConstructor
public class DatabaseController {

    private final DatabaseInfoService databaseInfoService;
    private final CurrentUserService currentUserService;

    @GetMapping("/tables")
    public List<TableInfo> tables(Principal principal) throws SQLException {
        currentUserService.requirePermission(principal, Permission.DATABASE_READ);
        return databaseInfoService.describeTables();
    }
}
