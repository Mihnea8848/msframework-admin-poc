package com.msframework.backend.config;

import java.util.List;
import java.util.Set;

/** The service integrations the Connections page knows about (ids match the frontend). */
public final class Integrations {

    /** All known service ids, in display order. */
    public static final List<String> SERVICE_IDS = List.of(
            "slack", "github", "google", "stripe", "jira", "aws",
            "zapier", "sendgrid", "datadog", "pagerduty", "twilio", "notion"
    );

    /** Services that start out connected in a fresh database (demo data). */
    public static final Set<String> CONNECTED_BY_DEFAULT = Set.of("slack", "github", "google", "stripe");

    private Integrations() {
    }

    public static boolean isKnown(String serviceId) {
        return SERVICE_IDS.contains(serviceId);
    }
}
