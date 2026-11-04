type DateInput = string | number | Date | null | undefined;

export function initialsOf(name: string | null | undefined, fallback: unknown = "?"): string {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return String(fallback).toUpperCase();
    return parts.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** "just now", "4m ago", "3h ago", "2d ago", then the date. `now` defaults to the current time. */
export function relTime(dateStr: DateInput, now: number = Date.now()): string {
    if (!dateStr) return "";
    const time = new Date(dateStr).getTime();
    if (Number.isNaN(time)) return "";
    const diff = now - time;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

export function formatDateTime(dateStr: DateInput): string {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function formatBytes(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * "just now", "5 minutes ago", "1 hour ago", "2 days ago", "3 weeks ago", "4 months ago",
 * "2 years ago". Empty for a missing or invalid date. `now` defaults to the current time.
 */
export function timeAgo(dateStr: DateInput, now: number = Date.now()): string {
    if (!dateStr) return "";
    const time = new Date(dateStr).getTime();
    if (Number.isNaN(time)) return "";
    const seconds = Math.max(0, Math.floor((now - time) / 1000));
    const units: [number, string][] = [
        [365 * 24 * 3600, "year"],
        [30 * 24 * 3600, "month"],
        [7 * 24 * 3600, "week"],
        [24 * 3600, "day"],
        [3600, "hour"],
        [60, "minute"],
    ];
    for (const [size, name] of units) {
        const n = Math.floor(seconds / size);
        if (n >= 1) return `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
    return "just now";
}

/** A money amount in the organisation's currency, without decimals ("€12,400"). */
export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "—";
    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: currency || "EUR",
            maximumFractionDigits: 0,
        }).format(Number(amount));
    } catch {
        return `${Math.round(Number(amount)).toLocaleString()} ${currency ?? ""}`.trim();
    }
}
