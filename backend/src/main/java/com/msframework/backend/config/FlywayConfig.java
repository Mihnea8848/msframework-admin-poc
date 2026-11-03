package com.msframework.backend.config;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.Configuration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Runs the Flyway migrations on start-up, with a guarded baseline for databases created before
 * Flyway (by Hibernate {@code ddl-auto=update}).
 *
 * <ul>
 *   <li>Schema history table present: migrate.</li>
 *   <li>No history and no tables: migrate (V1 creates everything).</li>
 *   <li>No history but tables that look like an MSFramework schema: baseline at
 *       {@code spring.flyway.baseline-version} (1), then migrate, so V2 converges the old
 *       schema.</li>
 *   <li>Anything else: refuse to start. Arbitrary databases are never baselined.</li>
 * </ul>
 */
@org.springframework.context.annotation.Configuration(proxyBeanMethods = false)
public class FlywayConfig {

    private static final Logger log = LoggerFactory.getLogger(FlywayConfig.class);

    /** Tables every version of the app has had since the first commit. */
    static final Map<String, List<String>> REQUIRED_COLUMNS = Map.of(
            "users", List.of("id", "email"),
            "departments", List.of("id", "name"));

    /** Every table any version of the app has created. Other tables mean a foreign database. */
    static final Set<String> KNOWN_TABLES = Set.of(
            "users", "departments", "role", "role_permissions", "user_roles", "audit_events",
            "api_keys", "org_settings", "service_connections", "webhooks", "password_reset_tokens");

    /** Serialises the decision and the baseline when several instances start at once. */
    private static final String BASELINE_LOCK = "SELECT pg_advisory_lock(hashtext('msf-flyway-baseline'))";
    private static final String BASELINE_UNLOCK = "SELECT pg_advisory_unlock(hashtext('msf-flyway-baseline'))";

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return FlywayConfig::migrate;
    }

    /** The guarded migration described on the class. Also used by the migration tests. */
    public static void migrate(Flyway flyway) {
        Configuration config = flyway.getConfiguration();
        DataSource dataSource = config.getDataSource();
        try (Connection lockConnection = dataSource.getConnection()) {
            execute(lockConnection, BASELINE_LOCK);
            try {
                migrateLocked(flyway, config, lockConnection);
            } finally {
                execute(lockConnection, BASELINE_UNLOCK);
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not inspect the database before migrating: " + e.getMessage(), e);
        }
    }

    private static void migrateLocked(Flyway flyway, Configuration config, Connection connection) throws SQLException {
        String schema = config.getDefaultSchema() != null ? config.getDefaultSchema() : connection.getSchema();
        Set<String> tables = tables(connection, schema);

        if (tables.contains(config.getTable())) {
            flyway.migrate();
            return;
        }
        if (tables.isEmpty()) {
            log.info("[FLYWAY] Empty database: creating the schema from the migrations");
            flyway.migrate();
            return;
        }

        String problem = whyNotMsframework(connection, schema, tables);
        if (problem != null) {
            throw new IllegalStateException("The database is not empty and does not look like an MSFramework "
                    + "schema (" + problem + "), so it will not be baselined. Point DB_URL at an empty database "
                    + "or at an MSFramework database.");
        }

        String version = config.getBaselineVersion().getVersion();
        log.warn("[FLYWAY] Found an MSFramework database from before Flyway (tables: {}). Baselining it at version "
                + "{} and running the later migrations to bring it in line with a fresh database.", tables, version);
        flyway.baseline();
        int applied = flyway.migrate().migrationsExecuted;
        log.warn("[FLYWAY] Legacy database baselined at version {}; {} migration(s) applied", version, applied);
    }

    /** Returns why the tables are not an MSFramework schema, or null when they are. */
    private static String whyNotMsframework(Connection connection, String schema, Set<String> tables)
            throws SQLException {
        Set<String> unknown = new TreeSet<>(tables);
        unknown.removeAll(KNOWN_TABLES);
        if (!unknown.isEmpty()) {
            return "unknown tables: " + String.join(", ", unknown);
        }
        Set<String> missing = new TreeSet<>();
        for (Map.Entry<String, List<String>> entry : REQUIRED_COLUMNS.entrySet()) {
            String table = entry.getKey();
            if (!tables.contains(table)) {
                missing.add(table);
                continue;
            }
            Set<String> columns = columns(connection, schema, table);
            for (String column : entry.getValue()) {
                if (!columns.contains(column)) missing.add(table + "." + column);
            }
        }
        return missing.isEmpty() ? null : "missing: " + String.join(", ", missing);
    }

    private static Set<String> tables(Connection connection, String schema) throws SQLException {
        return names(connection,
                "SELECT table_name FROM information_schema.tables WHERE table_schema = ?", schema, null);
    }

    private static Set<String> columns(Connection connection, String schema, String table) throws SQLException {
        return names(connection,
                "SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?",
                schema, table);
    }

    private static Set<String> names(Connection connection, String sql, String schema, String table)
            throws SQLException {
        Set<String> names = new TreeSet<>();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, schema);
            if (table != null) statement.setString(2, table);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) names.add(rs.getString(1));
            }
        }
        return names;
    }

    private static void execute(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }
}
