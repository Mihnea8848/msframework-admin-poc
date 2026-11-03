import { readStorage, writeStorage } from "./storage";

/** Tracks the newest audit event a user has seen, so the sidebar can show an "unread" badge. */
const EVENT = "msf:audit-seen";

type SeenUser = { id?: number | null } | null | undefined;

function key(user: SeenUser): string {
    return `auditSeen:${user?.id ?? "anon"}`;
}

export function getLastSeenAuditId(user: SeenUser): number {
    return Number(readStorage(key(user), "0")) || 0;
}

export function markAuditSeen(user: SeenUser, newestId: number | null | undefined): void {
    if (!newestId || newestId <= getLastSeenAuditId(user)) return;
    writeStorage(key(user), String(newestId));
    window.dispatchEvent(new Event(EVENT));
}

/** Subscribes to "seen" changes; returns the unsubscribe function. */
export function onAuditSeen(listener: () => void): () => void {
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
}
