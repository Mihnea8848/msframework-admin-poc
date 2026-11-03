import { describe, expect, it } from "vitest";
import type { DepartmentResponse, ServiceConnection, UserDto } from "../../api/types";
import type { SecurityCheck } from "../../utils/securityChecks";
import {
    apiCard, checkedLabel, databaseCard, departmentFigure, deriveStatusCards, integrationsCard,
    securityCard, summarizeStatus, userFigures,
} from "./status";
import type { Probe, StatusCard } from "./status";

const ok = <T,>(value: T, ms = 14): Probe<T> => ({ ok: true, value, ms });
const fail = (status: number, message = "boom"): Probe<never> => ({ ok: false, status, message, ms: 3 });

const conn = (serviceId: string, connected: boolean, enabled: boolean): ServiceConnection =>
    ({ serviceId, connected, enabled, connectedAt: null });

const user = (id: number, roles: string[], status: "Active" | "Inactive", departmentId: number | null, fullName: string): UserDto =>
    ({ id, fullName, email: `u${id}@mehstudios.net`, phone: null, status, departmentId, departmentName: null, roles, createdAt: null });

describe("status cards", () => {
    it("API: operational with the measured latency, down when unreachable", () => {
        expect(apiCard(ok(null, 23))).toMatchObject({ state: "ok", text: "Operational, 23 ms", badge: "Working" });
        expect(apiCard(fail(0))).toMatchObject({ state: "danger", text: "The API is not responding.", badge: "Down" });
        expect(apiCard(fail(503))).toMatchObject({ state: "danger" });
        expect(apiCard(fail(400))).toMatchObject({ state: "warn", text: "The API answered with an error (400)." });
    });

    it("Database: not checked without permission, latency and table count when it answers", () => {
        expect(databaseCard(null)).toMatchObject({ state: "neutral", badge: "Not checked" });
        const tables = [{ name: "users", rowCount: 1, sizeBytes: null, columns: [] }];
        expect(databaseCard(ok(tables, 9))).toMatchObject({ state: "ok", text: "Operational, 9 ms, 1 table" });
        expect(databaseCard(fail(403))).toMatchObject({ state: "neutral", badge: "Not checked" });
        expect(databaseCard(fail(500))).toMatchObject({ state: "danger", badge: "Down" });
    });

    it("Integrations: paused ones need attention, named", () => {
        const list = [conn("slack", true, false), conn("github", true, true), conn("google", true, true), conn("stripe", true, true), conn("jira", false, false)];
        expect(integrationsCard(ok(list))).toMatchObject({
            state: "warn",
            text: "1 of 4 connected integrations paused (Slack)",
            badge: "Needs attention",
        });
        expect(integrationsCard(ok([conn("github", true, true)]))).toMatchObject({ state: "ok", text: "1 integration connected, all active" });
        expect(integrationsCard(ok([conn("github", false, false)]))).toMatchObject({ state: "neutral", text: "No integrations connected" });
        expect(integrationsCard(null)).toMatchObject({ state: "neutral", badge: "Not checked" });
    });

    it("Security: the score from the shared checks, and how many items to review", () => {
        const checks: SecurityCheck[] = [
            { label: "a", detail: "", status: "pass" },
            { label: "b", detail: "", status: "pass" },
            { label: "c", detail: "", status: "pass" },
            { label: "d", detail: "", status: "warn" },
        ];
        expect(securityCard(checks)).toMatchObject({ state: "warn", text: "88 / 100, 1 item to review", badge: "Needs review" });
        expect(securityCard(checks.slice(0, 3))).toMatchObject({ state: "ok", text: "100 / 100, nothing to review", badge: "Good" });
        expect(securityCard([{ label: "x", detail: "", status: "fail" }])).toMatchObject({ state: "danger", badge: "At risk" });
        expect(securityCard(null)).toMatchObject({ state: "neutral", badge: "Not checked" });
        expect(securityCard("failed")).toMatchObject({ state: "neutral", text: "The data for the checks could not be loaded." });
    });

    it("keeps the display order", () => {
        const cards = deriveStatusCards({ api: ok(null), database: null, connections: null, security: null });
        expect(cards.map((c) => c.key)).toEqual(["api", "database", "integrations", "security"]);
    });
});

describe("summarizeStatus", () => {
    const card = (state: StatusCard["state"]): StatusCard => ({ key: "api", name: "", text: "", badge: "", state });

    it("everything working, ignoring cards that were not checked", () => {
        expect(summarizeStatus([card("ok"), card("neutral")])).toEqual({ tone: "ok", text: "Everything is working.", attention: 0 });
    });

    it("mostly working, with singular and plural", () => {
        expect(summarizeStatus([card("ok"), card("warn")]).text).toBe("Mostly working. 1 item needs attention.");
        expect(summarizeStatus([card("warn"), card("warn")]).text).toBe("Mostly working. 2 items need attention.");
    });

    it("something is not working when a card is down", () => {
        expect(summarizeStatus([card("danger"), card("warn")])).toEqual({
            tone: "danger",
            text: "Something is not working. 2 items need attention.",
            attention: 2,
        });
    });
});

describe("checkedLabel", () => {
    it("counts minutes, then hours", () => {
        const t = 1_000_000;
        expect(checkedLabel(t, t + 10_000)).toBe("Checked just now");
        expect(checkedLabel(t, t + 60_000)).toBe("Checked 1 min ago");
        expect(checkedLabel(t, t + 5 * 60_000)).toBe("Checked 5 min ago");
        expect(checkedLabel(t, t + 2 * 3_600_000)).toBe("Checked 2 h ago");
    });
});

describe("at a glance", () => {
    it("derives the user figures and their detail lines from the user list", () => {
        const users = [
            user(1, ["ADMIN"], "Active", 1, "Alex Mercer"),
            user(2, ["ADMIN"], "Active", null, "Sarah Jenkins"),
            user(3, ["MEMBER"], "Inactive", 2, "Radu Stan"),
        ];
        const [total, active, admins] = userFigures(users);
        expect(total).toMatchObject({ value: 3, detail: "1 user without a department" });
        expect(active).toMatchObject({ value: 2, detail: "1 inactive" });
        expect(admins).toMatchObject({ value: 2, detail: "Alex Mercer, Sarah Jenkins" });
        expect(userFigures([])[2]).toMatchObject({ value: 0, detail: "No admins" });
    });

    it("derives the department figure from member counts", () => {
        const dept = (id: number, memberCount: number): DepartmentResponse => ({ id, name: `D${id}`, color: null, memberCount });
        expect(departmentFigure([dept(1, 3), dept(2, 0)])).toMatchObject({ value: 2, detail: "1 department has no members" });
        expect(departmentFigure([dept(1, 3), dept(2, 2)])).toMatchObject({ value: 2, detail: "5 members in total" });
    });
});
