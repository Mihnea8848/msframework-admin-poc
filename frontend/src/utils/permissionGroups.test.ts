import { describe, expect, it } from "vitest";
import { PERMISSION_META, groupPermissions, permissionMatrix } from "./permissionGroups";

describe("groupPermissions", () => {
    it("groups by area, in area order, and lists each area in a fixed order", () => {
        const groups = groupPermissions(["DOCUMENTATION_READ", "USER_UPDATE", "DASHBOARD_READ", "USER_READ", "USER_READ"]);
        expect(groups.map((g) => g.area)).toEqual(["Overview", "People", "Resources"]);
        expect(groups[1]?.items.map((i) => i.key)).toEqual(["USER_READ", "USER_UPDATE"]);
        expect(groups[1]?.items[0]?.label).toBe("View users");
    });

    it("puts permissions the frontend does not know under Other", () => {
        const groups = groupPermissions(["SPACESHIP_FLY", "USER_READ"]);
        expect(groups.map((g) => g.area)).toEqual(["People", "Other"]);
        expect(groups[1]?.items).toEqual([{ key: "SPACESHIP_FLY", label: "spaceship fly" }]);
    });

    it("returns nothing for no permissions", () => {
        expect(groupPermissions([])).toEqual([]);
    });
});

describe("permissionMatrix", () => {
    const roles = [
        { permissions: ["USER_READ", "USER_UPDATE", "DASHBOARD_READ"] },
        { permissions: ["DASHBOARD_READ"] },
    ];

    it("has a row for every known permission, with a tick per role in role order", () => {
        const matrix = permissionMatrix(roles);
        const rows = matrix.flatMap((g) => g.rows);
        expect(rows).toHaveLength(Object.keys(PERMISSION_META).length);
        const byKey = new Map(rows.map((r) => [r.key, r.granted]));
        expect(byKey.get("USER_UPDATE")).toEqual([true, false]);
        expect(byKey.get("DASHBOARD_READ")).toEqual([true, true]);
        expect(byKey.get("FINANCE_READ")).toEqual([false, false]);
    });

    it("adds unknown permissions a role holds under Other", () => {
        const matrix = permissionMatrix([{ permissions: ["NEW_THING"] }]);
        expect(matrix.at(-1)).toEqual({ area: "Other", rows: [{ key: "NEW_THING", label: "new thing", granted: [true] }] });
    });
});
