/**
 * Money, date and period helpers for the business pages. Amounts are formatted with
 * Intl.NumberFormat in the currency the API sends; dates in the user's locale. Nothing here reads
 * the clock: callers pass `now`, so the functions are easy to test (money.test.ts).
 */

const moneyFormats = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: string, compact: boolean, locale?: string): Intl.NumberFormat {
    const key = `${locale ?? ""}|${currency}|${compact}`;
    let format = moneyFormats.get(key);
    if (!format) {
        try {
            format = new Intl.NumberFormat(locale, compact
                ? { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }
                : { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } catch {
            // An unknown currency code: fall back to a plain number followed by the code.
            const plain = new Intl.NumberFormat(locale, compact
                ? { notation: "compact", maximumFractionDigits: 1 }
                : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            format = { format: (n: number) => `${plain.format(n)} ${currency}` } as Intl.NumberFormat;
        }
        moneyFormats.set(key, format);
    }
    return format;
}

/** "€1,234.50" in the user's locale. Null or missing amounts show as an em dash. */
export function formatMoney(amount: number | null | undefined, currency: string, locale?: string): string {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
    return moneyFormat(currency || "EUR", false, locale).format(amount);
}

/** "€1.2M", "€48K": for chart axes, tiles and labels where space is short. */
export function formatMoneyCompact(amount: number | null | undefined, currency: string, locale?: string): string {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
    return moneyFormat(currency || "EUR", true, locale).format(amount);
}

/** "86%" or "86.4%" (one decimal at most). */
export function formatPercent(value: number | null | undefined, locale?: string): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
}

/** A plain number with at most two decimals, in the user's locale. */
export function formatNumber(value: number | null | undefined, locale?: string): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

// ---- Dates ------------------------------------------------------------------------------

/** Parses "2026-05-14" as a local date (new Date("2026-05-14") would be UTC midnight). */
export function parseIsoDate(iso: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(date.getTime()) ? null : date;
}

/** The local calendar date as "2026-05-14". */
export function toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** "14 May 2026" (or the locale's order). Accepts an ISO date or date-time. */
export function formatDate(iso: string | null | undefined, locale?: string): string {
    if (!iso) return "—";
    const date = parseIsoDate(iso) ?? new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

/** "2026-05" as "May 2026", or "May" with `short`. */
export function formatMonth(month: string, short = false, locale?: string): string {
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m) return month;
    const date = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    return date.toLocaleDateString(locale, short ? { month: "short" } : { month: "short", year: "numeric" });
}

// ---- Quarters and ranges ----------------------------------------------------------------

export interface Quarter {
    year: number;
    quarter: number;
}

export interface DateRange {
    from: string;
    to: string;
}

/** The calendar quarter that contains `date` (quarters follow the calendar year). */
export function quarterOf(date: Date): Quarter {
    return { year: date.getFullYear(), quarter: Math.floor(date.getMonth() / 3) + 1 };
}

/** First and last day of a quarter, as ISO dates. */
export function quarterRange({ year, quarter }: Quarter): DateRange {
    const startMonth = (quarter - 1) * 3;
    return {
        from: toIsoDate(new Date(year, startMonth, 1)),
        to: toIsoDate(new Date(year, startMonth + 3, 0)),
    };
}

/** "Q2 2026" */
export function quarterLabel({ year, quarter }: Quarter): string {
    return `Q${quarter} ${year}`;
}

/** The quarter `offset` quarters after (negative: before) the given one. */
export function shiftQuarter({ year, quarter }: Quarter, offset: number): Quarter {
    const index = year * 4 + (quarter - 1) + offset;
    return { year: Math.floor(index / 4), quarter: (index % 4) + 1 };
}

/** The quarters offered by the pickers: from `back` quarters ago up to the next one, newest first. */
export function quarterOptions(now: Date, back = 7): Quarter[] {
    const current = quarterOf(now);
    const list: Quarter[] = [];
    for (let i = 1; i >= -back; i -= 1) list.push(shiftQuarter(current, i));
    return list;
}

/** "2026-2" for a <select> value, and back. */
export const quarterKey = (q: Quarter) => `${q.year}-${q.quarter}`;

export function parseQuarterKey(key: string): Quarter | null {
    const m = /^(\d{4})-([1-4])$/.exec(key);
    return m ? { year: Number(m[1]), quarter: Number(m[2]) } : null;
}

export type RangePreset = "quarter" | "6m" | "ytd";

export const RANGE_PRESETS: readonly { key: RangePreset; label: string }[] = [
    { key: "quarter", label: "This quarter" },
    { key: "6m", label: "Last 6 months" },
    { key: "ytd", label: "Year to date" },
];

/**
 * The date range of a preset, ending today: this quarter (from its first day), the last six
 * months (from the first day of the month five months back) or year to date.
 */
export function presetRange(preset: RangePreset, now: Date): DateRange {
    const to = toIsoDate(now);
    switch (preset) {
        case "quarter":
            return { from: quarterRange(quarterOf(now)).from, to };
        case "6m":
            return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth() - 5, 1)), to };
        case "ytd":
        default:
            return { from: toIsoDate(new Date(now.getFullYear(), 0, 1)), to };
    }
}

/** The latest selectable date for a check-in in a quarter: its last day, or today if earlier. */
export function checkinDateBounds(q: Quarter, now: Date): { min: string; max: string; open: boolean } {
    const range = quarterRange(q);
    const today = toIsoDate(now);
    const max = today < range.to ? today : range.to;
    return { min: range.from, max, open: range.from <= today };
}
