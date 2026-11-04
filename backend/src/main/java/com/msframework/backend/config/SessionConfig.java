package com.msframework.backend.config;

import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;
import org.springframework.session.web.http.SessionRepositoryFilter;

/**
 * Sessions live in PostgreSQL through Spring Session JDBC (auto-configured by Spring Boot; the
 * tables come from the Flyway migration V4). This adds the idle-time handling for background
 * requests ({@link BackgroundRequests}) and the throttle settings.
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
@EnableConfigurationProperties(ThrottleProperties.class)
public class SessionConfig {

    /**
     * Wraps Boot's JDBC session repository, so Spring Session's filter and the sessions API use the
     * background-aware one. A post-processor rather than a second repository bean, because Boot's
     * session auto-configuration backs off when it finds another repository bean.
     */
    @Bean
    static BeanPostProcessor backgroundAwareSessionRepository() {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String beanName) {
                return bean instanceof JdbcIndexedSessionRepository jdbc ? new BackgroundRequests.Repository(jdbc) : bean;
            }
        };
    }

    /** Runs just before Spring Session's filter, so the flag is set for the whole request. */
    @Bean
    public FilterRegistrationBean<BackgroundRequests.Filter> backgroundRequestFilter() {
        FilterRegistrationBean<BackgroundRequests.Filter> registration =
                new FilterRegistrationBean<>(new BackgroundRequests.Filter());
        registration.setOrder(SessionRepositoryFilter.DEFAULT_ORDER - 1);
        return registration;
    }
}
