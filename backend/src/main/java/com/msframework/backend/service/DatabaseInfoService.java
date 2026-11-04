package com.msframework.backend.service;

import com.msframework.backend.dto.TableInfo;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/** Live schema and row counts for the application's tables (read through JDBC metadata). */
@Service
@RequiredArgsConstructor
public class DatabaseInfoService {

    /** Fixed allow-list: these names are interpolated into SQL, so they must never come from a request. */
    private static final List<String> TABLES = List.of(
            "users", "departments", "role", "role_permissions", "user_roles",
            "audit_events", "service_connections", "webhooks", "api_keys",
            "org_settings", "password_reset_tokens",
            "access_requests"
    );

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;

    public List<TableInfo> describeTables() throws SQLException {
        List<TableInfo> result = new ArrayList<>();
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData metaData = connection.getMetaData();
            boolean postgres = "PostgreSQL".equalsIgnoreCase(metaData.getDatabaseProductName());
            String schema = connection.getSchema();

            for (String table : TABLES) {
                List<TableInfo.Column> columns = columns(metaData, connection.getCatalog(), schema, table);
                if (columns.isEmpty()) {
                    continue; // table not created yet
                }
                Long rowCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
                result.add(new TableInfo(table, rowCount == null ? 0 : rowCount, size(postgres, table), columns));
            }
        }
        return result;
    }

    private static List<TableInfo.Column> columns(DatabaseMetaData metaData, String catalog, String schema, String table)
            throws SQLException {
        List<TableInfo.Column> columns = new ArrayList<>();
        try (ResultSet rs = metaData.getColumns(catalog, schema, table, null)) {
            while (rs.next()) {
                // "_" is a wildcard in metadata patterns, so double-check the exact table name.
                if (!table.equalsIgnoreCase(rs.getString("TABLE_NAME"))) continue;
                columns.add(new TableInfo.Column(
                        rs.getString("COLUMN_NAME"),
                        rs.getString("TYPE_NAME"),
                        rs.getInt("NULLABLE") == DatabaseMetaData.columnNullable));
            }
        }
        return columns;
    }

    private Long size(boolean postgres, String table) {
        if (!postgres) return null;
        try {
            return jdbcTemplate.queryForObject("SELECT pg_total_relation_size(?::regclass)", Long.class, table);
        } catch (DataAccessException e) {
            return null;
        }
    }
}
