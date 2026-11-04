package com.msframework.backend.config;

public enum Permission {
    DASHBOARD_READ,

    USER_READ,
    USER_CREATE,
    USER_UPDATE,
    USER_DELETE,

    DEPARTMENT_READ,
    DEPARTMENT_CREATE,
    DEPARTMENT_UPDATE,
    DEPARTMENT_DELETE,

    AUDIT_READ,

    APPEARANCE_READ,
    APPEARANCE_UPDATE,

    DATABASE_READ,
    DATABASE_UPDATE,

    DOCUMENTATION_READ,

    AUTH_SETTINGS_READ,
    AUTH_SETTINGS_UPDATE,

    SECURITY_READ,
    SECURITY_UPDATE,

    PAYMENTS_READ,
    PAYMENTS_UPDATE,

    IMPORT_DATA,
    EXPORT_DATA,

    CONNECTIONS_READ,
    CONNECTIONS_UPDATE,

    TIMEZONES_READ,
    TIMEZONES_UPDATE,

    WORKSPACE_READ,
    WORKSPACE_UPDATE,

    API_KEY_READ,
    API_KEY_CREATE,
    API_KEY_DELETE,

    // People: access requests (self-registration review) and the roles overview
    ACCESS_REQUESTS_MANAGE,
    ROLES_READ,

    // Business: budgets, expenses with approvals, goals and KPIs, reports (BUSINESS-API).
    // Department scoping (managers and members act on their own department) is enforced in
    // BusinessAccess, not by the permission itself.
    FINANCE_READ,
    FINANCE_MANAGE,
    EXPENSE_SUBMIT,
    EXPENSE_APPROVE,
    GOALS_READ,
    GOALS_MANAGE,
    REPORTS_READ,

    // Sessions and organisation settings (sessions-security)
    SESSIONS_MANAGE,
    ORG_SETTINGS_MANAGE
}
