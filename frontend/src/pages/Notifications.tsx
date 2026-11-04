import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { get } from "../api/client";
import type { AuditEventDto } from "../api/types";
import { relTime, formatDateTime } from "../utils/format";
import { AUDIT_FILTERS, auditMeta } from "../utils/auditTypes";
import type { AuditTypeMeta } from "../utils/auditTypes";
import { getLastSeenAuditId, markAuditSeen } from "../utils/auditSeen";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import PageHeader from "../ui/PageHeader";
import { useReveal } from "../ui/useReveal";
import "../ui/list.css";
import "../ui/surface.css";
import "./notifications.css";

const POLL_MS = 15000;
const LIMIT = 200;

type Tone = "ok" | "warn" | "danger" | "info" | "neutral";

/** The status tone behind an event type's colour token, for the icon tile. */
function toneOf(meta: AuditTypeMeta): Tone {
    const match = /--status-(ok|warn|danger|info)-fg/.exec(meta.color);
    return (match?.[1] as Tone | undefined) ?? "neutral";
}

type FeedVariant = "activity" | "audit";

const HEADERS: Record<FeedVariant, { eyebrow: string; title: string; lead: string }> = {
    activity: { eyebrow: "Overview", title: "Activity", lead: "What is happening across the platform" },
    audit: { eyebrow: "Security", title: "Audit log", lead: "The audit trail of every sign-in and change, with who made it" },
};

/** Activity (Overview): the latest events, with new ones highlighted. */
export default function Activity() {
    return <AuditFeed variant="activity" />;
}

/** Audit log (Security): the same feed for now, under its own title, until it gets its own page. */
export function AuditLog() {
    return <AuditFeed variant="audit" />;
}

function AuditFeed({ variant }: { variant: FeedVariant }) {
    const header = HEADERS[variant];
    const { user } = useAuth();
    const [events, setEvents] = useState<AuditEventDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<(typeof AUDIT_FILTERS)[number]>("All");
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const reveal = useReveal(!loading);
    // Snapshot of what was already seen when the page opened, so new rows can be highlighted.
    const [seenBefore] = useState(() => getLastSeenAuditId(user));

    const load = useCallback(async () => {
        try {
            const data = await get<AuditEventDto[]>(`/api/audit?limit=${LIMIT}`);
            const list = Array.isArray(data) ? data : [];
            setEvents(list);
            setError(null);
            setUpdatedAt(new Date());
            if (list.length > 0) markAuditSeen(user, Math.max(...list.map((e) => e.id)));
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        load();
        const id = setInterval(load, POLL_MS);
        return () => clearInterval(id);
    }, [load]);

    const visible = events.filter((ev) => filter === "All" || auditMeta(ev.eventType).category === filter);

    return (
        <section className="ms-notifications">
            <PageHeader
                eyebrow={header.eyebrow}
                title={header.title}
                count={events.length > 0 ? events.length : undefined}
                description={`${header.lead} (latest ${LIMIT}). Refreshes every ${POLL_MS / 1000}s${updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ""}.`}
                actions={
                    <Button size="sm" icon={<RefreshCw aria-hidden="true" />} onClick={load}>Refresh</Button>
                }
            />

            {error && <Alert tone="danger" role="alert" className="ms-notice">Could not load events: {error}</Alert>}

            <div className="ms-toolbar">
                <div className="ms-chips" role="group" aria-label="Filter by category">
                    {AUDIT_FILTERS.map((f) => (
                        <button
                            key={f}
                            type="button"
                            className="ms-chip"
                            aria-pressed={filter === f}
                            onClick={() => setFilter(f)}
                        >
                            {filter === f && <Check aria-hidden="true" />}
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="ms-empty"><p>Loading events…</p></div>
            ) : visible.length === 0 ? (
                <div className="ms-empty"><p>No events in this category yet.</p></div>
            ) : (
                <ol className="ms-panel ms-feed">
                    {visible.map((ev, i) => {
                        const meta = auditMeta(ev.eventType);
                        const isNew = ev.id > seenBefore;
                        return (
                            <li key={ev.id} {...reveal(i, `ms-feed__item${isNew ? " ms-feed__item--new" : ""}`)}>
                                <span className={`ms-feed__icon ms-feed__icon--${toneOf(meta)}`} aria-hidden="true"><meta.Icon /></span>
                                <div className="ms-feed__body">
                                    <p className="ms-feed__top">
                                        <span className="ms-feed__type">{meta.label}</span>
                                        {isNew && <span className="ms-feed__new">New</span>}
                                        <span className="ms-feed__actor">{ev.actorEmail}</span>
                                    </p>
                                    <p className="ms-feed__text">{ev.description}</p>
                                </div>
                                <time className="ms-feed__time" dateTime={ev.createdAt} title={formatDateTime(ev.createdAt)}>{relTime(ev.createdAt)}</time>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
