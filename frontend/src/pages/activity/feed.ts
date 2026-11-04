/**
 * The pure logic behind Activity (your own events, any signed-in user) and the Audit log (every
 * event, AUDIT_READ): who may read which feed and the Audit log filters. The unread badge rule
 * is in utils/activityBadge.ts, which the shell imports.
 */
import type { AuditEventDto } from "../../api/types";
import { hasPermission } from "../../auth/permissions";
import type { UserLike } from "../../auth/permissions";
import { auditMeta } from "../../utils/auditTypes";
import type { AuditCategory } from "../../utils/auditTypes";

type Me = (UserLike & { email?: string | null; id?: number | null }) | null | undefined;

/** The full Audit log needs AUDIT_READ. */
export function canReadAuditLog(user: Me): boolean {
    return hasPermission(user, "AUDIT_READ");
}

/** Activity is personal (GET /api/audit/me), so every signed-in user may read it. */
export function canReadActivity(user: Me): boolean {
    return Boolean(user);
}

export type CategoryFilter = "All" | Exclude<AuditCategory, "Other">;

export interface AuditFilters {
    category: CategoryFilter;
    /** Matches the actor's email, case-insensitive; blank matches everyone. */
    actor: string;
    /** "YYYY-MM-DD" (local day, inclusive), or "" for open-ended. */
    from: string;
    to: string;
}

export const NO_FILTERS: AuditFilters = { category: "All", actor: "", from: "", to: "" };

/** Local midnight of a "YYYY-MM-DD" day, or null when it is blank or invalid. */
function dayStart(day: string): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (!match) return null;
    const time = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
    return Number.isNaN(time) ? null : time;
}

export function filterAuditEvents(events: readonly AuditEventDto[], filters: AuditFilters): AuditEventDto[] {
    const actor = filters.actor.trim().toLowerCase();
    const from = dayStart(filters.from);
    const toStart = dayStart(filters.to);
    // The end day is inclusive: anything before the next local midnight.
    const until = toStart === null ? null : new Date(toStart).setDate(new Date(toStart).getDate() + 1);
    return events.filter((ev) => {
        if (filters.category !== "All" && auditMeta(ev.eventType).category !== filters.category) return false;
        if (actor && !(ev.actorEmail ?? "").toLowerCase().includes(actor)) return false;
        if (from !== null || until !== null) {
            const at = new Date(ev.createdAt).getTime();
            if (Number.isNaN(at)) return false;
            if (from !== null && at < from) return false;
            if (until !== null && at >= until) return false;
        }
        return true;
    });
}

/** True when the date range is backwards (the end before the start). */
export function isRangeInverted(filters: Pick<AuditFilters, "from" | "to">): boolean {
    const from = dayStart(filters.from);
    const to = dayStart(filters.to);
    return from !== null && to !== null && to < from;
}

export function hasActiveFilters(filters: AuditFilters): boolean {
    return filters.category !== "All" || filters.actor.trim() !== "" || filters.from !== "" || filters.to !== "";
}

/** Adds newer events from a refresh to the top of a loaded list, without duplicates. */
export function mergeNewer(current: readonly AuditEventDto[], fresh: readonly AuditEventDto[]): AuditEventDto[] {
    const known = new Set(current.map((ev) => ev.id));
    const added = fresh.filter((ev) => !known.has(ev.id));
    return [...added, ...current];
}
