import { describe, expect, it } from "vitest";
import {
    LEGACY_PATHS, MOBILE_TAB_COUNT, PAGES, SETTINGS_TABS, crumbFor, groupPages, mobileTabs, morePages, pageByPath, visiblePages,
} from "./navigation";

const ALL = [...new Set(PAGES.map((p) => p.permission).filter((p) => p !== null))];
const admin = { roles: ["ADMIN"], permissions: ALL };
const member = { roles: ["MEMBER"], permissions: ["DASHBOARD_READ", "USER_READ", "DEPARTMENT_READ", "TIMEZONES_READ", "DOCUMENTATION_READ"] };
const viewer = { roles: ["VIEWER"], permissions: ["DASHBOARD_READ", "DOCUMENTATION_READ"] };
const nobody = { roles: [], permissions: [] };

const keys = (pages: { key: string }[]) => pages.map((p) => p.key);

describe("mobileTabs", () => {
    it("gives an admin Home, Dashboard, Users and Departments", () => {
        expect(keys(mobileTabs(admin))).toEqual(["home", "dashboard", "users", "departments"]);
    });

    it("skips pages the user may not open and fills up by mobilePriority", () => {
        // A viewer cannot open Users, Departments or Activity, so Documentation (6) moves up.
        expect(keys(mobileTabs(viewer))).toEqual(["home", "dashboard", "docs"]);
    });

    it("orders by mobilePriority, not by sidebar order", () => {
        const tabs = mobileTabs(member);
        expect(keys(tabs)).toEqual(["home", "dashboard", "users", "departments"]);
        const priorities = tabs.map((p) => p.mobilePriority ?? Infinity);
        expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    });

    it("never returns more than MOBILE_TAB_COUNT tabs", () => {
        for (const user of [admin, member, viewer, nobody]) {
            expect(mobileTabs(user).length).toBeLessThanOrEqual(MOBILE_TAB_COUNT);
        }
    });

    it("works with fewer permitted pages than tabs", () => {
        expect(keys(mobileTabs(nobody))).toEqual(["home"]);
    });
});

describe("morePages", () => {
    it("lists every other permitted page, in sidebar order", () => {
        const more = morePages(admin);
        expect(more.some((p) => keys(mobileTabs(admin)).includes(p.key))).toBe(false);
        expect(more.length + MOBILE_TAB_COUNT).toBe(visiblePages(admin).length);
        expect(keys(more)).toEqual(keys(PAGES.filter((p) => more.includes(p))));
    });

    it("leaves out pages the user may not open", () => {
        expect(morePages(viewer)).toEqual([]);
        expect(keys(morePages(member))).toEqual(["timezones", "docs"]);
        expect(morePages(nobody)).toEqual([]);
    });
});

describe("groupPages and pageByPath", () => {
    it("groups in sidebar group order and skips empty groups", () => {
        // Performance has no pages yet, so it is skipped.
        expect(groupPages(visiblePages(admin)).map((g) => g.group)).toEqual(["Overview", "People", "Finance", "Operations", "Security", "Resources"]);
        expect(groupPages(PAGES.filter((p) => p.key === "users")).map((g) => g.group)).toEqual(["People"]);
    });

    it("finds a page by its exact path", () => {
        expect(pageByPath("/users")?.key).toBe("users");
        expect(pageByPath("/")?.key).toBe("home");
        expect(pageByPath("/nope")).toBeUndefined();
    });
});

describe("Settings and old paths", () => {
    it("keeps Settings out of the sidebar, with one path per tab", () => {
        expect(PAGES.some((p) => p.path.startsWith("/settings"))).toBe(false);
        expect(SETTINGS_TABS.map((t) => t.path)).toEqual([
            "/settings/account", "/settings/security", "/settings/appearance", "/settings/organisation",
        ]);
    });

    it("gives Settings tabs and pages a breadcrumb", () => {
        expect(crumbFor("/settings/appearance")).toEqual({ group: "Settings", label: "Appearance" });
        expect(crumbFor("/settings")).toEqual({ group: "Settings", label: "Settings" });
        expect(crumbFor("/audit")).toEqual({ group: "Security", label: "Audit log" });
        expect(crumbFor("/nope")).toBeNull();
    });

    it("sends every old path to a page or tab that exists", () => {
        const targets = new Set([...PAGES.map((p) => p.path), ...SETTINGS_TABS.map((t) => t.path)]);
        for (const to of Object.values(LEGACY_PATHS)) expect(targets.has(to)).toBe(true);
        expect(LEGACY_PATHS["/notifications"]).toBe("/activity");
    });
});
