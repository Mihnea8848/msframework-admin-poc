import { describe, expect, it } from "vitest";
import { badgeLabel, moreBadgeLabel } from "./badges";

describe("navigation badges", () => {
    it("says what each page's badge counts", () => {
        expect(badgeLabel("activity", "4")).toBe(", 4 unread");
        expect(badgeLabel("accessRequests", "2")).toBe(", 2 pending");
        expect(badgeLabel("activity", null)).toBe("");
    });

    it("sums up the badged pages behind More", () => {
        expect(moreBadgeLabel(["activity", "accessRequests", "docs"], { activity: "3", accessRequests: "1" }))
            .toBe(", unread activity, pending access requests");
        expect(moreBadgeLabel(["docs"], { activity: "3" })).toBe("");
        expect(moreBadgeLabel(["accessRequests"], { accessRequests: null })).toBe("");
    });
});
