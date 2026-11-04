import { describe, expect, it } from "vitest";
import { hasPermission, hasRole, primaryRole, ROLES } from "./permissions";
import { PAGES, pageByKey } from "../routes/navigation";

const manager = {
    roles: ["MANAGER"],
    permissions: ["DASHBOARD_READ", "USER_READ", "DEPARTMENT_READ", "DEPARTMENT_UPDATE"],
};

describe("hasPermission", () => {
    it("is true when the user has the permission", () => {
        expect(hasPermission(manager, "USER_READ")).toBe(true);
    });

    it("is false when the user lacks it", () => {
        expect(hasPermission(manager, "USER_DELETE")).toBe(false);
    });

    it("allows everyone when no permission is required", () => {
        expect(hasPermission(null, null)).toBe(true);
        expect(hasPermission(undefined, undefined)).toBe(true);
    });

    it("is false for a missing user or missing permission list", () => {
        expect(hasPermission(null, "DASHBOARD_READ")).toBe(false);
        expect(hasPermission({ roles: ["ADMIN"] }, "DASHBOARD_READ")).toBe(false);
        expect(hasPermission({ permissions: null }, "DASHBOARD_READ")).toBe(false);
    });
});

describe("hasRole", () => {
    it("checks the role names", () => {
        expect(hasRole(manager, "MANAGER")).toBe(true);
        expect(hasRole(manager, "ADMIN")).toBe(false);
        expect(hasRole(null, "ADMIN")).toBe(false);
    });
});

describe("primaryRole", () => {
    it("picks the highest built-in role", () => {
        expect(primaryRole({ roles: ["VIEWER", "ADMIN"] })).toBe("ADMIN");
        expect(primaryRole({ roles: ["MEMBER", "MANAGER"] })).toBe("MANAGER");
    });

    it("falls back to the first custom role, then a dash", () => {
        expect(primaryRole({ roles: ["AUDITOR"] })).toBe("AUDITOR");
        expect(primaryRole({ roles: [] })).toBe("—");
        expect(primaryRole(null)).toBe("—");
    });

    it("lists the roles from most to least privileged", () => {
        expect(ROLES).toEqual(["ADMIN", "MANAGER", "MEMBER", "VIEWER"]);
    });
});

describe("navigation permissions", () => {
    it("has unique keys and paths", () => {
        expect(new Set(PAGES.map((p) => p.key)).size).toBe(PAGES.length);
        expect(new Set(PAGES.map((p) => p.path)).size).toBe(PAGES.length);
    });

    it("shows a manager only the pages they may open", () => {
        const visible = PAGES.filter((p) => hasPermission(manager, p.permission)).map((p) => p.key);
        expect(visible).toEqual(["home", "dashboard", "activity", "users", "departments", "sessions"]);
    });

    it("finds a page by key", () => {
        expect(pageByKey("users")?.path).toBe("/users");
        expect(pageByKey("nope")).toBeUndefined();
    });
});
