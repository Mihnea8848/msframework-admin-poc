import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchUsers } from "../auth/auth";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import {
    ArrowRight,
    Bell,
    Building2,
    CreditCard,
    Database,
    Download,
    Shield,
    Upload,
    UsersRound,
} from "lucide-react";

function getRoleNames(user) {
    if (!user?.roles?.length) return [];

    return user.roles.map((role) => {
        if (typeof role === "string") return role;
        return role.name;
    });
}

export default function HomePage() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingDepartments, setLoadingDepartments] = useState(false);

    const canReadUsers = hasPermission(user, "USER_READ");
    const canReadDepartments = hasPermission(user, "DEPARTMENT_READ");
    const canReadAudit = hasPermission(user, "AUDIT_READ");
    const canReadDatabase = hasPermission(user, "DATABASE_READ");
    const canReadSecurity = hasPermission(user, "SECURITY_READ");
    const canReadPayments = hasPermission(user, "PAYMENTS_READ");
    const canImportData = hasPermission(user, "IMPORT_DATA");
    const canExportData = hasPermission(user, "EXPORT_DATA");

    useEffect(() => {
        if (authLoading) return;

        let alive = true;

        async function loadUsers() {
            if (!canReadUsers) {
                setUsers([]);
                return;
            }

            setLoadingUsers(true);

            try {
                const data = await fetchUsers();

                if (alive) {
                    setUsers(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error("Fetch users error:", err);

                if (alive) {
                    setUsers([]);
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

        loadUsers();
        loadDepartments();

        return () => {
            alive = false;
        };
    }, [authLoading, canReadUsers, canReadDepartments]);

    const activeUsers = canReadUsers
        ? users.filter((u) => (u.status || "").toLowerCase() === "active").length
        : 0;

    const admins = canReadUsers
        ? users.filter((u) => getRoleNames(u).includes("ADMIN")).length
        : 0;

    const tiles = [
        {
            icon: UsersRound,
            iconColor: "#28beef",
            title: "User Management",
            desc: "View, invite, and manage all members in your organisation.",
            metric: `${users.length} total · ${activeUsers} active`,
            path: "/users",
            permission: "USER_READ",
            allowed: canReadUsers,
        },
        {
            icon: Building2,
            iconColor: "#bb2eb8",
            title: "Departments",
            desc: "Create and organise departments, track budgets and performance.",
            metric: `${departments.length} department${departments.length !== 1 ? "s" : ""}`,
            path: "/departments",
            permission: "DEPARTMENT_READ",
            allowed: canReadDepartments,
        },
        {
            icon: Bell,
            iconColor: "#f0a832",
            title: "Notifications",
            desc: "Full audit log of every action taken across the platform.",
            metric: "Audit events",
            path: "/notifications",
            permission: "AUDIT_READ",
            allowed: canReadAudit,
        },
        {
            icon: Database,
            iconColor: "#2dd881",
            title: "Database",
            desc: "Browse live and mock databases — Users, Departments, Finance.",
            metric: "3 databases",
            path: "/database",
            permission: "DATABASE_READ",
            allowed: canReadDatabase,
        },
        {
            icon: Shield,
            iconColor: "#ff6a5f",
            title: "Security",
            desc: "Monitor your security score, open vulnerabilities, and alerts.",
            metric: canReadUsers
                ? `${admins} admin account${admins !== 1 ? "s" : ""}`
                : "Security center",
            path: "/security",
            permission: "SECURITY_READ",
            allowed: canReadSecurity,
        },
        {
            icon: CreditCard,
            iconColor: "#d2ff72",
            title: "Payments",
            desc: "View balance, send payments, and review transaction history.",
            metric: "$24,860.00 balance",
            path: "/payments",
            permission: "PAYMENTS_READ",
            allowed: canReadPayments,
        },
        {
            icon: Upload,
            iconColor: "#6c32db",
            title: "Import Data",
            desc: "Upload CSV files to import users, departments, and more.",
            metric: "CSV supported",
            path: "/import",
            permission: "IMPORT_DATA",
            allowed: canImportData,
        },
        {
            icon: Download,
            iconColor: "#1a9ddf",
            title: "Export Data",
            desc: "Download real CSV exports of any dataset in the system.",
            metric: "Live data",
            path: "/export",
            permission: "EXPORT_DATA",
            allowed: canExportData,
        },
    ];

    const visibleTiles = tiles.filter((tile) => tile.allowed);
    const loading = authLoading || loadingUsers || loadingDepartments;

    if (loading) {
        return (
            <section className="workspace">
                <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>
                    Loading overview…
                </div>
            </section>
        );
    }

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">General / Home</div>

                    <div className="workspace-title-row">
                        <h1>Company Overview</h1>
                    </div>

                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Everything at a glance — navigate to sections available to your role.
                    </p>
                </div>
            </div>

            {visibleTiles.length === 0 ? (
                <div
                    className="workspace-panel"
                    style={{
                        padding: 24,
                        color: "var(--muted)",
                        fontSize: 14,
                    }}
                >
                    Your account does not have access to any workspace sections yet.
                </div>
            ) : (
                <div className="home-grid">
                    {visibleTiles.map((tile) => {
                        const Icon = tile.icon;

                        return (
                            <div
                                key={tile.path}
                                className="nav-tile"
                                onClick={() => navigate(tile.path)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        navigate(tile.path);
                                    }
                                }}
                            >
                                <div
                                    className="nav-tile-icon"
                                    style={{ color: tile.iconColor }}
                                >
                                    <Icon size={20} />
                                </div>

                                <div className="nav-tile-title">{tile.title}</div>

                                <div className="nav-tile-desc">{tile.desc}</div>

                                <div className="nav-tile-footer">
                                    <span className="nav-tile-metric">{tile.metric}</span>

                                    <span className="nav-tile-link">
                                        Go <ArrowRight size={12} />
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}