package com.msframework.backend.config;

import java.util.Collections;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import static com.msframework.backend.config.Permission.*;

/**
 * The built-in roles and their permissions. This is the single source of truth: on every start-up
 * {@link DatabaseSeeder} makes the database match it, so adding a permission here (or to
 * {@link Permission}) reaches existing databases too.
 */
public final class SystemRoles {

    public static final String ADMIN = "ADMIN";
    public static final String MANAGER = "MANAGER";
    public static final String MEMBER = "MEMBER";
    public static final String VIEWER = "VIEWER";

    /** Role name → permissions. */
    public static final Map<String, Set<Permission>> DEFINITIONS;

    static {
        Map<String, Set<Permission>> defs = new LinkedHashMap<>();

        defs.put(ADMIN, EnumSet.allOf(Permission.class));

        // Managers run their own department: they can edit it and its members (scoping is
        // enforced in UserService / DepartmentController). Creating or deleting departments
        // and users is reserved for admins.
        defs.put(MANAGER, EnumSet.of(
                DASHBOARD_READ,
                USER_READ, USER_UPDATE,
                DEPARTMENT_READ, DEPARTMENT_UPDATE,
                AUDIT_READ,
                DOCUMENTATION_READ,
                TIMEZONES_READ,
                // Business: approvals and goals are limited to their own department (BusinessAccess).
                FINANCE_READ, EXPENSE_SUBMIT, EXPENSE_APPROVE, GOALS_READ, GOALS_MANAGE, REPORTS_READ
        ));

        defs.put(MEMBER, EnumSet.of(
                DASHBOARD_READ,
                USER_READ,
                DEPARTMENT_READ,
                DOCUMENTATION_READ,
                TIMEZONES_READ,
                // Business: own expenses, and check-ins for their own department's goals.
                EXPENSE_SUBMIT, GOALS_READ
        ));

        defs.put(VIEWER, EnumSet.of(
                DASHBOARD_READ,
                DOCUMENTATION_READ,
                // Business
                REPORTS_READ, GOALS_READ
        ));

        DEFINITIONS = Collections.unmodifiableMap(defs);
    }

    private SystemRoles() {
    }

    public static boolean isPrivileged(String roleName) {
        return ADMIN.equals(roleName) || MANAGER.equals(roleName);
    }
}
