import { describe, expect, it } from "vitest";
import {
    LEGACY_PATHS, MOBILE_TAB_COUNT, PAGES, SETTINGS_TABS, crumbFor, groupPages, mobileTabs, morePages, pageByPath, visiblePages,
} from "./navigation";

const ALL = [...new Set(PAGES.flatMap((p) => (p.permission === null ? [] : typeof p.permission === "string" ? [p.permission] : [...p.permission])))];
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
        expect(groupPages(visiblePages(admin)).map((g) => g.group)).toEqual(["Overview", "People", "Performance", "Finance", "Operations", "Security", "Resources"]);
        expect(groupPages(visiblePages(viewer)).map((g) => g.group)).toEqual(["Overview", "Resources"]);
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

describe("business pages", () => {
    const realMember = { roles: ["MEMBER"], permissions: [...member.permissions, "EXPENSE_SUBMIT", "GOALS_READ"] };
    const realViewer = { roles: ["VIEWER"], permissions: [...viewer.permissions, "REPORTS_READ", "GOALS_READ"] };
    const manager = {
        roles: ["MANAGER"],
        permissions: [...member.permissions, "AUDIT_READ", "FINANCE_READ", "EXPENSE_SUBMIT", "EXPENSE_APPROVE", "GOALS_READ", "GOALS_MANAGE", "REPORTS_READ"],
    };
    const business = (user: { permissions: string[] }) =>
        keys(visiblePages(user)).filter((k) => ["goals", "reports", "budgets", "expenses", "payments", "import"].includes(k));

    it("puts Goals and Reports under Performance, Budgets, Expenses and Payments under Finance", () => {
        const groups = Object.fromEntries(groupPages(visiblePages(admin)).map((g) => [g.group, keys(g.pages)]));
        expect(groups.Performance).toEqual(["goals", "reports"]);
        expect(groups.Finance).toEqual(["budgets", "expenses", "payments"]);
    });

    it("shows each role only the business pages it may use", () => {
        expect(business(admin)).toEqual(["goals", "reports", "budgets", "expenses", "payments", "import"]);
        // Managers import check-ins (GOALS_MANAGE) but not users, departments or money.
        expect(business(manager)).toEqual(["goals", "reports", "budgets", "expenses", "payments", "import"]);
        expect(business(realMember)).toEqual(["goals", "expenses"]);
        expect(business(realViewer)).toEqual(["goals", "reports"]);
    });

    it("opens Expenses with any of submit, approve or finance read", () => {
        expect(business({ permissions: ["EXPENSE_APPROVE"] })).toEqual(["expenses"]);
        expect(business({ permissions: ["FINANCE_READ"] })).toEqual(["budgets", "expenses", "payments"]);
        expect(business({ permissions: ["PAYMENTS_READ"] })).toEqual([]);
    });
});
