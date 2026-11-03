import {
    Building2, Cable, Clock3, Download, Key, LogIn, LogOut, RefreshCw, Shield, ShieldAlert,
    UserCheck, UserMinus, UserPlus, UserCog, Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Filter categories on the Notifications page ("All" is added by AUDIT_FILTERS). */
export type AuditCategory =
    | "Login" | "Users" | "Departments" | "Auth" | "Integrations" | "Data" | "Settings" | "Other";

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
    "All", "Login", "Users", "Departments", "Auth", "Integrations", "Data", "Settings",
];
