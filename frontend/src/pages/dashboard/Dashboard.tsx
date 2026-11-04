import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    Activity, Building2, Cable, ChevronRight, CircleCheck, CircleDashed, CircleX, Database,
    Shield, ShieldCheck, TriangleAlert, UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ApiError, get } from "../../api/client";
import type { AuditEventDto, ApiKeyDto, DepartmentResponse, ServiceConnection, TableInfo, UserDto } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import { hasPermission } from "../../auth/permissions";
import { PAGES } from "../../routes/navigation";
import type { PageKey } from "../../routes/navigation";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import PageHeader from "../../ui/PageHeader";
import { getLastSeenAuditId } from "../../utils/auditSeen";
import { auditMeta } from "../../utils/auditTypes";
import { relTime } from "../../utils/format";
import { SECURITY_AUDIT_LIMIT, securityChecks } from "../../utils/securityChecks";
import type { SecurityCheck } from "../../utils/securityChecks";
import {
    checkedLabel, departmentFigure, deriveStatusCards, summarizeStatus, userFigures,
} from "./status";
import type { CardKey, CardState, GlanceFigure, Probe, StatusCard } from "./status";
import "../../ui/surface.css";
import "./dashboard.css";

const RECENT_EVENTS = 8;
const QUICK_LINK_KEYS: PageKey[] = ["activity", "security", "database", "payments", "import", "export"];

const CARD_ICONS: Record<CardKey, LucideIcon> = { api: Activity, database: Database, integrations: Cable, security: Shield };
const BADGE_ICONS: Record<CardState, LucideIcon> = { ok: CircleCheck, warn: TriangleAlert, danger: CircleX, neutral: CircleDashed };
const FIGURE_ICONS: Record<GlanceFigure["key"], LucideIcon> = { total: UsersRound, active: CircleCheck, admins: ShieldCheck, departments: Building2 };

/** Runs a request and records how long it took and how it ended. */
async function timed<T>(request: () => Promise<T>): Promise<Probe<T>> {
    const start = performance.now();
    try {
        const value = await request();
        return { ok: true, value, ms: Math.round(performance.now() - start) };
    } catch (err) {
        return {
            ok: false,
            status: err instanceof ApiError ? err.status : 0,
            message: err instanceof Error ? err.message : "Request failed",
            ms: Math.round(performance.now() - start),
        };
    }
}

const valueOr = <T,>(probe: Probe<T> | null, fallback: T): T => (probe && probe.ok ? probe.value ?? fallback : fallback);

interface Snapshot {
    checkedAt: number;
    cards: StatusCard[];
    users: UserDto[];
    departments: DepartmentResponse[];
    events: AuditEventDto[];
    errors: string[];
}

/** Text under each quick link, from the same data the page already loaded. */
function quickLinkMeta(key: PageKey, snapshot: Snapshot | null, unread: number | null): string {
    const card = (k: CardKey) => snapshot?.cards.find((c) => c.key === k);
    switch (key) {
        case "activity":
            if (unread === null) return "What is happening across the platform";
            return unread === 0 ? "All caught up" : `${unread} unread`;
        case "security": {
            const c = card("security");
            return c && c.state !== "neutral" ? c.text.replace(/^\d+ \/ 100, /, "") : "Security checks and alerts";
        }
        case "database": {
            const c = card("database");
            return c && c.state !== "neutral" ? c.text : "Live schema of the application database";
        }
        case "payments":
            return "Sample data, not connected";
        case "import":
            return "Create users or departments from CSV";
        case "export":
            return "Users and audit log as CSV";
        default:
            return "";
    }
}

export default function Dashboard() {
    const { user } = useAuth();

    const canReadUsers = hasPermission(user, "USER_READ");
    const canReadDepartments = hasPermission(user, "DEPARTMENT_READ");
    const canReadAudit = hasPermission(user, "AUDIT_READ");
    const canReadDatabase = hasPermission(user, "DATABASE_READ");
    const canReadConnections = hasPermission(user, "CONNECTIONS_READ");
    const canReadSecurity = hasPermission(user, "SECURITY_READ");
    const canReadKeys = hasPermission(user, "API_KEY_READ");

    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [version, setVersion] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [now, setNow] = useState(0);

    useEffect(() => {
        let alive = true;
        const auditLimit = canReadSecurity ? SECURITY_AUDIT_LIMIT : RECENT_EVENTS;
        Promise.all([
            timed(() => get("/api/auth/me", { authRedirect: false })),
            canReadDatabase ? timed(() => get<TableInfo[]>("/api/database/tables")) : null,
            canReadConnections ? timed(() => get<ServiceConnection[]>("/api/connections")) : null,
            canReadUsers ? timed(() => get<UserDto[]>("/api/users")) : null,
            canReadDepartments ? timed(() => get<DepartmentResponse[]>("/api/departments")) : null,
            canReadAudit ? timed(() => get<AuditEventDto[]>(`/api/audit?limit=${auditLimit}`)) : null,
            canReadSecurity && canReadKeys ? timed(() => get<ApiKeyDto[]>("/api/keys")) : null,
        ]).then(([api, database, connections, users, departments, audit, keys]) => {
            if (!alive) return;
            const checkedAt = Date.now();

            let security: SecurityCheck[] | "failed" | null = null;
            if (canReadSecurity) {
                const inputs = [users, audit, keys].filter((p) => p !== null);
                security = inputs.some((p) => !p.ok)
                    ? "failed"
                    : securityChecks({
                        users: valueOr(users, []),
                        events: valueOr(audit, []),
                        keys: valueOr(keys, []),
                        now: checkedAt,
                        canReadUsers,
                        canReadAudit,
                        canReadKeys,
                    });
            }

            const errors = [users, departments, audit]
                .filter((p): p is Extract<Probe<unknown>, { ok: false }> => p !== null && !p.ok)
                .map((p) => p.message);

            setSnapshot({
                checkedAt,
                cards: deriveStatusCards({ api, database, connections, security }),
                users: valueOr(users, []),
                departments: valueOr(departments, []),
                events: valueOr(audit, []).slice(0, RECENT_EVENTS),
                errors,
            });
            setNow(checkedAt);
            setRefreshing(false);
        });
        return () => { alive = false; };
    }, [version, canReadUsers, canReadDepartments, canReadAudit, canReadDatabase, canReadConnections, canReadSecurity, canReadKeys]);

    // Keeps "Checked X ago" and the event times current.
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(timer);
    }, []);

    function refresh() {
        setRefreshing(true);
        setVersion((v) => v + 1);
    }

    const loading = snapshot === null;
    const summary = snapshot ? summarizeStatus(snapshot.cards) : null;

    const figures: GlanceFigure[] = [];
    if (snapshot && canReadUsers) figures.push(...userFigures(snapshot.users));
    if (snapshot && canReadDepartments) figures.push(departmentFigure(snapshot.departments));

    const unread = useMemo(() => {
        if (!snapshot || !canReadAudit) return null;
        const seen = getLastSeenAuditId(user);
        return snapshot.events.filter((e) => e.id > seen).length;
    }, [snapshot, canReadAudit, user]);

    const quickLinks = QUICK_LINK_KEYS
        .map((key) => PAGES.find((p) => p.key === key))
        .filter((page): page is (typeof PAGES)[number] => page !== undefined && hasPermission(user, page.permission));
    const showActivity = canReadAudit;
    const showQuick = quickLinks.length > 0;

    return (
        <section className="ms-dashboard">
            <PageHeader
                eyebrow="Overview"
                title="Dashboard"
                description="Is everything working? A plain-language check of the Multimedia Entertainment Hub systems."
                actions={
                    <Button variant="secondary" icon={<Activity aria-hidden="true" />} onClick={refresh} disabled={loading || refreshing}>
                        {refreshing ? "Checking..." : "Refresh status"}
                    </Button>
                }
            />

            {snapshot && snapshot.errors.length > 0 && (
                <Alert tone="danger" role="alert" className="ms-dashboard__banner">
                    Some data could not be loaded: {snapshot.errors[0]}
                </Alert>
            )}

            <section className="ms-dashboard__section" aria-labelledby="dash-status">
                <div className="ms-dashboard__head">
                    <h2 className="ms-dashboard__title" id="dash-status">System status</h2>
                    <p className="ms-dashboard__meta" aria-live="polite">
                        {summary ? (
                            <span className={`ms-dashboard__summary ms-dashboard__summary--${summary.tone}`}>
                                {summary.tone === "ok" ? <CircleCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
                                {summary.text}
                            </span>
                        ) : (
                            <span>Checking…</span>
                        )}
                        {snapshot && <span>{checkedLabel(snapshot.checkedAt, now)}</span>}
                    </p>
                </div>
                <ul className="ms-status-grid">
                    {(snapshot?.cards ?? PLACEHOLDER_CARDS).map((card) => {
                        const Icon = CARD_ICONS[card.key];
                        const BadgeIcon = BADGE_ICONS[card.state];
                        return (
                            <li key={card.key} className={`ms-status-card ms-cut ms-status-card--${card.state}`}>
                                <div className="ms-status-card__top">
                                    <span className="ms-status-card__icon" aria-hidden="true"><Icon /></span>
                                    <h3 className="ms-status-card__name">{card.name}</h3>
                                </div>
                                <p className="ms-status-card__text">{card.text}</p>
                                <p className="ms-status-card__badge">
                                    <BadgeIcon aria-hidden="true" />
                                    {card.badge}
                                </p>
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section className="ms-dashboard__section" aria-labelledby="dash-glance">
                <div className="ms-dashboard__head">
                    <h2 className="ms-dashboard__title" id="dash-glance">Studio at a glance</h2>
                </div>
                {canReadUsers || canReadDepartments ? (
                    <ul className="ms-glance-grid">
                        {loading
                            ? PLACEHOLDER_FIGURES.filter((f) => (f.key === "departments" ? canReadDepartments : canReadUsers)).map((f) => (
                                <li key={f.key} className="ms-glance ms-cut">
                                    <GlanceBody figure={f} loading />
                                </li>
                            ))
                            : figures.map((f) => (
                                <li key={f.key}>
                                    <Link to={f.to} className="ms-glance ms-glance--link ms-cut">
                                        <GlanceBody figure={f} />
                                    </Link>
                                </li>
                            ))}
                    </ul>
                ) : (
                    <p className="ms-dashboard__limited">
                        <ShieldCheck aria-hidden="true" />
                        Your role has limited dashboard permissions, so user and department figures are not shown.
                    </p>
                )}
            </section>

            {(showActivity || showQuick) && (
                <div className={showActivity && showQuick ? "ms-dashboard__cols" : "ms-dashboard__cols ms-dashboard__cols--single"}>
                    {showActivity && (
                        <section className="ms-panel" aria-labelledby="dash-activity">
                            <div className="ms-panel__head">
                                <h2 className="ms-panel__title" id="dash-activity">Recent activity</h2>
                                <Link className="ms-panel__meta ms-dashboard__more" to="/activity">
                                    Latest {RECENT_EVENTS} audit events
                                </Link>
                            </div>
                            {snapshot && snapshot.events.length === 0 && (
                                <p className="ms-dashboard__empty">No activity recorded yet.</p>
                            )}
                            {loading && <p className="ms-dashboard__empty">Loading…</p>}
                            <ol className="ms-events">
                                {snapshot?.events.map((ev) => {
                                    const meta = auditMeta(ev.eventType);
                                    const level = meta.alert === "fail" ? "alert" : meta.alert === "warn" ? "warning" : null;
                                    return (
                                        <li key={ev.id} className={level ? `ms-events__item ms-events__item--${level}` : "ms-events__item"}>
                                            <span className="ms-events__icon" aria-hidden="true"><meta.Icon /></span>
                                            <div className="ms-events__body">
                                                <p className="ms-events__type">{meta.label}</p>
                                                <p className="ms-events__text">{ev.description}</p>
                                            </div>
                                            <div className="ms-events__side">
                                                {level && (
                                                    <span className={`ms-events__level ms-events__level--${level}`}>
                                                        <TriangleAlert aria-hidden="true" />
                                                        {level === "alert" ? "Alert" : "Warning"}
                                                    </span>
                                                )}
                                                <time dateTime={ev.createdAt}>{relTime(ev.createdAt, now)}</time>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>
                    )}

                    {showQuick && (
                        <section className="ms-panel" aria-labelledby="dash-links">
                            <div className="ms-panel__head">
                                <h2 className="ms-panel__title" id="dash-links">Quick links</h2>
                            </div>
                            <div className="ms-quick-links">
                                {quickLinks.map((page) => {
                                    const PageIcon = page.icon;
                                    return (
                                        <Link key={page.key} to={page.path} className="ms-quick-links__item">
                                            <span className="ms-quick-links__icon" aria-hidden="true"><PageIcon /></span>
                                            <span className="ms-quick-links__text">
                                                <span className="ms-quick-links__label">{page.label}</span>
                                                <span className="ms-quick-links__meta">{quickLinkMeta(page.key, snapshot, unread)}</span>
                                            </span>
                                            <ChevronRight className="ms-quick-links__chevron" aria-hidden="true" />
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </section>
    );
}

function GlanceBody({ figure, loading = false }: { figure: GlanceFigure; loading?: boolean }) {
    const Icon = FIGURE_ICONS[figure.key];
    return (
        <>
            <p className="ms-glance__label"><Icon aria-hidden="true" />{figure.label}</p>
            <p className="ms-glance__value">{loading ? "…" : figure.value}</p>
            <p className="ms-glance__detail">{loading ? "Loading…" : figure.detail}</p>
        </>
    );
}

/** Shown while the first check runs. */
const PLACEHOLDER_CARDS: StatusCard[] = [
    { key: "api", name: "API", state: "neutral", text: "Checking…", badge: "Checking" },
    { key: "database", name: "Database", state: "neutral", text: "Checking…", badge: "Checking" },
    { key: "integrations", name: "Integrations", state: "neutral", text: "Checking…", badge: "Checking" },
    { key: "security", name: "Security score", state: "neutral", text: "Checking…", badge: "Checking" },
];

const PLACEHOLDER_FIGURES: GlanceFigure[] = [
    { key: "total", label: "Total users", value: 0, detail: "", to: "/users" },
    { key: "active", label: "Active", value: 0, detail: "", to: "/users" },
    { key: "admins", label: "Admins", value: 0, detail: "", to: "/users" },
    { key: "departments", label: "Departments", value: 0, detail: "", to: "/departments" },
];
