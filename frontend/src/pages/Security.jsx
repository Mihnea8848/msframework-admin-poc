import { useEffect, useState } from "react";
import { fetchUsers } from "../auth/auth";
import { AlertTriangle, CheckCircle, Clock, ShieldAlert, XCircle } from "lucide-react";

function ScoreRing({ score }) {
    const r = 52;
    const circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    const color = score >= 75 ? "var(--success)" : score >= 50 ? "#f0a832" : "var(--danger)";

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

const MOCK_ALERTS = [
    { text: "Login from unrecognised IP: 198.51.100.42", time: "35m ago", level: "warn" },
    { text: "Failed login attempts (5) for admin@company.com", time: "2h ago", level: "fail" },
    { text: "Password changed for Marketing Admin", time: "1d ago", level: "info" },
    { text: "New admin account created: dev-ops@company.com", time: "2d ago", level: "warn" },
];

export default function Security() {
    const [users, setUsers] = useState([]);

    useEffect(() => {
        fetchUsers().then(setUsers).catch(() => {});
    }, []);

    const inactive = users.filter((u) => (u.status || "").toLowerCase() !== "active").length;
    const admins = users.filter((u) => u.role === "ADMIN").length;
    const adminRatio = users.length ? admins / users.length : 0;

    const checks = [
        {
            label: "Inactive accounts",
            detail: `${inactive} account${inactive !== 1 ? "s" : ""} inactive`,
            status: inactive === 0 ? "pass" : inactive < 3 ? "warn" : "fail",
        },
        {
            label: "Two-factor authentication",
            detail: "No users have MFA enabled",
            status: "fail",
        },
        {
            label: "Last password rotation",
            detail: "3 accounts > 90 days (mock)",
            status: "warn",
        },
        {
            label: "Open sessions",
            detail: "2 sessions active (mock)",
            status: "pass",
        },
        {
            label: "Admin ratio",
            detail: `${admins} admin${admins !== 1 ? "s" : ""} of ${users.length} users (${(adminRatio * 100).toFixed(0)}%)`,
            status: adminRatio < 0.25 ? "pass" : adminRatio < 0.5 ? "warn" : "fail",
        },
        {
            label: "API keys rotated",
            detail: "Last rotated 14 d ago (mock)",
            status: "pass",
        },
    ];

    const passCount = checks.filter((c) => c.status === "pass").length;
    const score = Math.round((passCount / checks.length) * 100);

    const STATUS_ICON = {
        pass: <CheckCircle size={14} />,
        warn: <AlertTriangle size={14} />,
        fail: <XCircle size={14} />,
    };

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">Ventures / Security</div>
                    <div className="workspace-title-row">
                        <h1>Security</h1>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Monitor your organisation&apos;s security posture.
                    </p>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, alignItems: "start" }}>
                <div style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--panel)" }}>
                    <ScoreRing score={score} />
                    <div style={{ padding: "0 16px 16px", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
                        Security score based on {checks.length} checks
                    </div>
                </div>

                <div className="security-checks">
                    {checks.map((c) => (
                        <div key={c.label} className="security-check-row">
                            <div className={`check-status-icon ${c.status}`}>
                                {STATUS_ICON[c.status]}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className="check-label">{c.label}</div>
                                <div className="check-detail">{c.detail}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="workspace-section">
                <div className="workspace-section-title">Recent Alerts</div>
                <div className="security-checks">
                    {MOCK_ALERTS.map((a, i) => (
                        <div key={i} className="security-check-row">
                            <div className={`check-status-icon ${a.level === "fail" ? "fail" : a.level === "warn" ? "warn" : "pass"}`}>
                                {a.level === "fail" ? <ShieldAlert size={14} /> : a.level === "warn" ? <AlertTriangle size={14} /> : <Clock size={14} />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className="check-label" style={{ fontWeight: 500 }}>{a.text}</div>
                            </div>
                            <div className="check-detail">{a.time}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
