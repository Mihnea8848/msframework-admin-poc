/**
 * Pure functions behind the Dashboard: they turn the results of the API calls into the status
 * cards, the summary line and the "at a glance" figures. Nothing here fetches or reads the clock,
 * so it is easy to test (status.test.ts).
 *
 * Rule: never invent a number. When something was not checked (the user may not read it) or
 * could not be loaded, the card says so in a neutral state.
 */
import { hasRole } from "../../auth/permissions";
import type { DepartmentResponse, ServiceConnection, TableInfo, UserDto } from "../../api/types";
import { securityScore } from "../../utils/securityChecks";
import type { SecurityCheck } from "../../utils/securityChecks";

/** The outcome of one timed request. */
export type Probe<T> =
    | { ok: true; value: T; ms: number }
    | { ok: false; status: number; message: string; ms: number };

export type CardState = "ok" | "warn" | "danger" | "neutral";
export type CardKey = "api" | "database" | "integrations" | "security";

export interface StatusCard {
    key: CardKey;
    name: string;
    state: CardState;
    /** One plain-language line, for example "Operational, 14 ms". */
    text: string;
    /** The short pill at the bottom of the card, for example "Working". */
    badge: string;
}

export interface StatusInput {
    /** GET /api/auth/me, which every signed-in user may call. */
    api: Probe<unknown>;
    /** GET /api/database/tables; null when the user lacks DATABASE_READ. */
    database: Probe<TableInfo[]> | null;
    /** GET /api/connections; null when the user lacks CONNECTIONS_READ. */
    connections: Probe<ServiceConnection[]> | null;
    /**
     * The security checks (utils/securityChecks); null when the user lacks SECURITY_READ,
     * "failed" when the data behind them could not be loaded.
     */
    security: readonly SecurityCheck[] | "failed" | null;
}

/** Display names for the integration ids in config/Integrations.java. */
export const INTEGRATION_NAMES: Record<string, string> = {
    slack: "Slack",
    github: "GitHub",
    google: "Google Workspace",
    stripe: "Stripe",
    jira: "Jira",
    aws: "AWS S3",
    zapier: "Zapier",
    sendgrid: "SendGrid",
    datadog: "Datadog",
    pagerduty: "PagerDuty",
    twilio: "Twilio",
    notion: "Notion",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** No answer at all, or a server-side failure. */
function isDown(probe: { ok: false; status: number }): boolean {
    return probe.status === 0 || probe.status >= 500;
}

function notChecked(key: CardKey, name: string, why: string): StatusCard {
    return { key, name, state: "neutral", text: why, badge: "Not checked" };
}

function failed(key: CardKey, name: string, probe: { ok: false; status: number }, what: string): StatusCard {
    if (probe.status === 403) return notChecked(key, name, "Your role cannot read this.");
    return isDown(probe)
        ? { key, name, state: "danger", text: `${what} is not responding.`, badge: "Down" }
        : { key, name, state: "warn", text: `${what} answered with an error (${probe.status}).`, badge: "Needs attention" };
}

export function apiCard(api: Probe<unknown>): StatusCard {
    const name = "API";
    if (!api.ok) return failed("api", name, api, "The API");
    return { key: "api", name, state: "ok", text: `Operational, ${api.ms} ms`, badge: "Working" };
}

export function databaseCard(database: Probe<TableInfo[]> | null): StatusCard {
    const name = "Database";
    if (!database) return notChecked("database", name, "Needs access to the Database page.");
    if (!database.ok) return failed("database", name, database, "The database");
    const tables = database.value.length;
    return { key: "database", name, state: "ok", text: `Operational, ${database.ms} ms, ${plural(tables, "table", "tables")}`, badge: "Working" };
}

export function integrationsCard(connections: Probe<ServiceConnection[]> | null): StatusCard {
    const name = "Integrations";
    if (!connections) return notChecked("integrations", name, "Needs access to the Connections page.");
    if (!connections.ok) return failed("integrations", name, connections, "The integrations service");
    const connected = connections.value.filter((c) => c.connected);
    const paused = connected.filter((c) => !c.enabled);
    if (connected.length === 0) {
        return { key: "integrations", name, state: "neutral", text: "No integrations connected", badge: "None connected" };
    }
    if (paused.length > 0) {
        const names = paused.map((c) => INTEGRATION_NAMES[c.serviceId] ?? c.serviceId).join(", ");
        return {
            key: "integrations",
            name,
            state: "warn",
            text: `${paused.length} of ${connected.length} connected integrations paused (${names})`,
            badge: "Needs attention",
        };
    }
    return { key: "integrations", name, state: "ok", text: `${plural(connected.length, "integration", "integrations")} connected, all active`, badge: "Working" };
}

export function securityCard(security: readonly SecurityCheck[] | "failed" | null): StatusCard {
    const name = "Security score";
    if (!security) return notChecked("security", name, "Needs access to the Security page.");
    if (security === "failed") return notChecked("security", name, "The data for the checks could not be loaded.");
    const score = securityScore(security);
    const review = security.filter((c) => c.status !== "pass").length;
    const text = review === 0
        ? `${score} / 100, nothing to review`
        : `${score} / 100, ${plural(review, "item", "items")} to review`;
    if (score < 50) return { key: "security", name, state: "danger", text, badge: "At risk" };
    if (review > 0) return { key: "security", name, state: "warn", text, badge: "Needs review" };
    return { key: "security", name, state: "ok", text, badge: "Good" };
}

/** The four System status cards, in display order. */
export function deriveStatusCards(input: StatusInput): StatusCard[] {
    return [apiCard(input.api), databaseCard(input.database), integrationsCard(input.connections), securityCard(input.security)];
}

export interface StatusSummary {
    tone: "ok" | "warn" | "danger";
    text: string;
    /** Cards in the warn or danger state. */
    attention: number;
}

/** The one-line verdict above the cards. Cards that were not checked do not count. */
export function summarizeStatus(cards: readonly StatusCard[]): StatusSummary {
    const attention = cards.filter((c) => c.state === "warn" || c.state === "danger").length;
    const needs = attention === 1 ? "1 item needs attention." : `${attention} items need attention.`;
    if (cards.some((c) => c.state === "danger")) return { tone: "danger", text: `Something is not working. ${needs}`, attention };
    if (attention > 0) return { tone: "warn", text: `Mostly working. ${needs}`, attention };
    return { tone: "ok", text: "Everything is working.", attention };
}

/** "Checked just now", "Checked 1 min ago", "Checked 5 min ago", "Checked 2 h ago". */
export function checkedLabel(checkedAt: number, now: number): string {
    const minutes = Math.floor(Math.max(0, now - checkedAt) / 60000);
    if (minutes < 1) return "Checked just now";
    if (minutes < 60) return `Checked ${minutes} min ago`;
    return `Checked ${Math.floor(minutes / 60)} h ago`;
}

export interface GlanceFigure {
    key: "total" | "active" | "admins" | "departments";
    label: string;
    value: number;
    detail: string;
    /** Where the card links to. */
    to: string;
}

function namesList(names: string[]): string {
    if (names.length === 0) return "No admins";
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/** The user figures (needs USER_READ). */
export function userFigures(users: readonly UserDto[]): GlanceFigure[] {
    const total = users.length;
    const active = users.filter((u) => (u.status || "").toLowerCase() === "active").length;
    const admins = users.filter((u) => hasRole(u, "ADMIN"));
    const noDept = users.filter((u) => u.departmentId == null).length;
    return [
        {
            key: "total",
            label: "Total users",
            value: total,
            detail: noDept ? `${plural(noDept, "user", "users")} without a department` : "All users have a department",
            to: "/users",
        },
        { key: "active", label: "Active", value: active, detail: `${total - active} inactive`, to: "/users" },
        {
            key: "admins",
            label: "Admins",
            value: admins.length,
            detail: namesList(admins.map((a) => a.fullName || a.email)),
            to: "/users",
        },
    ];
}

/** The department figure (needs DEPARTMENT_READ). */
export function departmentFigure(departments: readonly DepartmentResponse[]): GlanceFigure {
    const empty = departments.filter((d) => d.memberCount === 0).length;
    const members = departments.reduce((sum, d) => sum + d.memberCount, 0);
    return {
        key: "departments",
        label: "Departments",
        value: departments.length,
        detail: empty
            ? `${plural(empty, "department has", "departments have")} no members`
            : `${plural(members, "member", "members")} in total`,
        to: "/departments",
    };
}
