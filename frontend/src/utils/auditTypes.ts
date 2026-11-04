import {
    Banknote, Building2, Cable, ChartColumn, CircleCheck, CircleX, Clock3, Crown, Download, FilePen, Hourglass, Key,
    Link2, ListPlus, Lock, LogIn, LogOut, PiggyBank, Receipt, RefreshCw, Send, Settings, Shield, ShieldAlert, Tags,
    Target, Trash2, UserCheck, UserCog, UserMinus, UserPlus, Users, UserX, Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Filter categories on the Notifications page ("All" is added by AUDIT_FILTERS). */
export type AuditCategory =
    | "Login" | "Users" | "Departments" | "Auth" | "Integrations" | "Data" | "Settings"
    | "Finance" | "Performance" | "Other";

/** CSS modifier for the event pill (`.event-pill.<pill>`). */
export type AuditPill = "login" | "security" | "created" | "changed" | "export";

/** Severity used by the security alerts list. */
export type AuditAlert = "fail" | "warn" | "info";

export interface AuditTypeMeta {
    label: string;
    pill: AuditPill;
    Icon: LucideIcon;
    color: string;
    category: AuditCategory;
    alert?: AuditAlert;
}

/** Display metadata for every audit event type the backend emits. */
export const AUDIT_TYPES = {
    user_login: { label: "Login", pill: "login", Icon: LogIn, color: "var(--status-info-fg)", category: "Login" },
    user_logout: { label: "Logout", pill: "login", Icon: LogOut, color: "var(--status-info-fg)", category: "Login" },
    login_failed: { label: "Failed login", pill: "security", Icon: ShieldAlert, color: "var(--status-danger-fg)", category: "Login", alert: "fail" },
    login_blocked: { label: "Blocked login", pill: "security", Icon: ShieldAlert, color: "var(--status-danger-fg)", category: "Login", alert: "warn" },
    user_created: { label: "User Created", pill: "created", Icon: UserPlus, color: "var(--status-ok-fg)", category: "Users" },
    user_updated: { label: "User Updated", pill: "changed", Icon: UserCog, color: "var(--status-warn-fg)", category: "Users" },
    user_deleted: { label: "User Deleted", pill: "security", Icon: UserMinus, color: "var(--status-danger-fg)", category: "Users", alert: "warn" },
    dept_created: { label: "Dept Created", pill: "created", Icon: Building2, color: "var(--status-ok-fg)", category: "Departments" },
    dept_updated: { label: "Dept Updated", pill: "changed", Icon: Building2, color: "var(--status-warn-fg)", category: "Departments" },
    dept_deleted: { label: "Dept Deleted", pill: "security", Icon: Building2, color: "var(--status-danger-fg)", category: "Departments" },
    email_changed: { label: "Email Changed", pill: "security", Icon: UserCheck, color: "var(--status-warn-fg)", category: "Auth", alert: "info" },
    password_changed: { label: "Password", pill: "security", Icon: Key, color: "var(--status-warn-fg)", category: "Auth", alert: "info" },
    password_reset_requested: { label: "Reset requested", pill: "security", Icon: Key, color: "var(--status-danger-fg)", category: "Auth", alert: "info" },
    password_reset_completed: { label: "Reset completed", pill: "security", Icon: Key, color: "var(--status-warn-fg)", category: "Auth", alert: "info" },
    key_generated: { label: "API Key", pill: "security", Icon: Key, color: "var(--text-secondary)", category: "Integrations", alert: "warn" },
    key_revoked: { label: "Key Revoked", pill: "security", Icon: Key, color: "var(--status-danger-fg)", category: "Integrations" },
    connection_changed: { label: "Integration", pill: "changed", Icon: Cable, color: "var(--status-warn-fg)", category: "Integrations" },
    webhook_added: { label: "Webhook Added", pill: "created", Icon: Webhook, color: "var(--status-ok-fg)", category: "Integrations" },
    webhook_removed: { label: "Webhook Removed", pill: "security", Icon: Webhook, color: "var(--status-danger-fg)", category: "Integrations" },
    webhook_toggled: { label: "Webhook", pill: "changed", Icon: Webhook, color: "var(--status-warn-fg)", category: "Integrations" },
    setting_changed: { label: "Setting", pill: "changed", Icon: Clock3, color: "var(--status-warn-fg)", category: "Settings" },
    export_generated: { label: "Export", pill: "export", Icon: Download, color: "var(--text-secondary)", category: "Data" },
    import_completed: { label: "Import", pill: "export", Icon: RefreshCw, color: "var(--text-secondary)", category: "Data" },
    rate_limited: { label: "Rate limited", pill: "security", Icon: ShieldAlert, color: "var(--status-danger-fg)", category: "Login", alert: "warn" },
    account_locked: { label: "Account locked", pill: "security", Icon: Lock, color: "var(--status-danger-fg)", category: "Login", alert: "fail" },
    session_revoked: { label: "Session ended", pill: "security", Icon: LogOut, color: "var(--status-warn-fg)", category: "Auth", alert: "info" },
    sessions_revoked: { label: "Signed out everywhere", pill: "security", Icon: LogOut, color: "var(--status-warn-fg)", category: "Auth", alert: "info" },
    org_settings_changed: { label: "Organisation", pill: "changed", Icon: Settings, color: "var(--status-warn-fg)", category: "Settings" },
    directory_synced: { label: "Directory sync", pill: "changed", Icon: Users, color: "var(--status-info-fg)", category: "Users" },
    // People: access requests, department managers and reset links (PEOPLE-UI).
    // export_generated and password_reset_completed are listed above.
    access_requested: { label: "Access requested", pill: "created", Icon: UserPlus, color: "var(--status-info-fg)", category: "Users" },
    access_approved: { label: "Access approved", pill: "created", Icon: UserCheck, color: "var(--status-ok-fg)", category: "Users" },
    access_rejected: { label: "Access rejected", pill: "security", Icon: UserX, color: "var(--status-danger-fg)", category: "Users" },
    login_pending: { label: "Awaiting approval", pill: "login", Icon: Hourglass, color: "var(--status-warn-fg)", category: "Login", alert: "info" },
    dept_manager_changed: { label: "Dept Manager", pill: "changed", Icon: Crown, color: "var(--status-warn-fg)", category: "Departments" },
    password_reset_link_created: { label: "Reset link", pill: "security", Icon: Link2, color: "var(--status-warn-fg)", category: "Auth", alert: "info" },
    // Business: budgets, categories, expenses, goals, check-ins and reports
    budget_created: { label: "Budget set", pill: "created", Icon: PiggyBank, color: "var(--status-ok-fg)", category: "Finance" },
    budget_updated: { label: "Budget changed", pill: "changed", Icon: PiggyBank, color: "var(--status-warn-fg)", category: "Finance" },
    budget_deleted: { label: "Budget removed", pill: "security", Icon: PiggyBank, color: "var(--status-danger-fg)", category: "Finance" },
    category_created: { label: "Category added", pill: "created", Icon: Tags, color: "var(--status-ok-fg)", category: "Finance" },
    category_updated: { label: "Category changed", pill: "changed", Icon: Tags, color: "var(--status-warn-fg)", category: "Finance" },
    category_deleted: { label: "Category deleted", pill: "security", Icon: Tags, color: "var(--status-danger-fg)", category: "Finance" },
    expense_created: { label: "Expense added", pill: "created", Icon: Receipt, color: "var(--status-ok-fg)", category: "Finance" },
    expense_updated: { label: "Expense edited", pill: "changed", Icon: FilePen, color: "var(--status-warn-fg)", category: "Finance" },
    expense_submitted: { label: "Expense submitted", pill: "changed", Icon: Send, color: "var(--status-info-fg)", category: "Finance" },
    expense_approved: { label: "Expense approved", pill: "created", Icon: CircleCheck, color: "var(--status-ok-fg)", category: "Finance" },
    expense_rejected: { label: "Expense rejected", pill: "security", Icon: CircleX, color: "var(--status-danger-fg)", category: "Finance" },
    expense_paid: { label: "Expense paid", pill: "created", Icon: Banknote, color: "var(--status-ok-fg)", category: "Finance" },
    expense_deleted: { label: "Draft deleted", pill: "security", Icon: Trash2, color: "var(--status-danger-fg)", category: "Finance" },
    goal_created: { label: "Goal created", pill: "created", Icon: Target, color: "var(--status-ok-fg)", category: "Performance" },
    goal_updated: { label: "Goal changed", pill: "changed", Icon: Target, color: "var(--status-warn-fg)", category: "Performance" },
    goal_deleted: { label: "Goal deleted", pill: "security", Icon: Target, color: "var(--status-danger-fg)", category: "Performance" },
    checkin_recorded: { label: "Check-in", pill: "created", Icon: ListPlus, color: "var(--status-ok-fg)", category: "Performance" },
    checkin_deleted: { label: "Check-in deleted", pill: "security", Icon: ListPlus, color: "var(--status-danger-fg)", category: "Performance" },
    checkins_ingested: { label: "Check-ins via API", pill: "export", Icon: Cable, color: "var(--text-secondary)", category: "Performance" },
    report_exported: { label: "Report exported", pill: "export", Icon: ChartColumn, color: "var(--text-secondary)", category: "Data" },
} as const satisfies Record<string, AuditTypeMeta>;

/** Every event type the backend emits that has display metadata. */
export type AuditEventType = keyof typeof AUDIT_TYPES;

export const DEFAULT_AUDIT_TYPE: AuditTypeMeta = { label: "Event", pill: "changed", Icon: Shield, color: "var(--text-tertiary)", category: "Other" };

function isKnownType(eventType: string): eventType is AuditEventType {
    return Object.hasOwn(AUDIT_TYPES, eventType);
}

export function auditMeta(eventType: string | null | undefined): AuditTypeMeta {
    return eventType && isKnownType(eventType) ? AUDIT_TYPES[eventType] : DEFAULT_AUDIT_TYPE;
}

export const AUDIT_FILTERS: readonly ("All" | Exclude<AuditCategory, "Other">)[] = [
    "All", "Login", "Users", "Departments", "Auth", "Integrations", "Data", "Settings", "Finance", "Performance",
];
