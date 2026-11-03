import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatBytes, formatDateTime, initialsOf, relTime } from "./format";

const NOW = new Date("2026-06-15T12:00:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function ago(ms: number): string {
    return new Date(NOW.getTime() - ms).toISOString();
}

describe("relTime", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns an empty string for missing or invalid dates", () => {
        expect(relTime(null)).toBe("");
        expect(relTime(undefined)).toBe("");
        expect(relTime("")).toBe("");
        expect(relTime("not a date")).toBe("");
    });

    it("says just now under one minute, including future times", () => {
        expect(relTime(ago(0))).toBe("just now");
        expect(relTime(ago(MINUTE - 1))).toBe("just now");
        expect(relTime(ago(-5 * MINUTE))).toBe("just now");
    });

    it("counts minutes from 1 to 59", () => {
        expect(relTime(ago(MINUTE))).toBe("1m ago");
        expect(relTime(ago(HOUR - 1))).toBe("59m ago");
    });

    it("counts hours from 1 to 23", () => {
        expect(relTime(ago(HOUR))).toBe("1h ago");
        expect(relTime(ago(DAY - 1))).toBe("23h ago");
    });

    it("counts days from 1 to 29", () => {
        expect(relTime(ago(DAY))).toBe("1d ago");
        expect(relTime(ago(30 * DAY - 1))).toBe("29d ago");
    });

    it("shows the date from 30 days on", () => {
        const date = ago(30 * DAY);
        expect(relTime(date)).toBe(new Date(date).toLocaleDateString());
    });

    it("accepts Date objects and timestamps", () => {
        expect(relTime(new Date(NOW.getTime() - 2 * HOUR))).toBe("2h ago");
        expect(relTime(NOW.getTime() - 3 * MINUTE)).toBe("3m ago");
    });
});

describe("formatBytes", () => {
    it("shows a dash when the size is unknown", () => {
        expect(formatBytes(null)).toBe("—");
        expect(formatBytes(undefined)).toBe("—");
    });

    it("uses bytes below 1 KB", () => {
        expect(formatBytes(0)).toBe("0 B");
        expect(formatBytes(1023)).toBe("1023 B");
    });

    it("uses KB from 1024 bytes and MB from 1024 KB", () => {
        expect(formatBytes(1024)).toBe("1.0 KB");
        expect(formatBytes(1536)).toBe("1.5 KB");
        expect(formatBytes(1024 * 1024 - 1)).toBe("1024.0 KB");
        expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
        expect(formatBytes(5.25 * 1024 * 1024)).toBe("5.3 MB");
    });
});

describe("formatDateTime", () => {
    it("shows a dash for missing or invalid dates", () => {
        expect(formatDateTime(null)).toBe("—");
        expect(formatDateTime("nope")).toBe("—");
    });

    it("formats a valid date in the local format", () => {
        const iso = "2026-01-02T03:04:05Z";
        expect(formatDateTime(iso)).toBe(new Date(iso).toLocaleString());
    });
});

describe("initialsOf", () => {
    it("takes the first letter of the first two words", () => {
        expect(initialsOf("ștefan ionescu popescu")).toBe("ȘI");
        expect(initialsOf("  Ana  ")).toBe("A");
    });

    it("falls back when the name is empty", () => {
        expect(initialsOf("")).toBe("?");
        expect(initialsOf(null, "x")).toBe("X");
    });
});
