import { useCallback, useEffect, useState } from "react";
import { get } from "../api/client";
import type { AuditEventDto } from "../api/types";
import type { AuditPage } from "../api/security";
import { auditMeta } from "../utils/auditTypes";
import { formatDateTime, relTime } from "../utils/format";
import Alert from "./Alert";
import Button from "./Button";
import "./timeline.css";

export const TIMELINE_PAGE_SIZE = 20;

type ActivityTimelineProps = {
    /** The keyset-paged feed, e.g. "/api/users/5/activity". Remount (key) to switch feeds. */
    path: string;
    /** Shown when the feed has no events. */
    emptyText: string;
};

type Tone = "ok" | "warn" | "danger" | "info" | "neutral";

function toneOf(color: string): Tone {
    const match = /--status-(ok|warn|danger|info)-fg/.exec(color);
    return (match?.[1] as Tone | undefined) ?? "neutral";
}

/**
 * An activity feed (newest first) from one of the keyset-paged audit endpoints, with "Load more"
 * for older events. Each event shows its type, the actor, the text and the time ("3h ago", the
 * exact time in a tooltip).
 */
export default function ActivityTimeline({ path, emptyText }: ActivityTimelineProps) {
    const [events, setEvents] = useState<AuditEventDto[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /** Loads a page (the newest without `after`). Callers set `loading` first, except the effect. */
    const fetchPage = useCallback(async (after: string | null) => {
        try {
            const params = new URLSearchParams({ limit: String(TIMELINE_PAGE_SIZE) });
            if (after) params.set("cursor", after);
            const page = await get<AuditPage>(`${path}?${params.toString()}`);
            const items = Array.isArray(page?.items) ? page.items : [];
            setEvents((prev) => (after ? [...prev, ...items.filter((e) => !prev.some((p) => p.id === e.id))] : items));
            setCursor(page?.nextCursor ?? null);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [path]);

    useEffect(() => {
        void fetchPage(null);
    }, [fetchPage]);

    const load = (after: string | null) => {
        setLoading(true);
        void fetchPage(after);
    };

    if (error && events.length === 0) {
        return (
            <Alert tone="danger" role="alert" className="ms-timeline__error">
                <span>Could not load the activity: {error}</span>
                <Button size="sm" onClick={() => load(null)}>Retry</Button>
            </Alert>
        );
    }
    if (loading && events.length === 0) return <p className="ms-timeline__empty">Loading activity…</p>;
    if (events.length === 0) return <p className="ms-timeline__empty">{emptyText}</p>;

    return (
        <div className="ms-timeline">
            <ol className="ms-timeline__list">
                {events.map((ev) => {
                    const meta = auditMeta(ev.eventType);
                    return (
                        <li key={ev.id} className="ms-timeline__item">
                            <span className={`ms-timeline__icon ms-timeline__icon--${toneOf(meta.color)}`} aria-hidden="true"><meta.Icon /></span>
                            <div className="ms-timeline__body">
                                <p className="ms-timeline__top">
                                    <span className="ms-timeline__type">{meta.label}</span>
                                    {ev.actorEmail && <span className="ms-timeline__actor">{ev.actorEmail}</span>}
                                </p>
                                <p className="ms-timeline__text">{ev.description}</p>
                            </div>
                            <time className="ms-timeline__time" dateTime={ev.createdAt} title={formatDateTime(ev.createdAt)}>
                                {relTime(ev.createdAt)}
                            </time>
                        </li>
                    );
                })}
            </ol>
            {error && <Alert tone="danger" role="alert" className="ms-timeline__error">Could not load more: {error}</Alert>}
            {cursor && (
                <div className="ms-timeline__more">
                    <Button size="sm" onClick={() => load(cursor)} disabled={loading}>
                        {loading ? "Loading…" : "Load more"}
                    </Button>
                </div>
            )}
        </div>
    );
}
