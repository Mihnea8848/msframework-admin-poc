import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchUsers } from "../auth/auth";
import { get } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, hasRole } from "../auth/permissions";
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
                const data = await get("/api/departments");

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
        ? users.filter((u) => hasRole(u, "ADMIN")).length
        : 0;

    const tiles = [
        {
            icon: UsersRound,
            title: "User Management",
            desc: hasPermission(user, "USER_UPDATE")
                ? "View and manage the members of your organisation."
                : "Browse everyone in your organisation and their roles.",
            metric: `${users.length} total · ${activeUsers} active`,
            path: "/users",
            permission: "USER_READ",
            allowed: canReadUsers,
        },
        {
            icon: Building2,
            title: "Departments",
            desc: "Create and organise departments and see who belongs to each.",
            metric: `${departments.length} department${departments.length !== 1 ? "s" : ""}`,
            path: "/departments",
            permission: "DEPARTMENT_READ",
            allowed: canReadDepartments,
        },
        {
            icon: Bell,
            title: "Notifications",
            desc: "Full audit log of every action taken across the platform.",
            metric: "Audit events",
            path: "/notifications",
            permission: "AUDIT_READ",
            allowed: canReadAudit,
        },
        {
            icon: Database,
            title: "Database",
            desc: "Browse the live schema and row counts of every application table.",
            metric: "Live schema",
            path: "/database",
            permission: "DATABASE_READ",
            allowed: canReadDatabase,
        },
        {
            icon: Shield,
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
            title: "Payments",
            desc: "Proof-of-concept payments view with sample transactions.",
            metric: "Demo data",
            path: "/payments",
            permission: "PAYMENTS_READ",
            allowed: canReadPayments,
        },
        {
            icon: Upload,
            title: "Import Data",
            desc: "Upload CSV files to create users and departments in bulk.",
            metric: "CSV supported",
            path: "/import",
            permission: "IMPORT_DATA",
            allowed: canImportData,
        },
        {
            icon: Download,
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
                        <h1>Multimedia Entertainment Hub</h1>
                    </div>

                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Everything at a glance. Open the sections your role can use.
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
                                <div className="nav-tile-icon">
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