/**
 * The Settings > Organisation form: its fields as text, validation that mirrors
 * OrgSettingsService on the backend (keep them in sync), and the request with only what changed.
 */
import type { OrgSettingsDto, OrgSettingsRequest } from "../../api/security";

/** OrgSettingsService.MIN_PASSWORD_LENGTH and MAX_PASSWORD_LENGTH. */
export const PASSWORD_MIN_LENGTH_FLOOR = 8;
export const PASSWORD_MIN_LENGTH_CEILING = 64;
export const COMPANY_NAME_MAX = 100;

export interface OrgForm {
    companyName: string;
    registrationEnabled: boolean;
    /** Kept as typed, so a half-typed number is not reformatted under the cursor. */
    passwordMinLength: string;
    /** An IANA zone id, or "" while none was chosen. */
    defaultTimezone: string;
}

export type OrgFormErrors = Partial<Record<keyof OrgForm, string>>;

export function toOrgForm(dto: OrgSettingsDto): OrgForm {
    return {
        companyName: dto.companyName ?? "",
        registrationEnabled: Boolean(dto.registrationEnabled),
        passwordMinLength: String(dto.passwordMinLength ?? PASSWORD_MIN_LENGTH_FLOOR),
        defaultTimezone: dto.defaultTimezone ?? "",
    };
}

/** Trimmed, with runs of whitespace collapsed, as the backend stores it. */
export function normalizeCompanyName(name: string): string {
    return name.trim().replace(/\s+/g, " ");
}

/** True when the runtime knows the zone (the backend checks it again with java.time.ZoneId). */
export function isValidTimeZone(zone: string): boolean {
    if (!zone.trim()) return false;
    try {
        new Intl.DateTimeFormat("en", { timeZone: zone.trim() });
        return true;
    } catch {
        return false;
    }
}

export function validateOrgForm(form: OrgForm, isZone: (zone: string) => boolean = isValidTimeZone): OrgFormErrors {
    const errors: OrgFormErrors = {};
    const name = normalizeCompanyName(form.companyName);
    if (!name) errors.companyName = "Company name is required.";
    else if (name.length > COMPANY_NAME_MAX) errors.companyName = `At most ${COMPANY_NAME_MAX} characters.`;

    const raw = form.passwordMinLength.trim();
    const length = Number(raw);
    if (!/^\d+$/.test(raw) || length < PASSWORD_MIN_LENGTH_FLOOR || length > PASSWORD_MIN_LENGTH_CEILING) {
        errors.passwordMinLength = `A whole number from ${PASSWORD_MIN_LENGTH_FLOOR} to ${PASSWORD_MIN_LENGTH_CEILING}.`;
    }

    if (form.defaultTimezone.trim() && !isZone(form.defaultTimezone.trim())) {
        errors.defaultTimezone = "Pick a timezone from the list.";
    }
    return errors;
}

/** Only the fields that differ from the saved settings; an empty object means nothing to save. */
export function orgChanges(saved: OrgSettingsDto, form: OrgForm): OrgSettingsRequest {
    const changes: OrgSettingsRequest = {};
    const name = normalizeCompanyName(form.companyName);
    if (name !== saved.companyName) changes.companyName = name;
    if (form.registrationEnabled !== saved.registrationEnabled) changes.registrationEnabled = form.registrationEnabled;
    const length = Number(form.passwordMinLength.trim());
    if (length !== saved.passwordMinLength) changes.passwordMinLength = length;
    // The backend has no way to clear the timezone, so an emptied field just keeps the saved one.
    const zone = form.defaultTimezone.trim();
    if (zone && zone !== (saved.defaultTimezone ?? "")) changes.defaultTimezone = zone;
    return changes;
}

/** "30 minutes", "1 hour", "1 hour 30 minutes", "8 hours". */
export function formatTimeout(minutes: number): string {
    const m = Math.max(0, Math.round(minutes));
    const hours = Math.floor(m / 60);
    const rest = m % 60;
    const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
    if (hours === 0) return part(rest, "minute");
    return rest === 0 ? part(hours, "hour") : `${part(hours, "hour")} ${part(rest, "minute")}`;
}

/** Every IANA zone the browser knows, UTC first; a short list where Intl cannot list them. */
export function timeZoneIds(): string[] {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
    const zones = intl.supportedValuesOf?.("timeZone") ?? [
        "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Bucharest", "Europe/Istanbul", "Asia/Dubai",
        "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "America/New_York", "America/Chicago",
        "America/Denver", "America/Los_Angeles", "America/Sao_Paulo",
    ];
    return ["UTC", ...zones.filter((z) => z !== "UTC")];
}

/** Zones matching what was typed: "new york", "bucharest", "europe/" all work. */
export function matchTimeZones(zones: readonly string[], query: string, limit = 50): string[] {
    const q = query.trim().toLowerCase().replace(/[\s_]+/g, " ");
    if (!q) return zones.slice(0, limit);
    const readable = (z: string) => z.toLowerCase().replace(/_/g, " ");
    const starts: string[] = [];
    const contains: string[] = [];
    for (const zone of zones) {
        const text = readable(zone);
        const city = text.slice(text.lastIndexOf("/") + 1);
        if (city.startsWith(q) || text.startsWith(q)) starts.push(zone);
        else if (text.includes(q)) contains.push(zone);
    }
    return [...starts, ...contains].slice(0, limit);
}
