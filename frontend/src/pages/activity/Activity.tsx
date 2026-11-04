import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, RefreshCw, ScrollText } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { fetchMyActivity } from "../../api/security";
import type { AuditEventDto } from "../../api/types";
import { AUDIT_FILTERS, auditMeta } from "../../utils/auditTypes";
import { getLastSeenAuditId, markAuditSeen } from "../../utils/auditSeen";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import PageHeader from "../../ui/PageHeader";
import { isOwnAction } from "../../utils/activityBadge";
import { canReadAuditLog, mergeNewer } from "./feed";
import type { CategoryFilter } from "./feed";
import FeedList from "./FeedList";

const POLL_MS = 30000;
const PAGE_SIZE = 50;

/**
 * Activity (Overview): your own events, the ones you did and the ones about you (GET
 * /api/audit/me). Every signed-in user has it. Older events load a page at a time; the newest
 * page refreshes in the background. Opening it clears the unread badge.
 */
export default function Activity() {
    const { user } = useAuth();
    const [events, setEvents] = useState<AuditEventDto[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<CategoryFilter>("All");
    // What was already seen when the page opened, so newer rows can be highlighted.
    const [seenBefore] = useState(() => getLastSeenAuditId(user));

    /** Loads (or, in the background, refreshes) the newest page. */
    const loadNewest = useCallback(async (background = false) => {
        try {
            const page = await fetchMyActivity({ limit: PAGE_SIZE }, { background });
            const items = Array.isArray(page?.items) ? page.items : [];
            if (background) {
                setEvents((current) => mergeNewer(current, items));
            } else {
                setEvents(items);
                setCursor(page?.nextCursor ?? null);
            }
            setError(null);
            if (items.length > 0) markAuditSeen(user, Math.max(...items.map((e) => e.id)));
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadNewest();
        const id = window.setInterval(() => loadNewest(true), POLL_MS);
        return () => window.clearInterval(id);
    }, [loadNewest]);

    async function loadOlder() {
        if (!cursor || loadingMore) return;
        setLoadingMore(true);
        try {
            const page = await fetchMyActivity({ cursor, limit: PAGE_SIZE });
            setEvents((current) => [...current, ...(page?.items ?? []).filter((ev) => !current.some((c) => c.id === ev.id))]);
            setCursor(page?.nextCursor ?? null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoadingMore(false);
        }
    }

    const visible = events.filter((ev) => filter === "All" || auditMeta(ev.eventType).category === filter);
    const actorLabel = (ev: AuditEventDto) => (isOwnAction(ev, user) ? "You" : ev.actorEmail);

    return (
        <section className="ms-notifications">
            <PageHeader
                eyebrow="Overview"
                title="Activity"
                count={events.length > 0 ? `${events.length}${cursor ? "+" : ""}` : undefined}
                description="What you did, and what happened to your account. New events appear on their own."
                actions={
                    <>
                        {canReadAuditLog(user) && (
                            <Link className="ms-btn ms-btn--ghost ms-btn--sm" to="/audit">
                                <span className="ms-btn__face">
                                    <ScrollText aria-hidden="true" />
                                    <span>Audit log</span>
                                </span>
                            </Link>
                        )}
                        <Button size="sm" icon={<RefreshCw aria-hidden="true" />} onClick={() => loadNewest()}>Refresh</Button>
                    </>
                }
            />

            {error && <Alert tone="danger" role="alert" className="ms-notice">Could not load your activity: {error}</Alert>}

            <div className="ms-toolbar">
                <div className="ms-chips" role="group" aria-label="Filter by category">
                    {AUDIT_FILTERS.map((f) => (
                        <button key={f} type="button" className="ms-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                            {filter === f && <Check aria-hidden="true" />}
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="ms-empty"><p>Loading your activity…</p></div>
            ) : events.length === 0 ? (
                <div className="ms-empty">
                    <p className="ms-empty__title">Nothing here yet</p>
                    <p>Your sign-ins, changes to your account and the changes you make will show up here.</p>
                </div>
            ) : visible.length === 0 ? (
                <div className="ms-empty">
                    <p>No {filter.toLowerCase()} events in what is loaded.</p>
                    {cursor && <Button size="sm" onClick={loadOlder} disabled={loadingMore}>Load older events</Button>}
                </div>
            ) : (
                <FeedList events={visible} ready={!loading} seenBefore={seenBefore} actorLabel={actorLabel} />
            )}

            {!loading && visible.length > 0 && (
                <div className="ms-feed__more">
                    {cursor ? (
                        <Button size="sm" onClick={loadOlder} disabled={loadingMore}>
                            {loadingMore ? "Loading…" : "Load older events"}
                        </Button>
                    ) : (
                        <p className="ms-feed__end">That is everything.</p>
                    )}
                </div>
            )}
        </section>
    );
}
