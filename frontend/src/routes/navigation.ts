import {
    Bell, BookText, Box, BriefcaseBusiness, Building2, Cable, Clock3, CreditCard,
    Database, Download, Home, Palette, Shield, Upload, UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Permission } from "../api/types";
import { hasPermission } from "../auth/permissions";
import type { UserLike } from "../auth/permissions";

export type PageKey =
    | "home" | "dashboard" | "notifications" | "appearance" | "database" | "connections"
    | "timezones" | "docs" | "auth" | "users" | "departments" | "security" | "payments"
    | "import" | "export";

export type PageGroup = "General" | "Ventures";

export interface PageEntry {
    key: PageKey;
    label: string;
    path: string;
    icon: LucideIcon;
    group: PageGroup;
    /** `null` means any signed-in user. */
    permission: Permission | null;
    /**
     * Order in the phone bottom bar, lowest first. The first `MOBILE_TAB_COUNT` pages the user
     * may open become tabs; every other permitted page is listed in the More sheet. Pages
     * without it are only ever in the More sheet.
     */
    mobilePriority?: number;
}

/**
 * Every page in the dashboard. Used by the router (src/app/routes.tsx), the sidebar, the
 * bottom bar, the More sheet and the Quick Actions palette, so a page's permission is defined
 * in exactly one place. `permission: null` = any signed-in user.
 */
export const PAGES: readonly PageEntry[] = [
    { key: "home", label: "Home", path: "/", icon: Home, group: "General", permission: null, mobilePriority: 1 },
    { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: Box, group: "General", permission: "DASHBOARD_READ", mobilePriority: 2 },
    { key: "notifications", label: "Notifications", path: "/notifications", icon: Bell, group: "General", permission: "AUDIT_READ", mobilePriority: 5 },
    { key: "appearance", label: "Appearance", path: "/appearance", icon: Palette, group: "General", permission: null, mobilePriority: 8 },
    { key: "database", label: "Database", path: "/database", icon: Database, group: "General", permission: "DATABASE_READ" },
    { key: "connections", label: "Connections", path: "/connections", icon: Cable, group: "General", permission: "CONNECTIONS_READ" },
    { key: "timezones", label: "Timezones", path: "/timezones", icon: Clock3, group: "General", permission: "TIMEZONES_READ", mobilePriority: 7 },
    { key: "docs", label: "Documentation", path: "/docs", icon: BookText, group: "General", permission: "DOCUMENTATION_READ", mobilePriority: 6 },
    { key: "auth", label: "Account & security", path: "/auth", icon: BriefcaseBusiness, group: "Ventures", permission: null, mobilePriority: 9 },
    { key: "users", label: "User management", path: "/users", icon: UsersRound, group: "Ventures", permission: "USER_READ", mobilePriority: 3 },
    { key: "departments", label: "Departments", path: "/departments", icon: Building2, group: "Ventures", permission: "DEPARTMENT_READ", mobilePriority: 4 },
    { key: "security", label: "Security", path: "/security", icon: Shield, group: "Ventures", permission: "SECURITY_READ" },
    { key: "payments", label: "Payments", path: "/payments", icon: CreditCard, group: "Ventures", permission: "PAYMENTS_READ" },
    { key: "import", label: "Import data", path: "/import", icon: Upload, group: "Ventures", permission: "IMPORT_DATA" },
    { key: "export", label: "Export data", path: "/export", icon: Download, group: "Ventures", permission: "EXPORT_DATA" },
];

/** Short labels for the phone bottom bar, where the full label does not fit. */
export const SHORT_LABELS: Partial<Record<PageKey, string>> = {
    users: "Users",
    notifications: "Alerts",
    docs: "Docs",
    auth: "Account",
};

export const PAGE_GROUPS: readonly PageGroup[] = ["General", "Ventures"];

/** Number of page tabs in the phone bottom bar; a "More" button follows them. */
export const MOBILE_TAB_COUNT = 4;

type MaybeUser = UserLike | null | undefined;

export function pageByKey(key: string): PageEntry | undefined {
    return PAGES.find((p) => p.key === key);
}

/** The page whose path is exactly `pathname`, if any. */
export function pageByPath(pathname: string): PageEntry | undefined {
    return PAGES.find((p) => p.path === pathname);
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
