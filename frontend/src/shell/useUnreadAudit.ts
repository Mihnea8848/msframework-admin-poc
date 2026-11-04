import { useEffect, useState } from "react";
import { fetchMyActivity } from "../api/security";
import type { AuditEventDto, CurrentUserDto } from "../api/types";
import { getLastSeenAuditId, onAuditSeen } from "../utils/auditSeen";
import { unreadCount } from "../utils/activityBadge";

export const AUDIT_POLL_MS = 30000;
export const BADGE_LIMIT = 50;

/**
 * The unread badge on Activity ("3", "50+", or null for none). Polls the user's own activity
 * (GET /api/audit/me) every 30 s and counts the notable events newer than the last one seen on
 * the Activity page: what others did to the account and security warnings, not the user's own
 * actions (see `isNotable`). It lives in the shell, which is mounted once, so navigating
 * between pages does not restart the poll.
 */
export function useUnreadAudit(user: CurrentUserDto | null): string | null {
    const userId = user?.id ?? null;
    const [events, setEvents] = useState<AuditEventDto[]>([]);
    const [lastSeen, setLastSeen] = useState(() => getLastSeenAuditId(user));

    useEffect(() => {
        if (userId === null) return undefined;
        let alive = true;
        // A background poll: it must not keep an idle session alive.
        const fetchEvents = () => fetchMyActivity({ limit: BADGE_LIMIT }, { background: true })
            .then((page) => { if (alive) setEvents(Array.isArray(page?.items) ? page.items : []); })
            .catch(() => { if (alive) setEvents([]); });
        fetchEvents();
        const id = window.setInterval(fetchEvents, AUDIT_POLL_MS);
        return () => {
            alive = false;
            window.clearInterval(id);
        };
    }, [userId]);

    useEffect(() => onAuditSeen(() => setLastSeen(getLastSeenAuditId(user))), [user]);

    if (!user) return null;
    const unread = unreadCount(events, lastSeen, user);
    if (unread === 0) return null;
    return unread >= BADGE_LIMIT ? `${BADGE_LIMIT}+` : String(unread);
}
