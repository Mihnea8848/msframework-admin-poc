import { hasRole } from "../auth/permissions";
import type { ApiKeyDto, AuditEventDto, UserDto } from "../api/types";

/**
 * The security checks shown on the Security page and summarised on the Dashboard, computed from
 * live data. Each check only runs when the caller may read the data it needs.
 */

export type CheckStatus = "pass" | "warn" | "fail";

export interface SecurityCheck {
    label: string;
    detail: string;
    status: CheckStatus;
}

export interface SecurityInput {
    users: readonly UserDto[];
    events: readonly AuditEventDto[];
    keys: readonly ApiKeyDto[];
    /** Milliseconds since the epoch the checks are measured against. */
    now: number;
    canReadUsers: boolean;
    canReadAudit: boolean;
    canReadKeys: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many audit events the checks look at (the Security page fetches this many). */
export const SECURITY_AUDIT_LIMIT = 300;

export function securityChecks({ users, events, keys, now, canReadUsers, canReadAudit, canReadKeys }: SecurityInput): SecurityCheck[] {
    const inactive = users.filter((u) => (u.status || "").toLowerCase() !== "active").length;
    const admins = users.filter((u) => hasRole(u, "ADMIN")).length;
    const adminRatio = users.length ? admins / users.length : 0;
    const noDepartment = users.filter((u) => u.departmentId == null).length;
    const failedLogins = events.filter((e) => e.eventType === "login_failed" && now - new Date(e.createdAt).getTime() < DAY_MS).length;
    const oldKeys = keys.filter((k) => k.createdAt && now - new Date(k.createdAt).getTime() > 90 * DAY_MS).length;

    const checks: SecurityCheck[] = [];
    if (canReadUsers) {
        checks.push({
            label: "Admin ratio",
            detail: `${admins} admin${admins !== 1 ? "s" : ""} of ${users.length} users (${(adminRatio * 100).toFixed(0)}%)`,
            status: admins === 0 ? "fail" : adminRatio <= 0.25 ? "pass" : adminRatio <= 0.5 ? "warn" : "fail",
        });
        checks.push({
            label: "Inactive accounts",
            detail: inactive === 0 ? "No inactive accounts" : `${inactive} account${inactive !== 1 ? "s are" : " is"} deactivated — delete them if no longer needed`,
            status: inactive === 0 ? "pass" : inactive < 3 ? "warn" : "fail",
        });
        checks.push({
            label: "Unassigned users",
            detail: `${noDepartment} user${noDepartment !== 1 ? "s have" : " has"} no department`,
            status: noDepartment === 0 ? "pass" : "warn",
        });
    }
    if (canReadAudit) {
        checks.push({
            label: "Failed sign-ins (24 h)",
            detail: `${failedLogins} failed attempt${failedLogins !== 1 ? "s" : ""} in the last 24 hours`,
            status: failedLogins === 0 ? "pass" : failedLogins < 5 ? "warn" : "fail",
        });
    }
    if (canReadKeys) {
        checks.push({
            label: "API key age",
            detail: keys.length === 0 ? "No API keys issued" : `${oldKeys} of ${keys.length} key${keys.length !== 1 ? "s" : ""} older than 90 days`,
            status: oldKeys === 0 ? "pass" : "warn",
        });
    }
    checks.push({
        label: "Two-factor authentication",
        detail: "Not available yet — planned on the roadmap",
        status: "warn",
    });
    return checks;
}

const POINTS: Record<CheckStatus, number> = { pass: 1, warn: 0.5, fail: 0 };

/** 0 to 100; a warning counts half. */
export function securityScore(checks: readonly SecurityCheck[]): number {
    if (checks.length === 0) return 0;
    return Math.round((checks.reduce((sum, c) => sum + POINTS[c.status], 0) / checks.length) * 100);
}
