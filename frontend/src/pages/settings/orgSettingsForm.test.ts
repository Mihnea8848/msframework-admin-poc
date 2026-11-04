import { describe, expect, it } from "vitest";
import type { OrgSettingsDto } from "../../api/security";
import {
    formatTimeout, isValidTimeZone, matchTimeZones, normalizeCompanyName, orgChanges, timeZoneIds, toOrgForm,
    validateOrgForm,
} from "./orgSettingsForm";

const saved: OrgSettingsDto = {
    companyName: "Multimedia Entertainment Hub",
    registrationEnabled: true,
    passwordMinLength: 8,
    sessionTimeoutMinutes: 30,
    defaultTimezone: "Europe/Bucharest",
};

describe("validateOrgForm", () => {
    it("accepts the saved settings", () => {
        expect(validateOrgForm(toOrgForm(saved))).toEqual({});
    });

    it("requires a company name of at most 100 characters", () => {
        expect(validateOrgForm({ ...toOrgForm(saved), companyName: "   " }).companyName).toBe("Company name is required.");
        expect(validateOrgForm({ ...toOrgForm(saved), companyName: "x".repeat(101) }).companyName).toBe("At most 100 characters.");
        expect(validateOrgForm({ ...toOrgForm(saved), companyName: ` ${"x".repeat(100)} ` }).companyName).toBeUndefined();
    });

    it.each(["7", "65", "", "8.5", "ten", "-8"])("rejects %j as the minimum password length", (value) => {
        expect(validateOrgForm({ ...toOrgForm(saved), passwordMinLength: value }).passwordMinLength)
            .toBe("A whole number from 8 to 64.");
    });

    it.each(["8", "12", " 64 "])("accepts %j as the minimum password length", (value) => {
        expect(validateOrgForm({ ...toOrgForm(saved), passwordMinLength: value }).passwordMinLength).toBeUndefined();
    });

    it("checks the timezone, but allows leaving it unset", () => {
        expect(validateOrgForm({ ...toOrgForm(saved), defaultTimezone: "Mars/Olympus" }).defaultTimezone).toBe("Pick a timezone from the list.");
        expect(validateOrgForm({ ...toOrgForm(saved), defaultTimezone: "" }).defaultTimezone).toBeUndefined();
        expect(validateOrgForm({ ...toOrgForm(saved), defaultTimezone: "Anything" }, () => true).defaultTimezone).toBeUndefined();
    });
});

describe("orgChanges", () => {
    it("is empty when nothing changed, even with extra spaces in the name", () => {
        expect(orgChanges(saved, { ...toOrgForm(saved), companyName: "  Multimedia   Entertainment Hub " })).toEqual({});
    });

    it("sends only the changed fields, typed", () => {
        const form = { ...toOrgForm(saved), registrationEnabled: false, passwordMinLength: "12", defaultTimezone: "Asia/Tokyo" };
        expect(orgChanges(saved, form)).toEqual({ registrationEnabled: false, passwordMinLength: 12, defaultTimezone: "Asia/Tokyo" });
    });

    it("never sends an empty timezone (the backend cannot clear it)", () => {
        expect(orgChanges(saved, { ...toOrgForm(saved), defaultTimezone: "" })).toEqual({});
        expect(orgChanges({ ...saved, defaultTimezone: null }, { ...toOrgForm(saved), defaultTimezone: "UTC" })).toEqual({ defaultTimezone: "UTC" });
    });
});

describe("helpers", () => {
    it("normalises the company name like the backend", () => {
        expect(normalizeCompanyName("  MEH \t Studios  ")).toBe("MEH Studios");
    });

    it("formats the session timeout", () => {
        expect(formatTimeout(30)).toBe("30 minutes");
        expect(formatTimeout(1)).toBe("1 minute");
        expect(formatTimeout(60)).toBe("1 hour");
        expect(formatTimeout(90)).toBe("1 hour 30 minutes");
        expect(formatTimeout(480)).toBe("8 hours");
    });

    it("knows real zones", () => {
        expect(isValidTimeZone("Europe/Bucharest")).toBe(true);
        expect(isValidTimeZone("UTC")).toBe(true);
        expect(isValidTimeZone("Nowhere/Land")).toBe(false);
        expect(isValidTimeZone(" ")).toBe(false);
    });

    it("lists zones with UTC first, once", () => {
        const zones = timeZoneIds();
        expect(zones[0]).toBe("UTC");
        expect(zones.filter((z) => z === "UTC")).toHaveLength(1);
        expect(zones).toContain("Europe/Bucharest");
    });

    it("matches zones by city first, then anywhere", () => {
        const zones = ["UTC", "America/New_York", "Europe/Bucharest", "Europe/Berlin", "Asia/Tokyo", "America/Argentina/Buenos_Aires"];
        expect(matchTimeZones(zones, "new york")).toEqual(["America/New_York"]);
        expect(matchTimeZones(zones, "BUC")).toEqual(["Europe/Bucharest"]);
        expect(matchTimeZones(zones, "europe/")).toEqual(["Europe/Bucharest", "Europe/Berlin"]);
        expect(matchTimeZones(zones, "aires")).toEqual(["America/Argentina/Buenos_Aires"]);
        expect(matchTimeZones(zones, "", 2)).toEqual(["UTC", "America/New_York"]);
    });
});
