import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, ShieldAlert, XCircle } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, hasRole } from "../auth/permissions";
import { get } from "../api/client";
import { auditMeta } from "../utils/auditTypes";
import { relTime } from "../utils/format";
import PageHeader from "../ui/PageHeader.jsx";

function ScoreRing({ score }) {
    const r = 52;
    const circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    const color = score >= 75 ? "var(--success)" : score >= 50 ? "var(--status-warn-fg)" : "var(--danger)";

    return (
        <div className="security-score-wrap">
            <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r={r} fill="none" stroke="var(--panel-muted)" strokeWidth="10" />
                <circle
                    cx="70" cy="70" r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circ}`}
                    transform="rotate(-90 70 70)"
                    style={{ transition: "stroke-dasharray 600ms ease" }}
                />
                <text x="70" y="65" textAnchor="middle" fill={color} fontSize="28" fontWeight="800" fontFamily="Manrope, sans-serif">{score}</text>
                <text x="70" y="82" textAnchor="middle" fill="var(--muted)" fontSize="11" fontFamily="Manrope, sans-serif">/ 100</text>
            </svg>
            <div className="security-score-label" style={{ color }}>
                {score >= 75 ? "Good" : score >= 50 ? "Fair" : "At Risk"}
            </div>
        </div>
    );
}

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_ICON = {
    pass: <CheckCircle size={14} />,
    warn: <AlertTriangle size={14} />,
    fail: <XCircle size={14} />,
};

export default function Security() {
    const { user } = useAuth();
    const canReadUsers = hasPermission(user, "USER_READ");
    const canReadAudit = hasPermission(user, "AUDIT_READ");
    const canReadKeys = hasPermission(user, "API_KEY_READ");

    const [users, setUsers] = useState([]);
    const [events, setEvents] = useState([]);
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [now, setNow] = useState(0);

    useEffect(() => {
        let alive = true;
        Promise.allSettled([
            canReadUsers ? get("/api/users") : Promise.resolve([]),
            canReadAudit ? get("/api/audit?limit=300") : Promise.resolve([]),
            canReadKeys ? get("/api/keys") : Promise.resolve([]),
        ]).then(([u, a, k]) => {
            if (!alive) return;
            setUsers(u.status === "fulfilled" ? u.value || [] : []);
            setEvents(a.status === "fulfilled" ? a.value || [] : []);
            setKeys(k.status === "fulfilled" ? k.value || [] : []);
            const failed = [u, a, k].find((r) => r.status === "rejected");
            setError(failed ? failed.reason?.message : null);
            setNow(Date.now());
            setLoading(false);
        });
        return () => { alive = false; };
    }, [canReadUsers, canReadAudit, canReadKeys]);

    const inactive = users.filter((u) => (u.status || "").toLowerCase() !== "active").length;
    const admins = users.filter((u) => hasRole(u, "ADMIN")).length;
    const adminRatio = users.length ? admins / users.length : 0;
    const noDepartment = users.filter((u) => u.departmentId == null).length;
    const failedLogins = events.filter((e) => e.eventType === "login_failed" && now - new Date(e.createdAt).getTime() < DAY_MS).length;
    const oldKeys = keys.filter((k) => k.createdAt && now - new Date(k.createdAt).getTime() > 90 * DAY_MS).length;

    const checks = [];
    if (canReadUsers) {
        checks.push({
            label: "Admin ratio",
            detail: `${admins} admin${admins !== 1 ? "s" : ""} of ${users.length} users (${(adminRatio * 100).toFixed(0)}%)`,
            status: admins === 0 ? "fail" : adminRatio <= 0.25 ? "pass" : adminRatio <= 0.5 ? "warn" : "fail",
        });
        checks.push({
            label: "Inactive accounts",
            detail: inactive === 0 ? "No inactive accounts" : `${inactive} account${inactive !== 1 ? "s are" : " is"} deactivated — delete them if no longer needed`,
            status: inactive === 0 ? "pass" : inactive < 3 ? "warn" : "fail",
        });
        checks.push({
            label: "Unassigned users",
            detail: `${noDepartment} user${noDepartment !== 1 ? "s have" : " has"} no department`,
            status: noDepartment === 0 ? "pass" : "warn",
        });
    }
    if (canReadAudit) {
        checks.push({
            label: "Failed sign-ins (24 h)",
            detail: `${failedLogins} failed attempt${failedLogins !== 1 ? "s" : ""} in the last 24 hours`,
            status: failedLogins === 0 ? "pass" : failedLogins < 5 ? "warn" : "fail",
        });
    }
    if (canReadKeys) {
        checks.push({
            label: "API key age",
            detail: keys.length === 0 ? "No API keys issued" : `${oldKeys} of ${keys.length} key${keys.length !== 1 ? "s" : ""} older than 90 days`,
            status: oldKeys === 0 ? "pass" : "warn",
        });
    }
    checks.push({
        label: "Two-factor authentication",
        detail: "Not available yet — planned on the roadmap",
        status: "warn",
    });

    const points = { pass: 1, warn: 0.5, fail: 0 };
    const score = checks.length ? Math.round((checks.reduce((sum, c) => sum + points[c.status], 0) / checks.length) * 100) : 0;

    const alerts = events.filter((e) => auditMeta(e.eventType).alert).slice(0, 8);

    return (
        <section className="workspace">
            <PageHeader
                breadcrumb="Ventures / Security"
                title="Security"
                subtitle="Your organisation's security posture, computed from live data."
            />

            {error && <div className="inline-error page-banner" role="alert">Some data could not be loaded: {error}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 200px) 1fr", gap: 16, alignItems: "start" }}>
                <div style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--panel)" }}>
                    <ScoreRing score={loading ? 0 : score} />
                    <div style={{ padding: "0 16px 16px", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
                        Based on {checks.length} checks (warnings count half)
                    </div>
                </div>

                <div className="security-checks">
                    {checks.map((c) => (
                        <div key={c.label} className="security-check-row">
                            <div className={`check-status-icon ${c.status}`}>{STATUS_ICON[c.status]}</div>
                            <div style={{ flex: 1 }}>
                                <div className="check-label">{c.label}</div>
                                <div className="check-detail">{loading ? "Loading…" : c.detail}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {canReadAudit && (
                <div className="workspace-section">
                    <div className="workspace-section-title">Recent Security Events</div>
                    <div className="security-checks">
                        {!loading && alerts.length === 0 && <div className="empty-state">No security-relevant events yet.</div>}
                        {alerts.map((a) => {
                            const level = auditMeta(a.eventType).alert;
                            return (
                                <div key={a.id} className="security-check-row">
                                    <div className={`check-status-icon ${level === "fail" ? "fail" : level === "warn" ? "warn" : "pass"}`}>
                                        {level === "fail" ? <ShieldAlert size={14} /> : level === "warn" ? <AlertTriangle size={14} /> : <Clock size={14} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="check-label" style={{ fontWeight: 500 }}>{a.description}</div>
                                    </div>
                                    <div className="check-detail">{relTime(a.createdAt)}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}
