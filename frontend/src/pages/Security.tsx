import { useEffect, useState } from "react";
import { CircleCheck, CircleX, Clock, ShieldAlert, TriangleAlert } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import { get } from "../api/client";
import type { ApiKeyDto, AuditEventDto, UserDto } from "../api/types";
import { auditMeta } from "../utils/auditTypes";
import { relTime } from "../utils/format";
import { SECURITY_AUDIT_LIMIT, securityChecks, securityScore } from "../utils/securityChecks";
import type { CheckStatus } from "../utils/securityChecks";
import Alert from "../ui/Alert";
import PageHeader from "../ui/PageHeader";
import "../ui/list.css";
import "../ui/surface.css";
import "./security.css";

function ScoreRing({ score }: { score: number }) {
    const r = 52;
    const circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    const tone = score >= 75 ? "ok" : score >= 50 ? "warn" : "danger";

    return (
        <div className={`ms-security__score ms-security__score--${tone}`}>
            <svg className="ms-security__ring" width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`Security score ${score} out of 100`}>
                <circle className="ms-security__ring-track" cx="70" cy="70" r={r} fill="none" strokeWidth="10" />
                <circle
                    className="ms-security__ring-value"
                    cx="70" cy="70" r={r}
                    fill="none"
                    strokeWidth="10"
                    strokeLinecap="butt"
                    strokeDasharray={`${dash} ${circ}`}
                    transform="rotate(-90 70 70)"
                />
                <text className="ms-security__ring-score" x="70" y="67" textAnchor="middle">{score}</text>
                <text className="ms-security__ring-max" x="70" y="85" textAnchor="middle">/ 100</text>
            </svg>
            <p className="ms-security__score-label">
                {score >= 75 ? "Good" : score >= 50 ? "Fair" : "At Risk"}
            </p>
        </div>
    );
}

const STATUS_ICON = {
    pass: CircleCheck,
    warn: TriangleAlert,
    fail: CircleX,
} as const satisfies Record<CheckStatus, unknown>;

export default function Security() {
    const { user } = useAuth();
    const canReadUsers = hasPermission(user, "USER_READ");
    const canReadAudit = hasPermission(user, "AUDIT_READ");
    const canReadKeys = hasPermission(user, "API_KEY_READ");

    const [users, setUsers] = useState<UserDto[]>([]);
    const [events, setEvents] = useState<AuditEventDto[]>([]);
    const [keys, setKeys] = useState<ApiKeyDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(0);

    useEffect(() => {
        let alive = true;
        Promise.allSettled([
            canReadUsers ? get<UserDto[]>("/api/users") : Promise.resolve([]),
            canReadAudit ? get<AuditEventDto[]>(`/api/audit?limit=${SECURITY_AUDIT_LIMIT}`) : Promise.resolve([]),
            canReadKeys ? get<ApiKeyDto[]>("/api/keys") : Promise.resolve([]),
        ]).then(([u, a, k]) => {
            if (!alive) return;
            setUsers(u.status === "fulfilled" ? u.value || [] : []);
            setEvents(a.status === "fulfilled" ? a.value || [] : []);
            setKeys(k.status === "fulfilled" ? k.value || [] : []);
            const failed = [u, a, k].find((r) => r.status === "rejected");
            setError(failed ? (failed.reason as Error | undefined)?.message ?? null : null);
            setNow(Date.now());
            setLoading(false);
        });
        return () => { alive = false; };
    }, [canReadUsers, canReadAudit, canReadKeys]);

    const checks = securityChecks({ users, events, keys, now, canReadUsers, canReadAudit, canReadKeys });
    const score = securityScore(checks);

    const alerts = events.filter((e) => auditMeta(e.eventType).alert).slice(0, 8);

    return (
        <section className="ms-security">
            <PageHeader
                eyebrow="Ventures"
                title="Security"
                description="Your organisation's security posture, computed from live data."
            />

            {error && <Alert tone="danger" role="alert" className="ms-notice">Some data could not be loaded: {error}</Alert>}

            <div className="ms-security__grid">
                <div className="ms-cut ms-security__score-card">
                    <ScoreRing score={loading ? 0 : score} />
                    <p className="ms-security__score-note">Based on {checks.length} checks (warnings count half)</p>
                </div>

                <ul className="ms-panel ms-security__list" aria-label="Security checks">
                    {checks.map((c) => {
                        const Icon = STATUS_ICON[c.status];
                        return (
                            <li key={c.label} className="ms-security__row">
                                <span className={`ms-security__icon ms-security__icon--${c.status}`}>
                                    <Icon aria-hidden="true" />
                                    <span className="ms-visually-hidden">{c.status === "pass" ? "Passed" : c.status === "warn" ? "Warning" : "Failed"}: </span>
                                </span>
                                <div className="ms-security__text">
                                    <p className="ms-security__label">{c.label}</p>
                                    <p className="ms-security__detail">{loading ? "Loading…" : c.detail}</p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {canReadAudit && (
                <section className="ms-panel ms-security__events" aria-labelledby="security-events">
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id="security-events">Recent Security Events</h2>
                    </div>
                    {!loading && alerts.length === 0 && <p className="ms-security__empty">No security-relevant events yet.</p>}
                    <ul className="ms-security__list-plain">
                        {alerts.map((a) => {
                            const level = auditMeta(a.eventType).alert;
                            const status: CheckStatus = level === "fail" ? "fail" : level === "warn" ? "warn" : "pass";
                            const Icon = level === "fail" ? ShieldAlert : level === "warn" ? TriangleAlert : Clock;
                            return (
                                <li key={a.id} className="ms-security__row">
                                    <span className={`ms-security__icon ms-security__icon--${status}`} aria-hidden="true"><Icon /></span>
                                    <div className="ms-security__text">
                                        <p className="ms-security__event">{a.description}</p>
                                    </div>
                                    <time className="ms-security__time" dateTime={a.createdAt}>{relTime(a.createdAt)}</time>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}
        </section>
    );
}
