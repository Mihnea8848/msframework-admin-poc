import {
    Activity, BookText, Box, Building2, Cable, ChartColumn, Clock3, CreditCard, Database, Download, Home,
    Inbox, KeyRound, ListChecks, MonitorSmartphone, Palette, PiggyBank, Receipt, ScrollText, Shield, Target,
    Upload, UserRound, UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { matchPath } from "react-router-dom";
import type { Permission } from "../api/types";
import { hasPermission } from "../auth/permissions";
import type { UserLike } from "../auth/permissions";

export type PageKey =
    | "home" | "dashboard" | "activity"
    | "users" | "departments" | "roles" | "accessRequests"
    | "goals" | "reports"
    | "budgets" | "expenses" | "payments"
    | "import" | "export" | "database" | "connections"
    | "security" | "audit" | "sessions"
    | "timezones" | "docs";

/** The sidebar groups, in order. A group without pages the user may open is skipped. */
export type PageGroup = "Overview" | "People" | "Performance" | "Finance" | "Operations" | "Security" | "Resources";

export interface PageEntry {
    key: PageKey;
    label: string;
    path: string;
    icon: LucideIcon;
    group: PageGroup;
    /** `null` means any signed-in user; a list means any one of those permissions. */
    permission: Permission | readonly Permission[] | null;
    /**
     * Order in the phone bottom bar, lowest first. The first `MOBILE_TAB_COUNT` pages the user
     * may open become tabs; every other permitted page is listed in the More sheet. Pages
     * without it are only ever in the More sheet.
     */
    mobilePriority?: number;
}

/**
 * Every page in the sidebar. Used by the router (src/app/routes.tsx), the sidebar, the bottom
 * bar, the More sheet and the Quick Actions palette, so a page's permission is defined in
 * exactly one place. `permission: null` = any signed-in user. Settings is not here: it is one
 * page with tabs (SETTINGS_TABS), opened from the top bar.
 */
export const PAGES: readonly PageEntry[] = [
    { key: "home", label: "Home", path: "/", icon: Home, group: "Overview", permission: null, mobilePriority: 1 },
    { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: Box, group: "Overview", permission: "DASHBOARD_READ", mobilePriority: 2 },
    // Activity is your own feed (GET /api/audit/me), so everyone signed in has it.
    { key: "activity", label: "Activity", path: "/activity", icon: Activity, group: "Overview", permission: null, mobilePriority: 5 },
    { key: "users", label: "Users", path: "/users", icon: UsersRound, group: "People", permission: "USER_READ", mobilePriority: 3 },
    { key: "departments", label: "Departments", path: "/departments", icon: Building2, group: "People", permission: "DEPARTMENT_READ", mobilePriority: 4 },
    { key: "roles", label: "Roles", path: "/roles", icon: ListChecks, group: "People", permission: "ROLES_READ" },
    { key: "accessRequests", label: "Access requests", path: "/access-requests", icon: Inbox, group: "People", permission: "ACCESS_REQUESTS_MANAGE" },
    // Business: goals, reports, budgets, expenses and payments
    { key: "goals", label: "Goals", path: "/goals", icon: Target, group: "Performance", permission: "GOALS_READ" },
    { key: "reports", label: "Reports", path: "/reports", icon: ChartColumn, group: "Performance", permission: "REPORTS_READ" },
    { key: "budgets", label: "Budgets", path: "/budgets", icon: PiggyBank, group: "Finance", permission: "FINANCE_READ" },
    { key: "expenses", label: "Expenses", path: "/expenses", icon: Receipt, group: "Finance", permission: ["EXPENSE_SUBMIT", "FINANCE_READ", "EXPENSE_APPROVE"] },
    { key: "payments", label: "Payments", path: "/payments", icon: CreditCard, group: "Finance", permission: "FINANCE_READ" },
    // Check-ins can be imported with GOALS_MANAGE alone, so managers may open Import for them.
    { key: "import", label: "Import data", path: "/import", icon: Upload, group: "Operations", permission: ["IMPORT_DATA", "GOALS_MANAGE"] },
    { key: "export", label: "Export data", path: "/export", icon: Download, group: "Operations", permission: "EXPORT_DATA" },
    { key: "database", label: "Database", path: "/database", icon: Database, group: "Operations", permission: "DATABASE_READ" },
    { key: "connections", label: "Connections", path: "/connections", icon: Cable, group: "Operations", permission: "CONNECTIONS_READ" },
    { key: "security", label: "Security", path: "/security", icon: Shield, group: "Security", permission: "SECURITY_READ" },
    { key: "audit", label: "Audit log", path: "/audit", icon: ScrollText, group: "Security", permission: "AUDIT_READ" },
    // Everyone manages their own sessions, so every signed-in user sees the Security group with at
    // least this page; SESSIONS_MANAGE adds the "Sessions by user" panel on it.
    { key: "sessions", label: "Sessions", path: "/sessions", icon: MonitorSmartphone, group: "Security", permission: null },
    { key: "timezones", label: "Timezones", path: "/timezones", icon: Clock3, group: "Resources", permission: "TIMEZONES_READ", mobilePriority: 7 },
    { key: "docs", label: "Documentation", path: "/docs", icon: BookText, group: "Resources", permission: "DOCUMENTATION_READ", mobilePriority: 6 },
];

/** The child pages: opened from a page (a user from Users), not listed in the sidebar. */
export type ChildPageKey = "userProfile" | "departmentDetail";

export interface ChildPageEntry {
    key: ChildPageKey;
    label: string;
    /** A route pattern, e.g. "/users/:id". */
    path: string;
    /** The sidebar page it belongs to: highlighted while the child is open, and its group is the breadcrumb's. */
    parent: PageKey;
    /** Every permission the page needs (its API calls need them all). */
    permissions: readonly Permission[];
}

export const CHILD_PAGES: readonly ChildPageEntry[] = [
    { key: "userProfile", label: "User profile", path: "/users/:id", parent: "users", permissions: ["USER_READ"] },
    { key: "departmentDetail", label: "Department", path: "/departments/:id", parent: "departments", permissions: ["DEPARTMENT_READ", "USER_READ"] },
];

/** The child page whose pattern matches `pathname`, if any. */
export function childPageByPath(pathname: string): ChildPageEntry | undefined {
    return CHILD_PAGES.find((c) => matchPath(c.path, pathname) !== null);
}

/** Whether a sidebar page is the current one: its own path, or one of its child pages. */
export function isCurrentPage(page: Pick<PageEntry, "key" | "path">, pathname: string): boolean {
    return pathname === page.path || childPageByPath(pathname)?.parent === page.key;
}

/** Short labels for the phone bottom bar, where the full label does not fit. */
export const SHORT_LABELS: Partial<Record<PageKey, string>> = {
    docs: "Docs",
};

export const PAGE_GROUPS: readonly PageGroup[] = ["Overview", "People", "Performance", "Finance", "Operations", "Security", "Resources"];

/** Old paths that still work: each redirects to where its page lives now. */
export const LEGACY_PATHS: Readonly<Record<string, string>> = {
    "/notifications": "/activity",
    "/auth": "/settings/account",
    "/appearance": "/settings/appearance",
};

/** Number of page tabs in the phone bottom bar; a "More" button follows them. */
export const MOBILE_TAB_COUNT = 4;

// ---- Settings ---------------------------------------------------------------------------

export type SettingsTabKey = "account" | "security" | "appearance" | "organisation";

export interface SettingsTab {
    key: SettingsTabKey;
    label: string;
    path: string;
    icon: LucideIcon;
    /** One line for Quick Actions. */
    hint: string;
}

/** The Settings page, opened from the top bar cog or the user chip. Every signed-in user may open it. */
export const SETTINGS_PATH = "/settings";

export const SETTINGS_TABS: readonly SettingsTab[] = [
    { key: "account", label: "Account", path: "/settings/account", icon: UserRound, hint: "Your profile and email address" },
    { key: "security", label: "Security", path: "/settings/security", icon: KeyRound, hint: "Password, sessions, two-factor and connected accounts" },
    { key: "appearance", label: "Appearance", path: "/settings/appearance", icon: Palette, hint: "Theme, accent, density and motion" },
    { key: "organisation", label: "Organisation", path: "/settings/organisation", icon: Building2, hint: "Company name, registration, password policy and timezone" },
];

export function settingsTabByKey(key: string | undefined): SettingsTab | undefined {
    return SETTINGS_TABS.find((t) => t.key === key);
}

// ---- Lookups ----------------------------------------------------------------------------

type MaybeUser = UserLike | null | undefined;

export function pageByKey(key: string): PageEntry | undefined {
    return PAGES.find((p) => p.key === key);
}

/** The page whose path is exactly `pathname`, if any. */
export function pageByPath(pathname: string): PageEntry | undefined {
    return PAGES.find((p) => p.path === pathname);
}

/** The top bar breadcrumb ("Group / Page") for a path, including the Settings tabs. */
export function crumbFor(pathname: string): { group: string; label: string } | null {
    const page = pageByPath(pathname);
    if (page) return { group: page.group, label: page.label };
    const child = childPageByPath(pathname);
    if (child) {
        const parent = pageByKey(child.parent);
        if (parent) return { group: parent.group, label: parent.label };
    }
    if (pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`)) {
        const tab = settingsTabByKey(pathname.slice(SETTINGS_PATH.length + 1));
        return { group: "Settings", label: tab?.label ?? "Settings" };
    }
    return null;
}

/** The pages this user may open, in sidebar order. */
export function visiblePages(user: MaybeUser): PageEntry[] {
    return PAGES.filter((p) => hasPermission(user, p.permission));
}

/** The bottom bar tabs: permitted pages with a `mobilePriority`, lowest first, at most `count`. */
export function mobileTabs(user: MaybeUser, count = MOBILE_TAB_COUNT): PageEntry[] {
    return visiblePages(user)
        .filter((p) => p.mobilePriority !== undefined)
        .sort((a, b) => (a.mobilePriority ?? 0) - (b.mobilePriority ?? 0))
        .slice(0, count);
}

/** Every permitted page that is not a bottom bar tab, in sidebar order (the More sheet). */
export function morePages(user: MaybeUser, count = MOBILE_TAB_COUNT): PageEntry[] {
    const tabs = new Set(mobileTabs(user, count).map((p) => p.key));
    return visiblePages(user).filter((p) => !tabs.has(p.key));
}

/** Pages grouped by sidebar group, in group order, skipping empty groups. */
export function groupPages(pages: readonly PageEntry[]): { group: PageGroup; pages: PageEntry[] }[] {
    return PAGE_GROUPS
        .map((group) => ({ group, pages: pages.filter((p) => p.group === group) }))
        .filter((g) => g.pages.length > 0);
}
