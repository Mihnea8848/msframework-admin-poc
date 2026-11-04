import { describe, expect, it } from "vitest";
import { monthLabel, sparkGeometry, trendSummary } from "./figures";

const trend = (scores: (number | null)[]) => scores.map((score, i) => ({ month: `2026-0${i + 1}`, score }));

describe("sparkGeometry", () => {
    it("draws nothing without data", () => {
        expect(sparkGeometry(trend([null, null]), 88, 28)).toEqual({ points: [], segments: [] });
    });

    it("spaces the months evenly and puts higher scores higher", () => {
        const { points, segments } = sparkGeometry(trend([40, 60, 80]), 88, 28);
        expect(points.map((p) => p.x)).toEqual([3, 44, 85]);
        expect(points[0]!.y).toBeGreaterThan(points[2]!.y);
        expect(points[2]!.y).toBe(3);
        expect(segments).toHaveLength(1);
    });

    it("leaves a gap for a month without data", () => {
        const { points, segments } = sparkGeometry(trend([50, 55, null, 70, 72]), 100, 28);
        expect(points).toHaveLength(4);
        expect(segments).toHaveLength(2);
    });

    it("does not exaggerate a nearly flat trend", () => {
        const { points } = sparkGeometry(trend([70, 71]), 88, 28);
        const spread = Math.abs(points[0]!.y - points[1]!.y);
        expect(spread).toBeLessThan(3);
    });
});

describe("trend text", () => {
    it("labels months and says when one has no data", () => {
        expect(monthLabel("not a month")).toBe("not a month");
        const summary = trendSummary(trend([61.4, null]));
        expect(summary).toContain("61%");
        expect(summary).toContain("no data");
    });
});
