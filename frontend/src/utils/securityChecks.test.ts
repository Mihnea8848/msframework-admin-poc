import { describe, expect, it } from "vitest";
import type { AuditEventDto, UserDto } from "../api/types";
import { securityChecks, securityScore } from "./securityChecks";

const NOW = Date.parse("2026-11-03T12:00:00Z");

const user = (id: number, roles: string[], departmentId: number | null = 1): UserDto =>
    ({ id, fullName: `U ${id}`, email: `u${id}@mehstudios.net`, phone: null, status: "Active", departmentId, departmentName: null, roles, createdAt: null });

const failedLogin = (id: number, hoursAgo: number): AuditEventDto =>
    ({ id, eventType: "login_failed", actorEmail: null, description: "", createdAt: new Date(NOW - hoursAgo * 3_600_000).toISOString() });

describe("securityChecks", () => {
    it("only runs the checks the caller may read, and always lists two-factor", () => {
        const checks = securityChecks({ users: [], events: [], keys: [], now: NOW, canReadUsers: false, canReadAudit: false, canReadKeys: false });
        expect(checks.map((c) => c.label)).toEqual(["Two-factor authentication"]);
        expect(securityScore(checks)).toBe(50);
    });

    it("measures admins, departments and failed sign-ins in the last 24 hours", () => {
        const users = [user(1, ["ADMIN"]), user(2, ["MEMBER"]), user(3, ["MEMBER"]), user(4, ["MEMBER"], null)];
        const events = [failedLogin(1, 2), failedLogin(2, 30)];
        const checks = securityChecks({ users, events, keys: [], now: NOW, canReadUsers: true, canReadAudit: true, canReadKeys: true });
        const byLabel = Object.fromEntries(checks.map((c) => [c.label, c]));
        expect(byLabel["Admin ratio"]).toMatchObject({ status: "pass", detail: "1 admin of 4 users (25%)" });
        expect(byLabel["Unassigned users"]).toMatchObject({ status: "warn", detail: "1 user has no department" });
        expect(byLabel["Failed sign-ins (24 h)"]).toMatchObject({ status: "warn", detail: "1 failed attempt in the last 24 hours" });
        expect(byLabel["API key age"]).toMatchObject({ status: "pass", detail: "No API keys issued" });
    });
});
