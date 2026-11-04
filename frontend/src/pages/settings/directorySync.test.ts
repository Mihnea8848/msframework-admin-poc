import { describe, expect, it } from "vitest";
import type { DirectoryChange, DirectorySyncCounts } from "../../api/directory";
import { describeField, groupChanges, pendingCount, skipReasons, summarize } from "./directorySync";

function change(overrides: Partial<DirectoryChange>): DirectoryChange {
    return {
        action: "create",
        externalId: "1",
        username: "someone",
        name: "Someone",
        email: "someone@example.com",
        userId: null,
        role: "MEMBER",
        department: null,
        fields: [],
        reason: null,
        notes: [],
        applied: null,
        ...overrides,
    };
}

const ZERO: DirectorySyncCounts = { created: 0, updated: 0, linked: 0, deactivated: 0, skipped: 0, unchanged: 0 };

describe("groupChanges", () => {
    it("orders the groups by action and leaves out empty ones", () => {
        const groups = groupChanges([
            change({ action: "skip", name: "Zed", reason: "Not in a staff group" }),
            change({ action: "deactivate", name: "Dee" }),
            change({ action: "create", name: "Cee" }),
            change({ action: "unchanged", name: "Uma" }),
        ]);
        expect(groups.map((g) => g.action)).toEqual(["create", "deactivate", "skip", "unchanged"]);
    });

    it("sorts people by name within a group, falling back to the user name", () => {
        const [group] = groupChanges([
            change({ name: "bravo" }),
            change({ name: null, username: "alpha" }),
            change({ name: "Charlie" }),
        ]);
        expect(group?.items.map((c) => c.name ?? c.username)).toEqual(["alpha", "bravo", "Charlie"]);
    });

    it("opens the groups that change something and collapses skipped and unchanged", () => {
        const groups = groupChanges([
            change({ action: "update" }),
            change({ action: "link" }),
            change({ action: "skip" }),
            change({ action: "unchanged" }),
        ]);
        expect(Object.fromEntries(groups.map((g) => [g.action, g.open]))).toEqual({
            link: true, update: true, skip: false, unchanged: false,
        });
        expect(groups.find((g) => g.action === "update")?.title).toBe("Updated");
    });

    it("returns nothing for no changes", () => {
        expect(groupChanges([])).toEqual([]);
    });
});

describe("skipReasons", () => {
    it("counts each reason, most common first", () => {
        expect(skipReasons([
            change({ action: "skip", reason: "Service account" }),
            change({ action: "skip", reason: "Not in a staff group" }),
            change({ action: "skip", reason: "Not in a staff group" }),
            change({ action: "deactivate", reason: "Not in a staff group" }),
        ])).toEqual([
            { reason: "Not in a staff group", count: 2 },
            { reason: "Service account", count: 1 },
        ]);
    });
});

describe("describeField", () => {
    it("labels the field and shows none for empty values", () => {
        expect(describeField({ field: "role", from: "MEMBER", to: "MANAGER" })).toBe("Role: MEMBER → MANAGER");
        expect(describeField({ field: "manages", from: null, to: "Development" })).toBe("Manages: none → Development");
    });
});

describe("summarize and pendingCount", () => {
    it("lists only non-zero counts", () => {
        const counts = { ...ZERO, created: 2, skipped: 6, unchanged: 1 };
        expect(summarize(counts)).toBe("2 new, 6 skipped, 1 unchanged");
        expect(pendingCount(counts)).toBe(2);
    });

    it("says when there is nothing to do", () => {
        expect(summarize(ZERO)).toBe("No changes");
        expect(pendingCount({ ...ZERO, skipped: 3 })).toBe(0);
    });
});
