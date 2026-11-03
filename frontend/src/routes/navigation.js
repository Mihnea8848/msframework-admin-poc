import {
    Bell, BookText, Box, BriefcaseBusiness, Building2, Cable, Clock3, CreditCard,
    Database, Download, Home, Palette, Shield, Upload, UsersRound,
} from "lucide-react";

/**
 * Every page in the dashboard. Used by the sidebar, the Quick Actions palette and the router,
 * so a page's permission is defined in exactly one place. `permission: null` = any signed-in user.
 */
export const PAGES = [
    { key: "home", label: "Home", path: "/", icon: Home, group: "General", permission: null },
    { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: Box, group: "General", permission: "DASHBOARD_READ" },
    { key: "notifications", label: "Notifications", path: "/notifications", icon: Bell, group: "General", permission: "AUDIT_READ" },
    { key: "appearance", label: "Appearance", path: "/appearance", icon: Palette, group: "General", permission: null },
    { key: "database", label: "Database", path: "/database", icon: Database, group: "General", permission: "DATABASE_READ" },
    { key: "connections", label: "Connections", path: "/connections", icon: Cable, group: "General", permission: "CONNECTIONS_READ" },
    { key: "timezones", label: "Timezones", path: "/timezones", icon: Clock3, group: "General", permission: "TIMEZONES_READ" },
    { key: "docs", label: "Documentation", path: "/docs", icon: BookText, group: "General", permission: "DOCUMENTATION_READ" },
    { key: "auth", label: "Account & security", path: "/auth", icon: BriefcaseBusiness, group: "Ventures", permission: null },
    { key: "users", label: "User management", path: "/users", icon: UsersRound, group: "Ventures", permission: "USER_READ" },
    { key: "departments", label: "Departments", path: "/departments", icon: Building2, group: "Ventures", permission: "DEPARTMENT_READ" },
    { key: "security", label: "Security", path: "/security", icon: Shield, group: "Ventures", permission: "SECURITY_READ" },
    { key: "payments", label: "Payments", path: "/payments", icon: CreditCard, group: "Ventures", permission: "PAYMENTS_READ" },
    { key: "import", label: "Import data", path: "/import", icon: Upload, group: "Ventures", permission: "IMPORT_DATA" },
    { key: "export", label: "Export data", path: "/export", icon: Download, group: "Ventures", permission: "EXPORT_DATA" },
];

export function pageByKey(key) {
    return PAGES.find((p) => p.key === key);
}
