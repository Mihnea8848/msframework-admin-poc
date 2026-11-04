import type { Permission } from "../api/types";

/** The areas permissions are grouped under on the Roles page and the user profile, in order. */
export const PERMISSION_AREAS = [
    "Overview", "People", "Performance", "Finance", "Operations", "Security", "Settings", "Resources",
] as const;

export type PermissionArea = (typeof PERMISSION_AREAS)[number] | "Other";

interface PermissionMeta {
    area: PermissionArea;
    label: string;
}

/**
 * Every permission with its area and a plain-language label. A Record, so adding a permission to
 * the Permission type without a label here fails the type check.
 */
export const PERMISSION_META: Record<Permission, PermissionMeta> = {
    DASHBOARD_READ: { area: "Overview", label: "View the dashboard" },
    AUDIT_READ: { area: "Overview", label: "View activity and the audit log" },

    USER_READ: { area: "People", label: "View users" },
    USER_CREATE: { area: "People", label: "Add users" },
    USER_UPDATE: { area: "People", label: "Edit users" },
    USER_DELETE: { area: "People", label: "Delete users" },
    DEPARTMENT_READ: { area: "People", label: "View departments" },
    DEPARTMENT_CREATE: { area: "People", label: "Add departments" },
    DEPARTMENT_UPDATE: { area: "People", label: "Edit departments" },
    DEPARTMENT_DELETE: { area: "People", label: "Delete departments" },
    ROLES_READ: { area: "People", label: "View roles" },
    ACCESS_REQUESTS_MANAGE: { area: "People", label: "Review access requests" },

    GOALS_READ: { area: "Performance", label: "View goals and check-ins" },
    GOALS_MANAGE: { area: "Performance", label: "Manage goals" },
    REPORTS_READ: { area: "Performance", label: "View reports" },

    FINANCE_READ: { area: "Finance", label: "View budgets" },
    FINANCE_MANAGE: { area: "Finance", label: "Manage budgets and categories" },
    EXPENSE_SUBMIT: { area: "Finance", label: "Submit expenses" },
    EXPENSE_APPROVE: { area: "Finance", label: "Approve expenses" },
    PAYMENTS_READ: { area: "Finance", label: "View payments" },
    PAYMENTS_UPDATE: { area: "Finance", label: "Manage payments" },

    IMPORT_DATA: { area: "Operations", label: "Import data" },
    EXPORT_DATA: { area: "Operations", label: "Export data" },
    DATABASE_READ: { area: "Operations", label: "View the database" },
    DATABASE_UPDATE: { area: "Operations", label: "Change the database" },
    CONNECTIONS_READ: { area: "Operations", label: "View connections" },
    CONNECTIONS_UPDATE: { area: "Operations", label: "Manage connections and webhooks" },
    API_KEY_READ: { area: "Operations", label: "View API keys" },
    API_KEY_CREATE: { area: "Operations", label: "Create API keys" },
    API_KEY_DELETE: { area: "Operations", label: "Revoke API keys" },

    SECURITY_READ: { area: "Security", label: "View security" },
    SECURITY_UPDATE: { area: "Security", label: "Change security settings" },
    AUTH_SETTINGS_READ: { area: "Security", label: "View sign-in settings" },
    AUTH_SETTINGS_UPDATE: { area: "Security", label: "Change sign-in settings" },
    SESSIONS_MANAGE: { area: "Security", label: "Manage everyone's sessions" },

    ORG_SETTINGS_MANAGE: { area: "Settings", label: "Manage organisation settings" },
    DIRECTORY_SYNC: { area: "Settings", label: "Sync staff from Authentik" },
    WORKSPACE_READ: { area: "Settings", label: "View workspace settings" },
    WORKSPACE_UPDATE: { area: "Settings", label: "Change workspace settings" },
    APPEARANCE_READ: { area: "Settings", label: "View appearance defaults" },
    APPEARANCE_UPDATE: { area: "Settings", label: "Change appearance defaults" },

    TIMEZONES_READ: { area: "Resources", label: "View timezones" },
    TIMEZONES_UPDATE: { area: "Resources", label: "Manage timezones" },
    DOCUMENTATION_READ: { area: "Resources", label: "Read the documentation" },
};

/** The order permissions are listed in within an area: the order of PERMISSION_META. */
const ORDER = new Map(Object.keys(PERMISSION_META).map((key, i) => [key, i]));

export interface PermissionItem {
    key: string;
    label: string;
}

export interface PermissionGroup {
    area: PermissionArea;
    items: PermissionItem[];
}

function metaOf(key: string): PermissionMeta {
    return Object.hasOwn(PERMISSION_META, key)
        ? PERMISSION_META[key as Permission]
        : { area: "Other", label: key.toLowerCase().replace(/_/g, " ") };
}

/**
 * Groups permission names by area, in area order, skipping empty areas. Duplicates are dropped;
 * names the frontend does not know (a newer backend) are listed under "Other" as they are.
 */
export function groupPermissions(permissions: readonly string[]): PermissionGroup[] {
    const unique = [...new Set(permissions)];
    const byArea = new Map<PermissionArea, PermissionItem[]>();
    for (const key of unique) {
        const meta = metaOf(key);
        const list = byArea.get(meta.area) ?? [];
        list.push({ key, label: meta.label });
        byArea.set(meta.area, list);
    }
    const sortItems = (items: PermissionItem[]) =>
        items.sort((a, b) => (ORDER.get(a.key) ?? Infinity) - (ORDER.get(b.key) ?? Infinity) || a.key.localeCompare(b.key));
    return [...PERMISSION_AREAS, "Other" as const]
        .filter((area) => byArea.has(area))
        .map((area) => ({ area, items: sortItems(byArea.get(area) ?? []) }));
}

export interface MatrixRow extends PermissionItem {
    /** One entry per role, in the order the roles were given. */
    granted: boolean[];
}

export interface MatrixGroup {
    area: PermissionArea;
    rows: MatrixRow[];
}

/**
 * The permission matrix of the Roles page: every permission any role has (plus every known one,
 * so a permission no role holds still shows as a row of blanks), grouped by area, with a tick per
 * role.
 */
export function permissionMatrix(roles: readonly { permissions: readonly string[] }[]): MatrixGroup[] {
    const all = [...Object.keys(PERMISSION_META), ...roles.flatMap((r) => r.permissions)];
    const sets = roles.map((r) => new Set(r.permissions));
    return groupPermissions(all).map(({ area, items }) => ({
        area,
        rows: items.map((item) => ({ ...item, granted: sets.map((s) => s.has(item.key)) })),
    }));
}
