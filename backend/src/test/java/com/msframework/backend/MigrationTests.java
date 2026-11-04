package com.msframework.backend;

import com.msframework.backend.config.FlywayConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.EncodedResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Runs the Flyway migrations and the guarded baseline of {@link FlywayConfig} against separate
 * databases created in the test PostgreSQL: empty ones, foreign ones, and databases created by
 * older versions of the app (fixtures in {@code src/test/resources/db/legacy}).
 */
@IntegrationTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class MigrationTests {

    private static final Pattern JDBC_URL = Pattern.compile("^(jdbc:postgresql://[^/]+/)([^?]*)(.*)$");
    private static final Pattern QUOTED = Pattern.compile("'([^']*)'");

    /** Columns that the migration is expected to change; every other legacy value must survive. */
    private static final Set<String> CHANGED_COLUMNS = Set.of(
            "users.role", "users.status", "users.created_at", "users.password_changed_at");

    @Autowired
    private DataSource dataSource;

    private JdbcTemplate admin;
    private final List<String> databases = new ArrayList<>();
    private Map<String, List<String>> freshSchema;

    @BeforeAll
    void createReferenceDatabase() {
        admin = new JdbcTemplate(dataSource);
        DataSource fresh = createDatabase("fresh");
        FlywayConfig.migrate(flyway(fresh));
        freshSchema = schema(fresh);
    }

    @AfterAll
    void dropDatabases() {
        for (String name : databases) {
            admin.execute("DROP DATABASE IF EXISTS " + name + " WITH (FORCE)");
        }
    }

    // ------------------------------------------------------------------ fresh databases

    @Test
    void emptyDatabaseIsMigratedFromScratch() {
        DataSource db = createDatabase("empty");
        FlywayConfig.migrate(flyway(db));

        assertThat(history(db)).startsWith("1 SQL baseline", "2 SQL converge legacy schema")
                .contains("5 SQL business");
        assertThat(tables(db)).containsAll(Set.of("users", "role", "user_roles", "departments", "audit_events",
                "password_reset_tokens", "flyway_schema_history"));
        assertThat(new JdbcTemplate(db).queryForObject("SELECT COUNT(*) FROM role", Integer.class))
                .as("V2 inserts no data on a fresh database").isZero();
    }

    @Test
    void convergeMigrationChangesNothingOnAFreshDatabase() {
        DataSource db = createDatabase("v1only");
        Flyway flyway = flyway(db);
        Flyway.configure().configuration(flyway.getConfiguration()).target("1").load().migrate();
        Map<String, List<String>> afterV1 = schema(db);

        assertThat(Flyway.configure().configuration(flyway.getConfiguration()).target("2").load()
                .migrate().migrationsExecuted).isEqualTo(1);
        assertThat(schema(db)).isEqualTo(afterV1);
    }

    // ------------------------------------------------------------------ legacy databases

    static Stream<Arguments> legacyFixtures() {
        return Stream.of(
                Arguments.of("pre-rbac.sql", users(
                        "admin@test.com", "ADMIN", "Active",
                        "Maria.Manager@Example.com", "MANAGER", "Active",
                        "victor@example.com", "VIEWER", "Active",
                        "NullStatus@Example.com", "MEMBER", "Active",
                        "norole@example.com", "MEMBER", "Active",
                        "odd@example.com", "MEMBER", "Inactive")),
                Arguments.of("pre-rbac-then-main.sql", users(
                        "admin@test.com", "ADMIN", "Active",
                        "Maria.Manager@Example.com", "MANAGER", "Active",
                        "victor@example.com", "VIEWER", "Active",
                        "NullStatus@Example.com", "MEMBER", "Active",
                        "norole@example.com", "MEMBER", "Active",
                        "odd@example.com", "MEMBER", "Inactive")),
                Arguments.of("ddl-auto-main.sql", users(
                        "admin@test.com", "ADMIN", "Active",
                        "maria.manager@example.com", "MANAGER", "Active",
                        "victor@example.com", "VIEWER", "Active",
                        "ina@example.com", "MEMBER", "Inactive",
                        "reg@example.com", "MEMBER", "Active")));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("legacyFixtures")
    void legacyDatabaseIsBaselinedAndConverged(String fixture, Map<String, String> expectedUsers) throws Exception {
        DataSource db = createDatabase("legacy");
        try (Connection connection = db.getConnection()) {
            ScriptUtils.executeSqlScript(connection, new EncodedResource(
                    new ClassPathResource("db/legacy/" + fixture), StandardCharsets.UTF_8));
        }
        Map<String, List<String>> legacyColumns = columns(db, CHANGED_COLUMNS);
        Map<String, List<String>> legacyRows = rows(db, legacyColumns);

        Flyway flyway = flyway(db);
        FlywayConfig.migrate(flyway);

        // (a) same schema as a database migrated from empty
        assertThat(schema(db)).isEqualTo(freshSchema);
        assertThat(history(db)).startsWith("1 BASELINE << Flyway Baseline >>", "2 SQL converge legacy schema")
                .contains("5 SQL business");

        // (b) the data survived, and every user has exactly the expected role and a status
        assertThat(rows(db, legacyColumns)).isEqualTo(legacyRows);
        JdbcTemplate jdbc = new JdbcTemplate(db);
        Map<String, String> actualUsers = new TreeMap<>();
        jdbc.query("SELECT u.email, r.name, u.status FROM users u "
                        + "JOIN user_roles ur ON ur.user_id = u.id JOIN role r ON r.id = ur.role_id",
                rs -> { actualUsers.put(rs.getString(1), rs.getString(2) + " " + rs.getString(3)); });
        assertThat(actualUsers).isEqualTo(new TreeMap<>(expectedUsers));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_roles", Integer.class))
                .isEqualTo(expectedUsers.size());
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE created_at IS NULL OR password_changed_at IS NULL", Integer.class))
                .isZero();

        // (c) running the migrations again changes nothing
        List<String> migrated = history(db);
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        FlywayConfig.migrate(flyway);
        assertThat(history(db)).isEqualTo(migrated);
        assertThat(schema(db)).isEqualTo(freshSchema);
    }

    // ------------------------------------------------------------------ foreign databases

    @ParameterizedTest
    @ValueSource(strings = {
            "CREATE TABLE customers (id bigint PRIMARY KEY, name text)",
            "CREATE TABLE users (id bigint PRIMARY KEY, email text)",
            "CREATE TABLE users (id bigint PRIMARY KEY, email text); CREATE TABLE departments (id bigint, name text);"
                    + " CREATE TABLE invoices (id bigint)"
    })
    void nonEmptyForeignDatabaseIsRefused(String ddl) {
        DataSource db = createDatabase("foreign");
        new JdbcTemplate(db).execute(ddl);

        assertThatThrownBy(() -> FlywayConfig.migrate(flyway(db)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("does not look like an MSFramework schema");
        assertThat(tables(db)).doesNotContain("flyway_schema_history");
    }

    // ------------------------------------------------------------------ helpers

    private static Map<String, String> users(String... values) {
        Map<String, String> users = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 3) {
            users.put(values[i], values[i + 1] + " " + values[i + 2]);
        }
        return users;
    }

    /** Creates an empty database next to the test database and returns a data source for it. */
    private DataSource createDatabase(String purpose) {
        String name = "msf_mig_" + purpose + "_" + UUID.randomUUID().toString().substring(0, 8);
        admin.execute("CREATE DATABASE " + name);
        databases.add(name);

        HikariDataSource main = (HikariDataSource) dataSource;
        Matcher url = JDBC_URL.matcher(main.getJdbcUrl());
        assertThat(url.matches()).as("JDBC URL %s", main.getJdbcUrl()).isTrue();
        return new DriverManagerDataSource(url.group(1) + name + url.group(3), main.getUsername(), main.getPassword());
    }

    /** The same settings as the application (application.properties). */
    private static Flyway flyway(DataSource db) {
        return Flyway.configure()
                .dataSource(db)
                .locations("classpath:db/migration")
                .baselineVersion("1")
                .validateOnMigrate(true)
                .cleanDisabled(true)
                .load();
    }

    private static List<String> history(DataSource db) {
        return new JdbcTemplate(db).queryForList("SELECT version || ' ' || type || ' ' || description "
                + "FROM flyway_schema_history WHERE success ORDER BY installed_rank", String.class);
    }

    private static List<String> tables(DataSource db) {
        return new JdbcTemplate(db).queryForList(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()",
                String.class);
    }

    /**
     * Columns (name, type, nullability, identity, default), constraints and indexes of the
     * application tables, as sorted text so that a failing comparison shows the difference.
     * Constraints come from pg_constraint: information_schema.table_constraints also lists NOT
     * NULL checks under OID-based names that differ between databases.
     */
    private static Map<String, List<String>> schema(DataSource db) {
        JdbcTemplate jdbc = new JdbcTemplate(db);
        Map<String, List<String>> schema = new TreeMap<>();
        schema.put("columns", jdbc.queryForList("""
                SELECT table_name || '.' || column_name || ' ' || data_type
                       || coalesce('(' || character_maximum_length || ')', '')
                       || coalesce(' p' || datetime_precision, '')
                       || CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END
                       || CASE WHEN is_identity = 'YES' THEN ' IDENTITY ' || identity_generation ELSE '' END
                       || coalesce(' DEFAULT ' || column_default, '')
                FROM information_schema.columns
                WHERE table_schema = current_schema() AND table_name <> 'flyway_schema_history'
                ORDER BY 1""", String.class));
        schema.put("constraints", jdbc.query("""
                SELECT c.conrelid::regclass::text AS tbl, c.conname, c.contype, pg_get_constraintdef(c.oid) AS def
                FROM pg_constraint c
                WHERE c.connamespace = current_schema()::regnamespace
                  AND c.conrelid::regclass::text <> 'flyway_schema_history'""",
                (rs, i) -> rs.getString("tbl") + " " + rs.getString("conname") + " " + rs.getString("contype") + " "
                        + normalizeCheck(rs.getString("contype"), rs.getString("def"))).stream().sorted().toList());
        schema.put("indexes", jdbc.queryForList("""
                SELECT indexdef FROM pg_indexes
                WHERE schemaname = current_schema() AND tablename <> 'flyway_schema_history'
                ORDER BY 1""", String.class));
        schema.put("sequences", jdbc.queryForList("""
                SELECT sequence_name FROM information_schema.sequences
                WHERE sequence_schema = current_schema() AND sequence_name <> 'flyway_schema_history'
                ORDER BY 1""", String.class));
        return schema;
    }

    /**
     * PostgreSQL prints the same CHECK (x IN (...)) differently once it went through a
     * dump and restore, so CHECK constraints are compared by their list of allowed values.
     */
    private static String normalizeCheck(String type, String definition) {
        if (!"c".equals(type)) return definition;
        List<String> values = new ArrayList<>();
        Matcher matcher = QUOTED.matcher(definition);
        while (matcher.find()) values.add(matcher.group(1));
        return "CHECK IN " + values.stream().sorted().toList();
    }

    /** Column names per table, minus the excluded ones ("table.column"). */
    private static Map<String, List<String>> columns(DataSource db, Set<String> excluded) {
        Map<String, List<String>> columns = new TreeMap<>();
        new JdbcTemplate(db).query("""
                SELECT table_name, column_name FROM information_schema.columns
                WHERE table_schema = current_schema() AND table_name <> 'flyway_schema_history'
                ORDER BY table_name, column_name""", rs -> {
            String table = rs.getString(1);
            String column = rs.getString(2);
            if (!excluded.contains(table + "." + column)) {
                columns.computeIfAbsent(table, t -> new ArrayList<>()).add(column);
            }
        });
        return columns;
    }

    /** Every row of the given tables as text, over the given columns. */
    private static Map<String, List<String>> rows(DataSource db, Map<String, List<String>> columns) {
        JdbcTemplate jdbc = new JdbcTemplate(db);
        Map<String, List<String>> rows = new TreeMap<>();
        columns.forEach((table, cols) -> {
            String select = cols.stream().map(c -> "coalesce(\"" + c + "\"::text, 'NULL')")
                    .reduce((a, b) -> a + " || '|' || " + b).orElseThrow();
            rows.put(table, jdbc.queryForList("SELECT " + select + " FROM \"" + table + "\" ORDER BY 1", String.class));
        });
        return rows;
    }
}
