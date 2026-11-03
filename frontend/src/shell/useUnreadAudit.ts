import { useEffect, useState } from "react";
import { get } from "../api/client";
import type { AuditEventDto, CurrentUserDto } from "../api/types";
import { hasPermission } from "../auth/permissions";
import { getLastSeenAuditId, onAuditSeen } from "../utils/auditSeen";

export const AUDIT_POLL_MS = 30000;
export const BADGE_LIMIT = 50;

/**
 * The unread-notifications badge ("3", "50+", or null for none). Polls the newest audit events
 * every 30 s while the user may read the audit log. It lives in the shell, which is mounted once,
 * so navigating between pages does not restart the poll.
 */
export function useUnreadAudit(user: CurrentUserDto | null): string | null {
    const canReadAudit = hasPermission(user, "AUDIT_READ");
    const [events, setEvents] = useState<AuditEventDto[]>([]);
    const [lastSeen, setLastSeen] = useState(() => getLastSeenAuditId(user));

    useEffect(() => {
        if (!canReadAudit) return undefined;
        let alive = true;
        const fetchEvents = () => get<AuditEventDto[]>(`/api/audit?limit=${BADGE_LIMIT}`)
            .then((data) => { if (alive) setEvents(Array.isArray(data) ? data : []); })
            .catch(() => { if (alive) setEvents([]); });
        fetchEvents();
        const id = window.setInterval(fetchEvents, AUDIT_POLL_MS);
        return () => {
            alive = false;
            window.clearInterval(id);
        };
    }, [canReadAudit]);

    useEffect(() => onAuditSeen(() => setLastSeen(getLastSeenAuditId(user))), [user]);

    if (!canReadAudit) return null;
    const unread = events.filter((ev) => ev.id > lastSeen).length;
    if (unread === 0) return null;
    return unread >= BADGE_LIMIT ? `${BADGE_LIMIT}+` : String(unread);
}
