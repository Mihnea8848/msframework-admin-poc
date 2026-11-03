import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Circle, ShieldCheck, TableProperties, UsersRound } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, hasRole } from "../auth/permissions";
import { get } from "../api/client";
import { relTime } from "../utils/format";
import { auditMeta } from "../utils/auditTypes";
import { PAGES } from "../routes/navigation";
import PageHeader from "../ui/PageHeader.jsx";

const QUICK_LINK_KEYS = ["notifications", "security", "database", "payments", "import", "export"];

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const canReadUsers = hasPermission(user, "USER_READ");
    const canReadDepartments = hasPermission(user, "DEPARTMENT_READ");
    const canReadAudit = hasPermission(user, "AUDIT_READ");

    const [members, setMembers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errors, setErrors] = useState([]);
    const [backendUp, setBackendUp] = useState(true);

    useEffect(() => {
        let alive = true;
        const tasks = [
            canReadUsers ? get("/api/users") : Promise.resolve([]),
            canReadDepartments ? get("/api/departments") : Promise.resolve([]),
            canReadAudit ? get("/api/audit?limit=8") : Promise.resolve([]),
        ];
        Promise.allSettled(tasks).then(([usersRes, deptRes, auditRes]) => {
            if (!alive) return;
            const failed = [usersRes, deptRes, auditRes].filter((r) => r.status === "rejected");
            setMembers(usersRes.status === "fulfilled" ? usersRes.value || [] : []);
            setDepartments(deptRes.status === "fulfilled" ? deptRes.value || [] : []);
            setActivity(auditRes.status === "fulfilled" ? auditRes.value || [] : []);
            setErrors(failed.map((r) => r.reason?.message || "Request failed"));
            setBackendUp(!failed.some((r) => r.reason?.status === 0 || r.reason?.status >= 500));
            setLoading(false);
        });
        return () => { alive = false; };
    }, [canReadUsers, canReadDepartments, canReadAudit]);

    const activeUsers = members.filter((u) => (u.status || "").toLowerCase() === "active").length;
    const admins = members.filter((u) => hasRole(u, "ADMIN")).length;

    const quickLinks = useMemo(
        () => QUICK_LINK_KEYS
            .map((key) => PAGES.find((p) => p.key === key))
            .filter((page) => page && hasPermission(user, page.permission)),
        [user]
    );

    return (
        <section className="workspace">
            <PageHeader
                breadcrumb="Ventures / Dashboard"
                title="Dashboard"
                actions={
                    <div className="dashboard-status">
                        <Circle size={10} className={`status-dot ${backendUp ? "green" : ""}`} style={backendUp ? undefined : { color: "var(--danger)", fill: "var(--danger)" }} />
                        <span>{backendUp ? "System operational" : "Backend unreachable"}</span>
                    </div>
                }
            />

            {errors.length > 0 && (
                <div className="inline-error page-banner" role="alert">Some data could not be loaded: {errors[0]}</div>
            )}

            <div className="dashboard-cards">
                {canReadUsers && (
                    <>
                        <div className="card accent" onClick={() => navigate("/users")} role="button" tabIndex={0}>
                            <div className="card-icon"><UsersRound size={18} /></div>
                            <div className="card-content">
                                <div className="card-value">{loading ? "…" : members.length}</div>
                                <div className="card-label">Total Users</div>
                                <div className="card-sub">All registered accounts</div>
                            </div>
                        </div>
                        <div className="card success" onClick={() => navigate("/users")} role="button" tabIndex={0}>
                            <div className="card-icon"><BadgeCheck size={18} /></div>
                            <div className="card-content">
                                <div className="card-value">{loading ? "…" : activeUsers}</div>
                                <div className="card-label">Active Users</div>
                                <div className="card-sub">Allowed to sign in</div>
                            </div>
                        </div>
                        <div className="card" onClick={() => navigate("/users")} role="button" tabIndex={0}>
                            <div className="card-icon"><ShieldCheck size={18} /></div>
                            <div className="card-content">
                                <div className="card-value">{loading ? "…" : admins}</div>
                                <div className="card-label">Admins</div>
                                <div className="card-sub">Privileged accounts</div>
                            </div>
                        </div>
                    </>
                )}

                {canReadDepartments && (
                    <div className="card" onClick={() => navigate("/departments")} role="button" tabIndex={0}>
                        <div className="card-icon"><TableProperties size={18} /></div>
                        <div className="card-content">
                            <div className="card-value">{loading ? "…" : departments.length}</div>
                            <div className="card-label">Departments</div>
                            <div className="card-sub">Organizational units</div>
                        </div>
                    </div>
                )}

                {!canReadUsers && !canReadDepartments && (
                    <div className="card">
                        <div className="card-icon"><ShieldCheck size={18} /></div>
                        <div className="card-content">
                            <div className="card-value">Limited</div>
                            <div className="card-label">Dashboard Access</div>
                            <div className="card-sub">Your role has limited dashboard permissions</div>
                        </div>
                    </div>
                )}
            </div>

            {quickLinks.length > 0 && (
                <div style={{ marginTop: 20 }}>
                    <div className="workspace-section-title" style={{ marginBottom: 10 }}>Quick Links</div>
                    <div className="dashboard-quick-links">
                        {quickLinks.map((item) => {
                            const LinkIcon = item.icon;
                            return (
                                <button key={item.path} type="button" className="quick-link-btn" onClick={() => navigate(item.path)}>
                                    <LinkIcon size={14} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {canReadAudit && (
                <div style={{ marginTop: 24 }}>
                    <div className="workspace-section-title" style={{ marginBottom: 10 }}>Recent Activity</div>
                    <div className="recent-activity">
                        {!loading && activity.length === 0 && <div className="empty-state">No activity recorded yet.</div>}
                        {activity.map((ev) => (
                            <div key={ev.id} className="recent-activity-row">
                                <div className="recent-activity-dot" style={{ background: auditMeta(ev.eventType).color }} />
                                <span className="recent-activity-desc">{ev.description}</span>
                                <span className="recent-activity-time">{relTime(ev.createdAt)}</span>
                            </div>
                        ))}
                    </div>
                    <button type="button" className="btn-secondary btn-small" style={{ marginTop: 10 }} onClick={() => navigate("/notifications")}>
                        View all activity
                    </button>
                </div>
            )}
        </section>
    );
}
