import { useEffect, useState } from "react";
import { get } from "../api/client";
import type { CurrentUserDto } from "../api/types";
import type { AccessRequestDto } from "../api/people";
import { hasPermission } from "../auth/permissions";

export const ACCESS_REQUESTS_POLL_MS = 60000;
const CHANGED_EVENT = "ms:access-requests-changed";

/** Tells the badge to count again now, for example after a request was approved or rejected. */
export function notifyAccessRequestsChanged(): void {
    window.dispatchEvent(new Event(CHANGED_EVENT));
}

/**
 * The pending access requests badge ("2", or null for none). One background poll every 60 s,
 * only while the user may review requests. It lives in the shell, which is mounted once, and
 * refreshes at once when the Access requests page reports a change.
 */
export function usePendingAccessRequests(user: CurrentUserDto | null): string | null {
    const canManage = hasPermission(user, "ACCESS_REQUESTS_MANAGE");
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!canManage) return undefined;
        let alive = true;
        // A background poll: it must not keep an idle session alive.
        const fetchPending = () => get<AccessRequestDto[]>("/api/access-requests?status=PENDING", { background: true })
            .then((data) => { if (alive) setCount(Array.isArray(data) ? data.length : 0); })
            .catch(() => { /* keep the last count: a failed poll is not "no requests" */ });
        fetchPending();
        const id = window.setInterval(fetchPending, ACCESS_REQUESTS_POLL_MS);
        window.addEventListener(CHANGED_EVENT, fetchPending);
        return () => {
            alive = false;
            window.clearInterval(id);
            window.removeEventListener(CHANGED_EVENT, fetchPending);
        };
    }, [canManage]);

    if (!canManage || count === 0) return null;
    return String(count);
}
