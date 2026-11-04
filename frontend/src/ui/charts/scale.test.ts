import { describe, expect, it } from "vitest";
import {
    budgetSegments, clamp, columnPath, labelStride, linePath, linearScale, maxOf, niceStep, niceTicks, percentOf, ringArc, sparkPoints,
} from "./scale";

describe("linearScale and clamp", () => {
    it("maps the domain onto the range, also inverted (SVG y grows downwards)", () => {
        const y = linearScale(0, 100, 200, 0);
        expect(y(0)).toBe(200);
        expect(y(50)).toBe(100);
        expect(y(100)).toBe(0);
    });

    it("maps a zero-width domain to the start of the range", () => {
        expect(linearScale(5, 5, 10, 20)(5)).toBe(10);
    });

    it("clamps", () => {
        expect(clamp(-1, 0, 10)).toBe(0);
        expect(clamp(11, 0, 10)).toBe(10);
        expect(clamp(4, 0, 10)).toBe(4);
    });
});

describe("percentOf and maxOf", () => {
    it("is 0 for an empty or negative total", () => {
        expect(percentOf(5, 0)).toBe(0);
        expect(percentOf(5, -3)).toBe(0);
        expect(percentOf(25, 200)).toBe(12.5);
    });

    it("ignores nulls and is 0 for nothing", () => {
        expect(maxOf([3, null, 9, undefined, 4])).toBe(9);
        expect(maxOf([])).toBe(0);
    });
});

describe("niceStep and niceTicks", () => {
    it("rounds a step up to 1, 2, 2.5 or 5 times a power of ten", () => {
        expect(niceStep(0.7)).toBe(1);
        expect(niceStep(1.3)).toBe(2);
        expect(niceStep(2.2)).toBe(2.5);
        expect(niceStep(3)).toBe(5);
        expect(niceStep(7)).toBe(10);
        expect(niceStep(73_000)).toBe(100_000);
    });

    it("starts at 0 and covers the maximum with clean steps", () => {
        expect(niceTicks(316_420)).toEqual([0, 100_000, 200_000, 300_000, 400_000]);
        expect(niceTicks(100, 4)).toEqual([0, 25, 50, 75, 100]);
        expect(niceTicks(9)).toEqual([0, 2.5, 5, 7.5, 10]);
    });

    it("still draws one step when there is nothing to show", () => {
        expect(niceTicks(0)).toEqual([0, 1]);
        expect(niceTicks(Number.NaN)).toEqual([0, 1]);
    });
});

describe("sparkPoints and linePath", () => {
    it("spreads the points over the width and puts the largest value at the top", () => {
        const pts = sparkPoints([0, 5, 10], 100, 20, { pad: 0 });
        expect(pts).toEqual([{ x: 0, y: 20 }, { x: 50, y: 10 }, { x: 100, y: 0 }]);
        expect(linePath(pts)).toBe("M0 20L50 10L100 0");
    });

    it("leaves a gap for null values", () => {
        const pts = sparkPoints([1, null, 3], 20, 10, { pad: 0 });
        expect(pts[1]).toBeNull();
        expect(linePath(pts)).toBe("M0 10M20 0");
    });

    it("uses a fixed domain and clamps values outside it", () => {
        const pts = sparkPoints([150], 10, 10, { pad: 0, min: 0, max: 120 });
        expect(pts[0]?.y).toBe(0);
    });

    it("centres a flat line", () => {
        const pts = sparkPoints([4, 4], 10, 10, { pad: 0 });
        expect(pts.map((p) => p?.y)).toEqual([5, 5]);
    });

    it("returns nulls when there is no data", () => {
        expect(sparkPoints([null, null], 10, 10)).toEqual([null, null]);
    });
});

describe("ringArc", () => {
    it("is empty at 0 and a full circle at 100 or more", () => {
        expect(ringArc(0, 10, 10, 8)).toBe("");
        expect(ringArc(120, 10, 10, 8)).toBe("M10 2A8 8 0 1 1 10 18A8 8 0 1 1 10 2");
    });

    it("draws a quarter turn to 3 o'clock and uses the large arc past half", () => {
        expect(ringArc(25, 10, 10, 8)).toBe("M10 2A8 8 0 0 1 18 10");
        expect(ringArc(75, 10, 10, 8)).toBe("M10 2A8 8 0 1 1 2 10");
    });
});

describe("columnPath and labelStride", () => {
    it("rounds only the top corners, never more than half the width", () => {
        expect(columnPath(0, 10, 20, 30, 4)).toBe("M0 40V14Q0 10 4 10H16Q20 10 20 14V40Z");
        expect(columnPath(0, 0, 4, 30, 4)).toContain("Q0 0 2 0");
    });

    it("is empty without height", () => {
        expect(columnPath(0, 0, 10, 0)).toBe("");
    });

    it("skips labels that would collide", () => {
        expect(labelStride(80)).toBe(1);
        expect(labelStride(30)).toBe(2);
        expect(labelStride(12)).toBe(4);
    });
});

describe("budgetSegments", () => {
    it("shows spent and committed as shares of the budget", () => {
        expect(budgetSegments(1000, 250, 250)).toEqual({ spent: 25, committed: 25, budgetMark: 100, over: false, used: 50 });
    });

    it("grows the track past the budget when it is overspent", () => {
        const seg = budgetSegments(100, 150, 50);
        expect(seg.over).toBe(true);
        expect(seg.spent).toBe(75);
        expect(seg.committed).toBe(25);
        expect(seg.budgetMark).toBe(50);
        expect(seg.used).toBe(200);
    });

    it("handles spending without a budget", () => {
        const seg = budgetSegments(0, 40, 0);
        expect(seg).toEqual({ spent: 100, committed: 0, budgetMark: 0, over: true, used: 0 });
    });
});
