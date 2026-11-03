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
