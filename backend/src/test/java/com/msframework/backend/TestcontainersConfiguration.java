package com.msframework.backend;

import com.msframework.backend.config.FlywayConfig;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Integration tests run against a real PostgreSQL 16 started by Testcontainers (needs Docker).
 * Set {@code TEST_DB_URL} (plus {@code TEST_DB_USERNAME} / {@code TEST_DB_PASSWORD}) to use an
 * existing PostgreSQL 16 instead; the container is then not started.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    @ConditionalOnProperty(name = "TEST_DB_URL", havingValue = "__use_testcontainers__", matchIfMissing = true)
    PostgreSQLContainer postgres() {
        return new PostgreSQLContainer("postgres:16");
    }

    /**
     * Test-only: wipes the schema before migrating, so a database given in {@code TEST_DB_URL}
     * starts clean like a fresh container. Needs {@code spring.flyway.clean-disabled=false},
     * which only the test profile sets.
     */
    @Bean
    @Primary
    FlywayMigrationStrategy cleanThenMigrate() {
        return flyway -> {
            flyway.clean();
            FlywayConfig.migrate(flyway);
        };
    }
}
