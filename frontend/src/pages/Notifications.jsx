import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { get } from "../api/client.js";
import { relTime, formatDateTime } from "../utils/format.js";
import { AUDIT_FILTERS, auditMeta } from "../utils/auditTypes.js";
import { getLastSeenAuditId, markAuditSeen } from "../utils/auditSeen.js";
import PageHeader from "../ui/PageHeader.jsx";

const POLL_MS = 15000;
const LIMIT = 200;

export default function Notifications() {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState("All");
    const [updatedAt, setUpdatedAt] = useState(null);
    // Snapshot of what was already seen when the page opened, so new rows can be highlighted.
    const [seenBefore] = useState(() => getLastSeenAuditId(user));

    const load = useCallback(async () => {
        try {
            const data = await get(`/api/audit?limit=${LIMIT}`);
            const list = Array.isArray(data) ? data : [];
            setEvents(list);
            setError(null);
            setUpdatedAt(new Date());
            if (list.length > 0) markAuditSeen(user, Math.max(...list.map((e) => e.id)));
        } catch (err) {
            setError(err.message);
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
        <section className="workspace">
            <PageHeader
                breadcrumb="General / Notifications"
                title="Notifications"
                count={events.length > 0 ? events.length : undefined}
                subtitle={`Audit trail of all activity across the platform (latest ${LIMIT}). Refreshes every ${POLL_MS / 1000}s${updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ""}.`}
                actions={
                    <button type="button" className="btn-secondary btn-small" onClick={load}>
                        <RefreshCw size={13} /> Refresh
                    </button>
                }
            />

            {error && <div className="inline-error page-banner" role="alert">Could not load events: {error}</div>}

            <div className="filter-chips-row">
                {AUDIT_FILTERS.map((f) => (
                    <button
                        key={f}
                        type="button"
                        className={`filter-chip${filter === f ? " active" : ""}`}
                        onClick={() => setFilter(f)}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <div className="audit-list">
                {loading && <div className="empty-state">Loading events…</div>}
                {!loading && visible.length === 0 && <div className="empty-state">No events in this category yet.</div>}
                {visible.map((ev) => {
                    const meta = auditMeta(ev.eventType);
                    const Icon = meta.Icon;
                    const isNew = ev.id > seenBefore;
                    return (
                        <div key={ev.id} className="audit-row" style={isNew ? { boxShadow: "inset 3px 0 0 var(--accent)" } : undefined}>
                            <div className="audit-icon" style={{ background: `${meta.color}20`, color: meta.color }}>
                                <Icon size={14} />
                            </div>
                            <div className="audit-body">
                                <div className="audit-top">
                                    <span className="audit-actor">{ev.actorEmail}</span>
                                    <span className={`event-pill ${meta.pill}`}>{meta.label}</span>
                                    <span className="audit-time" title={formatDateTime(ev.createdAt)}>{relTime(ev.createdAt)}</span>
                                </div>
                                <div className="audit-desc">{ev.description}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
