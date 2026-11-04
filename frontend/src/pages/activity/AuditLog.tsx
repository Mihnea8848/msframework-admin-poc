import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, Search, X } from "lucide-react";
import { get } from "../../api/client";
import type { AuditEventDto } from "../../api/types";
import { AUDIT_FILTERS } from "../../utils/auditTypes";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import PageHeader from "../../ui/PageHeader";
import "../../ui/field.css";
import { NO_FILTERS, filterAuditEvents, hasActiveFilters, isRangeInverted } from "./feed";
import type { AuditFilters } from "./feed";
import FeedList from "./FeedList";

const POLL_MS = 30000;
/** The most the API returns in one call (AuditController.MAX_LIMIT); the filters work on these. */
const LIMIT = 500;
/** Rows shown at first and added by "Show more", so 500 events do not make one endless page. */
const STEP = 50;

/**
 * Audit log (Security, AUDIT_READ): every sign-in and change, with who made it. The filters
 * (category, actor, a date range) run in the browser over the latest 500 events, which the
 * page refreshes in the background.
 */
export default function AuditLog() {
    const [events, setEvents] = useState<AuditEventDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<AuditFilters>(NO_FILTERS);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const [shown, setShown] = useState(STEP);

    /** `background` marks the timed refresh, which must not keep an idle session alive. */
    const load = useCallback(async (background = false) => {
        try {
            const data = await get<AuditEventDto[]>(`/api/audit?limit=${LIMIT}`, { background });
            setEvents(Array.isArray(data) ? data : []);
            setError(null);
            setUpdatedAt(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const id = window.setInterval(() => load(true), POLL_MS);
        return () => window.clearInterval(id);
    }, [load]);

    const set = <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => {
        setFilters((f) => ({ ...f, [key]: value }));
        setShown(STEP);
    };
    const clear = () => {
        setFilters(NO_FILTERS);
        setShown(STEP);
    };
    const inverted = isRangeInverted(filters);
    const visible = inverted ? [] : filterAuditEvents(events, filters);
    const filtered = hasActiveFilters(filters);

    return (
        <section className="ms-notifications">
            <PageHeader
                eyebrow="Security"
                title="Audit log"
                count={events.length > 0 ? events.length : undefined}
                description={`Every sign-in and change, with who made it (latest ${LIMIT}). Refreshes every ${POLL_MS / 1000}s${updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ""}.`}
                actions={<Button size="sm" icon={<RefreshCw aria-hidden="true" />} onClick={() => load()}>Refresh</Button>}
            />

            {error && <Alert tone="danger" role="alert" className="ms-notice">Could not load events: {error}</Alert>}

            <div className="ms-audit-filters">
                <div className="ms-chips" role="group" aria-label="Filter by category">
                    {AUDIT_FILTERS.map((f) => (
                        <button key={f} type="button" className="ms-chip" aria-pressed={filters.category === f} onClick={() => set("category", f)}>
                            {filters.category === f && <Check aria-hidden="true" />}
                            {f}
                        </button>
                    ))}
                </div>
                <div className="ms-audit-filters__row">
                    <div className="ms-search ms-audit-filters__actor">
                        <label className="ms-visually-hidden" htmlFor="audit-actor">Actor</label>
                        <Search aria-hidden="true" />
                        <input
                            id="audit-actor"
                            className="ms-input"
                            type="search"
                            placeholder="Actor email"
                            value={filters.actor}
                            onChange={(e) => set("actor", e.target.value)}
                        />
                    </div>
                    <div className="ms-field ms-audit-filters__date">
                        <label className="ms-field__label" htmlFor="audit-from">From</label>
                        <input id="audit-from" className="ms-input" type="date" value={filters.from} max={filters.to || undefined}
                            onChange={(e) => set("from", e.target.value)} aria-invalid={inverted || undefined} />
                    </div>
                    <div className="ms-field ms-audit-filters__date">
                        <label className="ms-field__label" htmlFor="audit-to">To</label>
                        <input id="audit-to" className="ms-input" type="date" value={filters.to} min={filters.from || undefined}
                            onChange={(e) => set("to", e.target.value)} aria-invalid={inverted || undefined} />
                    </div>
                    {filtered && (
                        <Button size="sm" variant="ghost" icon={<X aria-hidden="true" />} onClick={clear}>
                            Clear filters
                        </Button>
                    )}
                </div>
                {!loading && (
                    <p className="ms-result-count" aria-live="polite">
                        {inverted
                            ? "The end date is before the start date."
                            : `Showing ${visible.length} of ${events.length} ${events.length === 1 ? "event" : "events"}`}
                    </p>
                )}
            </div>

            {loading ? (
                <div className="ms-empty"><p>Loading events…</p></div>
            ) : events.length === 0 ? (
                <div className="ms-empty"><p className="ms-empty__title">No events yet</p><p>Sign-ins and changes will be recorded here.</p></div>
            ) : visible.length === 0 ? (
                <div className="ms-empty">
                    <p>No events match these filters.</p>
                    <Button size="sm" onClick={clear}>Clear filters</Button>
                </div>
            ) : (
                <>
                    <FeedList events={visible.slice(0, shown)} ready={!loading} />
                    {visible.length > shown && (
                        <div className="ms-feed__more">
                            <Button size="sm" onClick={() => setShown((n) => n + STEP)}>
                                Show {Math.min(STEP, visible.length - shown)} more
                            </Button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
