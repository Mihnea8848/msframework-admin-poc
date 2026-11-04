/**
 * The unread badge on Activity. It lives in the shell (the entry bundle), so it stays free of
 * the audit type table and its icons.
 */
import type { AuditEventDto } from "../api/types";

type Me = { email?: string | null } | null | undefined;

/**
 * Events that warn about your account even though the backend logs you as the actor: a failed
 * or blocked sign-in, a rate limit, a lock.
 */
export const ACCOUNT_WARNING_TYPES: ReadonlySet<string> = new Set([
    "login_failed", "login_blocked", "rate_limited", "account_locked",
]);

/** The event was done by this user (the backend logs the actor by email). */
export function isOwnAction(event: Pick<AuditEventDto, "actorEmail">, user: Me): boolean {
    const mine = user?.email?.toLowerCase();
    return Boolean(mine && event.actorEmail?.toLowerCase() === mine);
}

/**
 * Whether an event in your own feed deserves the badge: something someone else did to your
 * account, or a warning about it. Your own sign-ins and edits never count, or every sign-in
 * would light the badge.
 */
export function isNotable(event: Pick<AuditEventDto, "actorEmail" | "eventType">, user: Me): boolean {
    return !isOwnAction(event, user) || ACCOUNT_WARNING_TYPES.has(event.eventType);
}

/** Unread notable events: newer than the last one seen. */
export function unreadCount(events: readonly AuditEventDto[], lastSeenId: number, user: Me): number {
    return events.filter((ev) => ev.id > lastSeenId && isNotable(ev, user)).length;
}
