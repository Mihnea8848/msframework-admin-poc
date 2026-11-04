import type { PageKey } from "../routes/navigation";

/** The count badges on navigation items ("3", "50+"), by page. A missing or null entry shows none. */
export type PageBadges = Partial<Record<PageKey, string | null>>;

/** What a page's badge counts, for screen readers: ", 3 unread". */
const BADGE_NOUN: Partial<Record<PageKey, string>> = {
    activity: "unread",
    accessRequests: "pending",
};

/** What the More button says when a page in the sheet has a badge: ", unread activity". */
const BADGE_SUMMARY: Partial<Record<PageKey, string>> = {
    activity: "unread activity",
    accessRequests: "pending access requests",
};

/** The visually hidden text after a badged item's label: ", 3 unread". Empty without a badge. */
export function badgeLabel(key: PageKey, badge: string | null | undefined): string {
    if (!badge) return "";
    return `, ${badge} ${BADGE_NOUN[key] ?? "new"}`;
}

/** The hidden text for More: one phrase per badged page in the sheet, or "" when none has one. */
export function moreBadgeLabel(keys: readonly PageKey[], badges: PageBadges): string {
    const parts = keys.filter((k) => badges[k]).map((k) => BADGE_SUMMARY[k] ?? "new items");
    return parts.length ? `, ${parts.join(", ")}` : "";
}
