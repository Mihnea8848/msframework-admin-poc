package com.msframework.backend;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
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
}
