import { describe, expect, it } from "vitest";
import type { AuditEventDto } from "../../api/types";
import { visiblePages } from "../../routes/navigation";
import { isNotable, unreadCount } from "../../utils/activityBadge";
import {
    NO_FILTERS, canReadActivity, canReadAuditLog, filterAuditEvents, hasActiveFilters, isRangeInverted, mergeNewer,
} from "./feed";

const admin = { id: 1, email: "admin@test.com", roles: ["ADMIN"], permissions: ["AUDIT_READ", "SESSIONS_MANAGE"] };
const manager = { id: 2, email: "radu@mehstudios.net", roles: ["MANAGER"], permissions: ["DASHBOARD_READ", "AUDIT_READ"] };
const member = { id: 3, email: "mara@mehstudios.net", roles: ["MEMBER"], permissions: ["DASHBOARD_READ", "USER_READ"] };
const viewer = { id: 4, email: "vera@mehstudios.net", roles: ["VIEWER"], permissions: ["DASHBOARD_READ"] };

function ev(id: number, eventType: string, actorEmail: string, createdAt = "2026-11-03T10:00:00"): AuditEventDto {
    return { id, eventType, actorEmail, description: `${eventType} ${id}`, createdAt };
}

describe("who reads which feed", () => {
    it("lets every signed-in user read their own Activity", () => {
        for (const user of [admin, manager, member, viewer]) expect(canReadActivity(user)).toBe(true);
        expect(canReadActivity(null)).toBe(false);
    });

    it("keeps the full Audit log for AUDIT_READ", () => {
        expect(canReadAuditLog(admin)).toBe(true);
        expect(canReadAuditLog(manager)).toBe(true);
        expect(canReadAuditLog(member)).toBe(false);
        expect(canReadAuditLog(viewer)).toBe(false);
    });

    it("matches the sidebar: Activity and Sessions for everyone, the Audit log only with AUDIT_READ", () => {
        const keys = (user: typeof admin) => visiblePages(user).map((p) => p.key);
        for (const user of [admin, manager, member, viewer]) {
            expect(keys(user)).toContain("activity");
            expect(keys(user)).toContain("sessions");
            expect(keys(user).includes("audit")).toBe(canReadAuditLog(user));
        }
    });
});

describe("the unread badge", () => {
    it("ignores your own actions but counts what others did and warnings about you", () => {
        expect(isNotable(ev(1, "user_login", "MARA@mehstudios.net"), member)).toBe(false);
        expect(isNotable(ev(2, "password_changed", member.email), member)).toBe(false);
        expect(isNotable(ev(3, "user_updated", admin.email), member)).toBe(true);
        expect(isNotable(ev(4, "login_failed", member.email), member)).toBe(true);
        expect(isNotable(ev(5, "account_locked", member.email), member)).toBe(true);
    });

    it("counts only notable events newer than the last one seen", () => {
        const events = [ev(9, "user_updated", admin.email), ev(8, "user_login", member.email), ev(7, "sessions_revoked", admin.email)];
        expect(unreadCount(events, 0, member)).toBe(2);
        expect(unreadCount(events, 7, member)).toBe(1);
        expect(unreadCount(events, 9, member)).toBe(0);
    });
});

describe("Audit log filters", () => {
    const events = [
        ev(5, "user_login", "radu@mehstudios.net", "2026-11-03T18:30:00"),
        ev(4, "user_updated", "admin@test.com", "2026-11-03T09:00:00"),
        ev(3, "account_locked", "mara@mehstudios.net", "2026-11-02T23:59:00"),
        ev(2, "dept_created", "admin@test.com", "2026-11-01T08:00:00"),
        ev(1, "mystery_event", "system", "2026-10-30T08:00:00"),
    ];
    const ids = (list: AuditEventDto[]) => list.map((e) => e.id);

    it("returns everything without filters", () => {
        expect(ids(filterAuditEvents(events, NO_FILTERS))).toEqual([5, 4, 3, 2, 1]);
        expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    });

    it("filters by category", () => {
        expect(ids(filterAuditEvents(events, { ...NO_FILTERS, category: "Login" }))).toEqual([5, 3]);
        expect(ids(filterAuditEvents(events, { ...NO_FILTERS, category: "Departments" }))).toEqual([2]);
    });

    it("searches the actor case-insensitively", () => {
        expect(ids(filterAuditEvents(events, { ...NO_FILTERS, actor: " ADMIN@ " }))).toEqual([4, 2]);
        expect(hasActiveFilters({ ...NO_FILTERS, actor: "x" })).toBe(true);
    });

    it("takes whole local days, both ends inclusive", () => {
        expect(ids(filterAuditEvents(events, { ...NO_FILTERS, from: "2026-11-03", to: "2026-11-03" }))).toEqual([5, 4]);
        expect(ids(filterAuditEvents(events, { ...NO_FILTERS, from: "2026-11-02" }))).toEqual([5, 4, 3]);
        expect(ids(filterAuditEvents(events, { ...NO_FILTERS, to: "2026-11-01" }))).toEqual([2, 1]);
    });

    it("combines filters", () => {
        expect(ids(filterAuditEvents(events, { category: "Users", actor: "admin", from: "2026-11-02", to: "" }))).toEqual([4]);
    });

    it("spots a backwards range and ignores invalid days", () => {
        expect(isRangeInverted({ from: "2026-11-03", to: "2026-11-01" })).toBe(true);
        expect(isRangeInverted({ from: "2026-11-01", to: "2026-11-03" })).toBe(false);
        expect(isRangeInverted({ from: "", to: "2026-11-01" })).toBe(false);
        expect(ids(filterAuditEvents(events, { ...NO_FILTERS, from: "not-a-day" }))).toEqual([5, 4, 3, 2, 1]);
    });
});

describe("mergeNewer", () => {
    it("puts new events on top and drops duplicates", () => {
        const current = [ev(3, "a", "x"), ev(2, "a", "x")];
        const fresh = [ev(5, "a", "x"), ev(4, "a", "x"), ev(3, "a", "x")];
        expect(mergeNewer(current, fresh).map((e) => e.id)).toEqual([5, 4, 3, 2]);
        expect(mergeNewer(current, [])).toEqual(current);
    });
});
