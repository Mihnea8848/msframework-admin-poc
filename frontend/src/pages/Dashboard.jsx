import { useEffect, useMemo, useState } from "react";
import { fetchUsers } from "../auth/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import {
    BadgeCheck,
    Bell,
    Circle,
    CreditCard,
    Database,
    Download,
    ShieldCheck,
    TableProperties,
    Upload,
    UsersRound,
} from "lucide-react";

const ACTIVITY_COLORS = ["#28beef", "#2dd881", "#f0a832", "#bb2eb8", "#ff6a5f"];

function getRoleNames(user) {
    if (!user?.roles?.length) return [];

    return user.roles.map((role) => {
        if (typeof role === "string") return role;
        return role.name;
    });
}

function generateActivity(users) {
    const templates = [
        (u) => `${u.fullName || u.email} signed in`,
        (u) => `${u.fullName || u.email} profile updated`,
        (u) => `${u.fullName || u.email} exported data`,
        (u) => `Admin changed role for ${u.fullName || u.email}`,
        (u) => `${u.fullName || u.email} changed password`,
    ];

    const times = ["just now", "12m ago", "1h ago", "3h ago", "6h ago"];

    return users.slice(0, 5).map((u, i) => ({
        desc: templates[i % templates.length](u),
        time: times[i],
        color: ACTIVITY_COLORS[i % ACTIVITY_COLORS.length],
    }));
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    const [members, setMembers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingDepartments, setLoadingDepartments] = useState(false);
    const [error, setError] = useState(null);

    const canReadUsers = hasPermission(user, "USER_READ");
    const canReadDepartments = hasPermission(user, "DEPARTMENT_READ");
    const canReadAudit = hasPermission(user, "AUDIT_READ");
    const canReadSecurity = hasPermission(user, "SECURITY_READ");
    const canReadDatabase = hasPermission(user, "DATABASE_READ");
    const canReadPayments = hasPermission(user, "PAYMENTS_READ");
    const canImportData = hasPermission(user, "IMPORT_DATA");
    const canExportData = hasPermission(user, "EXPORT_DATA");

    useEffect(() => {
        if (authLoading) return;

        let alive = true;

        async function loadUsers() {
            if (!canReadUsers) {
                setMembers([]);
                return;
            }

            setLoadingUsers(true);

            try {
                const data = await fetchUsers();

                if (alive) {
                    setMembers(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error("Fetch users error:", err);

                if (alive) {
                    setError("Failed to load dashboard users.");
                    setMembers([]);
                }
            } finally {
                if (alive) {
                    setLoadingUsers(false);
                }
            }
        }

        async function loadDepartments() {
            if (!canReadDepartments) {
                setDepartments([]);
                return;
            }

            setLoadingDepartments(true);

            try {
                const res = await fetch("/api/departments", {
                    credentials: "include",
                });

                if (!res.ok) {
                    throw new Error("Failed to load departments");
                }

                const data = await res.json();

                if (alive) {
                    setDepartments(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error("Fetch departments error:", err);

                if (alive) {
                    setDepartments([]);
                }
            } finally {
                if (alive) {
                    setLoadingDepartments(false);
                }
            }
        }

        setError(null);
        loadUsers();
        loadDepartments();

        return () => {
            alive = false;
        };
    }, [authLoading, canReadUsers, canReadDepartments]);

    const loading = authLoading || loadingUsers || loadingDepartments;

    const totalUsers = canReadUsers ? members.length : null;

    const activeUsers = canReadUsers
        ? members.filter((u) => (u.status || "").toLowerCase() === "active").length
        : null;

    const admins = canReadUsers
        ? members.filter((u) => getRoleNames(u).includes("ADMIN")).length
        : null;

    const departmentCount = canReadDepartments ? departments.length : null;

    const quickLinks = useMemo(() => {
        return [
            {
                label: "Notifications",
                icon: Bell,
                path: "/notifications",
                allowed: canReadAudit,
            },
            {
                label: "Security",
                icon: ShieldCheck,
                path: "/security",
                allowed: canReadSecurity,
            },
            {
                label: "Database",
                icon: Database,
                path: "/database",
                allowed: canReadDatabase,
            },
            {
                label: "Payments",
                icon: CreditCard,
                path: "/payments",
                allowed: canReadPayments,
            },
            {
                label: "Import",
                icon: Upload,
                path: "/import",
                allowed: canImportData,
            },
            {
                label: "Export",
                icon: Download,
                path: "/export",
                allowed: canExportData,
            },
        ].filter((item) => item.allowed);
    }, [
        canReadAudit,
        canReadSecurity,
        canReadDatabase,
        canReadPayments,
        canImportData,
        canExportData,
    ]);

    if (loading) {
        return (
            <div className="workspace">
                <h1>Loading dashboard...</h1>
            </div>
        );
    }

    if (error) {
        return (
            <div className="workspace">
                <h1>{error}</h1>
            </div>
        );
    }

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">
                        Ventures / Dashboard
                    </div>

                    <div className="workspace-title-row">
                        <h1>Dashboard</h1>
                    </div>
                </div>

                <div className="dashboard-status">
                    <Circle size={10} className="status-dot green" />
                    <span>System operational</span>
                </div>
            </div>

            <div className="dashboard-cards">
                {canReadUsers && (
                    <>
                        <div className="card accent" onClick={() => navigate("/users")}>
                            <div className="card-icon">
                                <UsersRound size={18} />
                            </div>
                            <div className="card-content">
                                <div className="card-value">{totalUsers}</div>
                                <div className="card-label">Total Users</div>
                                <div className="card-sub">All registered accounts</div>
                            </div>
                        </div>

                        <div className="card success" onClick={() => navigate("/users")}>
                            <div className="card-icon">
                                <BadgeCheck size={18} />
                            </div>
                            <div className="card-content">
                                <div className="card-value">{activeUsers}</div>
                                <div className="card-label">Active Users</div>
                                <div className="card-sub">Currently enabled</div>
                            </div>
                        </div>

                        <div className="card" onClick={() => navigate("/users")}>
                            <div className="card-icon">
                                <ShieldCheck size={18} />
                            </div>
                            <div className="card-content">
                                <div className="card-value">{admins}</div>
                                <div className="card-label">Admins</div>
                                <div className="card-sub">Privileged accounts</div>
                            </div>
                        </div>
                    </>
                )}

                {canReadDepartments && (
                    <div className="card" onClick={() => navigate("/departments")}>
                        <div className="card-icon">
                            <TableProperties size={18} />
                        </div>
                        <div className="card-content">
                            <div className="card-value">{departmentCount}</div>
                            <div className="card-label">Departments</div>
                            <div className="card-sub">Organizational units</div>
                        </div>
                    </div>
                )}

                {!canReadUsers && !canReadDepartments && (
                    <div className="card">
                        <div className="card-icon">
                            <ShieldCheck size={18} />
                        </div>
                        <div className="card-content">
                            <div className="card-value">Limited</div>
                            <div className="card-label">Dashboard Access</div>
                            <div className="card-sub">
                                Your role has limited dashboard permissions
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {quickLinks.length > 0 && (
                <div style={{ marginTop: 20 }}>
                    <div className="workspace-section-title" style={{ marginBottom: 10 }}>
                        Quick Links
                    </div>

                    <div className="dashboard-quick-links">
                        {quickLinks.map((item) => {
                            const LinkIcon = item.icon;

                            return (
                                <button
                                    key={item.path}
                                    type="button"
                                    className="quick-link-btn"
                                    onClick={() => navigate(item.path)}
                                >
                                    <LinkIcon size={14} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {canReadUsers && members.length > 0 && (
                <div style={{ marginTop: 24 }}>
                    <div className="workspace-section-title" style={{ marginBottom: 10 }}>
                        Recent Activity
                    </div>

                    <div className="recent-activity">
                        {generateActivity(members).map((ev, i) => (
                            <div key={i} className="recent-activity-row">
                                <div
                                    className="recent-activity-dot"
                                    style={{ background: ev.color }}
                                />
                                <span className="recent-activity-desc">{ev.desc}</span>
                                <span className="recent-activity-time">{ev.time}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}