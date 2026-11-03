import { readStorage, writeStorage } from "./storage.js";

/** Tracks the newest audit event a user has seen, so the sidebar can show an "unread" badge. */
const EVENT = "msf:audit-seen";

function key(user) {
    return `auditSeen:${user?.id ?? "anon"}`;
}

export function getLastSeenAuditId(user) {
    return Number(readStorage(key(user), "0")) || 0;
}

export function markAuditSeen(user, newestId) {
    if (!newestId || newestId <= getLastSeenAuditId(user)) return;
    writeStorage(key(user), String(newestId));
    window.dispatchEvent(new Event(EVENT));
}

export function onAuditSeen(listener) {
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
}
