import { describe, expect, it } from "vitest";
import type { UserDto } from "../api/types";
import type { BudgetLineLite, BulkUserResult } from "../api/people";
import {
    EMPTY_USER_FILTERS, budgetsByDepartment, eligibleManagers, hasUserFilters, nextSort, rangeLabel,
    readUserFilters, sortDirection, summariseBulk, updateUserFilters, userSearchPath, utilisation,
    utilisationTone, writeUserFilters,
} from "./people";

describe("user filters and the URL", () => {
    it("reads every filter from the query string", () => {
        const filters = readUserFilters(new URLSearchParams("q=ana&role=manager&status=Inactive&dept=3&sort=-lastLoginAt&page=2"));
        expect(filters).toEqual({ q: "ana", role: "MANAGER", status: "Inactive", departmentId: 3, sort: "-lastLoginAt", page: 2 });
    });

    it("falls back to the defaults for missing or invalid values", () => {
        expect(readUserFilters(new URLSearchParams(""))).toEqual(EMPTY_USER_FILTERS);
        const filters = readUserFilters(new URLSearchParams("role=OWNER&status=gone&dept=abc&sort=password&page=-4"));
        expect(filters).toEqual(EMPTY_USER_FILTERS);
        expect(readUserFilters(new URLSearchParams("page=0&dept=0")).page).toBe(1);
    });

    it("writes only what differs from the defaults", () => {
        expect(writeUserFilters(EMPTY_USER_FILTERS).toString()).toBe("");
        const params = writeUserFilters({ ...EMPTY_USER_FILTERS, q: "  kim ", status: "Active", departmentId: 7, sort: "-name", page: 3 });
        expect(params.toString()).toBe("q=kim&status=Active&dept=7&sort=-name&page=3");
    });

    it("round-trips through the URL", () => {
        const filters = { q: "radu", role: "VIEWER", status: "Active", departmentId: 4, sort: "email", page: 5 } as const;
        expect(readUserFilters(writeUserFilters(filters))).toEqual(filters);
    });

    it("goes back to page 1 when a filter changes, but not when only the page does", () => {
        const onPage3 = { ...EMPTY_USER_FILTERS, page: 3 };
        expect(updateUserFilters(onPage3, { role: "ADMIN" }).page).toBe(1);
        expect(updateUserFilters(onPage3, { sort: "-email" }).page).toBe(1);
        expect(updateUserFilters(onPage3, { page: 4 }).page).toBe(4);
    });

    it("knows when the list is filtered", () => {
        expect(hasUserFilters(EMPTY_USER_FILTERS)).toBe(false);
        expect(hasUserFilters({ ...EMPTY_USER_FILTERS, sort: "-name", page: 2 })).toBe(false);
        expect(hasUserFilters({ ...EMPTY_USER_FILTERS, departmentId: 1 })).toBe(true);
    });

    it("builds the search API path with a zero-based page", () => {
        expect(userSearchPath(EMPTY_USER_FILTERS)).toBe("/api/users/search?sort=name&page=0&size=25");
        expect(userSearchPath({ ...EMPTY_USER_FILTERS, q: "a b", role: "MEMBER", departmentId: 2, page: 2 }))
            .toBe("/api/users/search?q=a+b&role=MEMBER&departmentId=2&sort=name&page=1&size=25");
    });

    it("flips the direction of the sorted column and starts others ascending", () => {
        expect(nextSort("name", "name")).toBe("-name");
        expect(nextSort("-name", "name")).toBe("name");
        expect(nextSort("-name", "email")).toBe("email");
        expect(sortDirection("name", "name")).toBe("ascending");
        expect(sortDirection("-lastLoginAt", "lastLoginAt")).toBe("descending");
        expect(sortDirection("name", "email")).toBe("none");
    });

    it("describes the range shown", () => {
        expect(rangeLabel(1, 25, 25, 61)).toBe("Showing 1–25 of 61");
        expect(rangeLabel(3, 25, 11, 61)).toBe("Showing 51–61 of 61");
        expect(rangeLabel(1, 25, 0, 0)).toBe("No users");
    });
});

describe("summariseBulk", () => {
    const names = new Map([[1, "Ana Pop"], [2, "Ion Ene"]]);

    it("reports a full success", () => {
        const result: BulkUserResult = {
            succeeded: 2, failed: 0,
            results: [{ id: 1, ok: true, error: null, user: null }, { id: 2, ok: true, error: null, user: null }],
        };
        expect(summariseBulk(result, names, "Deactivated")).toMatchObject({ headline: "Deactivated 2 users.", tone: "ok", failures: [] });
    });

    it("lists each failure with the person's name and the API's message", () => {
        const result: BulkUserResult = {
            succeeded: 1, failed: 2,
            results: [
                { id: 1, ok: true, error: null, user: null },
                { id: 2, ok: false, error: "You cannot deactivate yourself", user: null },
                { id: 9, ok: false, error: null, user: null },
            ],
        };
        const summary = summariseBulk(result, names);
        expect(summary.tone).toBe("warn");
        expect(summary.headline).toBe("Updated 1 user; 2 could not be changed.");
        expect(summary.failures).toEqual([
            { id: 2, name: "Ion Ene", message: "You cannot deactivate yourself" },
            { id: 9, name: "User #9", message: "Not changed." },
        ]);
    });

    it("says nothing changed when every user failed", () => {
        const result: BulkUserResult = { succeeded: 0, failed: 1, results: [{ id: 1, ok: false, error: "No", user: null }] };
        expect(summariseBulk(result, names)).toMatchObject({ tone: "danger", headline: "No users were changed: 1 failure." });
    });
});

describe("eligibleManagers", () => {
    const user = (id: number, roles: string[], status: UserDto["status"] = "Active") =>
        ({ id, roles, status }) as Pick<UserDto, "id" | "roles" | "status">;

    it("keeps only active members with the MANAGER or ADMIN role", () => {
        const members = [
            user(1, ["MANAGER"]),
            user(2, ["ADMIN"]),
            user(3, ["MEMBER"]),
            user(4, ["MANAGER"], "Inactive"),
            user(5, ["VIEWER"]),
        ];
        expect(eligibleManagers(members).map((m) => m.id)).toEqual([1, 2]);
    });

    it("returns nothing for a department without eligible people", () => {
        expect(eligibleManagers([user(1, ["MEMBER"])])).toEqual([]);
    });
});

describe("department budgets", () => {
    const line = (departmentId: number | null, amount: number, spent: number, committed = 0): BudgetLineLite => ({
        departmentId, departmentName: null, categoryId: 1, categoryName: null, amount, spent, committed, remaining: amount - spent - committed,
    });

    it("adds up the lines of each department", () => {
        const sums = budgetsByDepartment([line(1, 1000, 200), line(1, 500, 100, 50), line(2, 0, 80), line(null, 10, 10)]);
        expect(sums.get(1)).toEqual({ budget: 1500, spent: 300, committed: 50 });
        expect(sums.get(2)).toEqual({ budget: 0, spent: 80, committed: 0 });
        expect(sums.size).toBe(2);
    });

    it("gives utilisation only when there is a budget", () => {
        expect(utilisation(300, 1500)).toBe(20);
        expect(utilisation(80, 0)).toBeNull();
        expect(utilisationTone(null)).toBe("neutral");
        expect(utilisationTone(50)).toBe("ok");
        expect(utilisationTone(90)).toBe("warn");
        expect(utilisationTone(101)).toBe("danger");
    });
});
