import { describe, expect, it } from "vitest";
import {
    checkinDateBounds, formatDate, formatMoney, formatMoneyCompact, formatMonth, formatPercent, parseIsoDate, parseQuarterKey,
    presetRange, quarterKey, quarterLabel, quarterOf, quarterOptions, quarterRange, shiftQuarter, toIsoDate,
} from "./money";

describe("money formatting", () => {
    it("formats in the currency the API sends, with two decimals", () => {
        expect(formatMoney(1234.5, "EUR", "en-GB")).toBe("€1,234.50");
        expect(formatMoney(1234.5, "USD", "en-US")).toBe("$1,234.50");
        expect(formatMoney(-20, "EUR", "en-GB")).toBe("-€20.00");
    });

    it("follows the locale", () => {
        expect(formatMoney(1234.5, "EUR", "de-DE").replace(/\s/g, " ")).toBe("1.234,50 €");
    });

    it("shows an em dash for missing amounts", () => {
        expect(formatMoney(null, "EUR")).toBe("—");
        expect(formatMoney(undefined, "EUR")).toBe("—");
    });

    it("falls back to the code for an unknown currency", () => {
        expect(formatMoney(12, "ZZZ1", "en-GB")).toBe("12.00 ZZZ1");
    });

    it("compacts large amounts", () => {
        expect(formatMoneyCompact(1_465_000, "EUR", "en-US")).toBe("€1.5M");
        expect(formatMoneyCompact(48_200, "EUR", "en-US")).toBe("€48.2K");
    });

    it("formats percentages with one decimal at most", () => {
        expect(formatPercent(85.14, "en-GB")).toBe("85.1%");
        expect(formatPercent(90, "en-GB")).toBe("90%");
        expect(formatPercent(null)).toBe("—");
    });
});

describe("dates", () => {
    it("parses an ISO date as a local date, not UTC midnight", () => {
        const d = parseIsoDate("2026-05-14");
        expect(d?.getFullYear()).toBe(2026);
        expect(d?.getMonth()).toBe(4);
        expect(d?.getDate()).toBe(14);
        expect(parseIsoDate("14/05/2026")).toBeNull();
        expect(toIsoDate(new Date(2026, 0, 3))).toBe("2026-01-03");
    });

    it("formats dates and months in the user's locale", () => {
        expect(formatDate("2026-05-14", "en-GB")).toBe("14 May 2026");
        expect(formatDate("2026-05-14", "en-US")).toBe("May 14, 2026");
        expect(formatDate(null)).toBe("—");
        expect(formatMonth("2026-05", false, "en-GB")).toBe("May 2026");
        expect(formatMonth("2026-05", true, "en-GB")).toBe("May");
    });
});

describe("quarters and ranges", () => {
    const now = new Date(2026, 10, 4); // 4 November 2026

    it("finds the quarter of a date and its first and last day", () => {
        expect(quarterOf(now)).toEqual({ year: 2026, quarter: 4 });
        expect(quarterRange({ year: 2026, quarter: 1 })).toEqual({ from: "2026-01-01", to: "2026-03-31" });
        expect(quarterRange({ year: 2024, quarter: 1 }).to).toBe("2024-03-31");
        expect(quarterRange({ year: 2026, quarter: 4 })).toEqual({ from: "2026-10-01", to: "2026-12-31" });
        expect(quarterLabel({ year: 2026, quarter: 2 })).toBe("Q2 2026");
    });

    it("moves between quarters across years", () => {
        expect(shiftQuarter({ year: 2026, quarter: 1 }, -1)).toEqual({ year: 2025, quarter: 4 });
        expect(shiftQuarter({ year: 2026, quarter: 4 }, 1)).toEqual({ year: 2027, quarter: 1 });
    });

    it("offers the next quarter and the previous ones, newest first", () => {
        const options = quarterOptions(now, 2);
        expect(options.map(quarterLabel)).toEqual(["Q1 2027", "Q4 2026", "Q3 2026", "Q2 2026"]);
        expect(parseQuarterKey(quarterKey({ year: 2026, quarter: 3 }))).toEqual({ year: 2026, quarter: 3 });
        expect(parseQuarterKey("2026-5")).toBeNull();
    });

    it("computes the range presets, ending today", () => {
        expect(presetRange("quarter", now)).toEqual({ from: "2026-10-01", to: "2026-11-04" });
        expect(presetRange("6m", now)).toEqual({ from: "2026-06-01", to: "2026-11-04" });
        expect(presetRange("ytd", now)).toEqual({ from: "2026-01-01", to: "2026-11-04" });
    });

    it("limits check-in dates to the quarter and today", () => {
        expect(checkinDateBounds({ year: 2026, quarter: 4 }, now)).toEqual({ min: "2026-10-01", max: "2026-11-04", open: true });
        expect(checkinDateBounds({ year: 2026, quarter: 3 }, now)).toEqual({ min: "2026-07-01", max: "2026-09-30", open: true });
        expect(checkinDateBounds({ year: 2027, quarter: 1 }, now).open).toBe(false);
    });
});
