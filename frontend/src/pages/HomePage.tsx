import { useEffect, useState } from "react";
import {
    Activity,
    ArrowRight,
    Building2,
    CreditCard,
    Database,
    Download,
    Shield,
    Upload,
    UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fetchUsers } from "../auth/auth";
import { get } from "../api/client";
import type { DepartmentResponse, UserDto } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, hasRole } from "../auth/permissions";
import { pageByKey } from "../routes/navigation";
import type { PageKey } from "../routes/navigation";
import PageLink from "../shell/PageLink";
import PageHeader from "../ui/PageHeader";
import "../ui/surface.css";
import "./home.css";

interface Tile {
    key: PageKey;
    icon: LucideIcon;
    title: string;
    desc: string;
    metric: string;
    allowed: boolean;
}

const NOT_LOADED = "Could not load";

export default function HomePage() {
    const { user, loading: authLoading } = useAuth();

    const [users, setUsers] = useState<UserDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
    const [usersFailed, setUsersFailed] = useState(false);
    const [departmentsFailed, setDepartmentsFailed] = useState(false);
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
                    setUsersFailed(false);
                }
            } catch (err) {
                console.error("Fetch users error:", err);
                if (alive) {
                    setUsers([]);
                    setUsersFailed(true);
                }
            } finally {
                if (alive) setLoadingUsers(false);
            }
        }

        async function loadDepartments() {
            if (!canReadDepartments) {
                setDepartments([]);
                return;
            }
            setLoadingDepartments(true);
            try {
                const data = await get<DepartmentResponse[]>("/api/departments");
                if (alive) {
                    setDepartments(Array.isArray(data) ? data : []);
                    setDepartmentsFailed(false);
                }
            } catch (err) {
                console.error("Fetch departments error:", err);
                if (alive) {
                    setDepartments([]);
                    setDepartmentsFailed(true);
                }
            } finally {
                if (alive) setLoadingDepartments(false);
            }
        }

        void loadUsers();
        void loadDepartments();

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

    const tiles: Tile[] = [
        {
            key: "users",
            icon: UsersRound,
            title: "User Management",
            desc: hasPermission(user, "USER_UPDATE")
                ? "View and manage the members of your organisation."
                : "Browse everyone in your organisation and their roles.",
            metric: usersFailed ? NOT_LOADED : `${users.length} total · ${activeUsers} active`,
            allowed: canReadUsers,
        },
        {
            key: "departments",
            icon: Building2,
            title: "Departments",
            desc: "Create and organise departments and see who belongs to each.",
            metric: departmentsFailed
                ? NOT_LOADED
                : `${departments.length} department${departments.length !== 1 ? "s" : ""}`,
            allowed: canReadDepartments,
        },
        {
            key: "activity",
            icon: Activity,
            title: "Activity",
            desc: "Every sign-in and change across the platform, newest first.",
            metric: "Audit events",
            allowed: canReadAudit,
        },
        {
            key: "database",
            icon: Database,
            title: "Database",
            desc: "Browse the live schema and row counts of every application table.",
            metric: "Live schema",
            allowed: canReadDatabase,
        },
        {
            key: "security",
            icon: Shield,
            title: "Security",
            desc: "Monitor your security score, open vulnerabilities, and alerts.",
            metric: canReadUsers && !usersFailed
                ? `${admins} admin account${admins !== 1 ? "s" : ""}`
                : "Security center",
            allowed: canReadSecurity,
        },
        {
            key: "payments",
            icon: CreditCard,
            title: "Payments",
            desc: "Proof-of-concept payments view with sample transactions.",
            metric: "Demo data",
            allowed: canReadPayments,
        },
        {
            key: "import",
            icon: Upload,
            title: "Import Data",
            desc: "Upload CSV files to create users and departments in bulk.",
            metric: "CSV supported",
            allowed: canImportData,
        },
        {
            key: "export",
            icon: Download,
            title: "Export Data",
            desc: "Download real CSV exports of any dataset in the system.",
            metric: "Live data",
            allowed: canExportData,
        },
    ];

    const visibleTiles = tiles.filter((tile) => tile.allowed);
    const loading = authLoading || loadingUsers || loadingDepartments;

    return (
        <section className="ms-home">
            <PageHeader
                eyebrow="Overview"
                title="Multimedia Entertainment Hub"
                description="Everything at a glance. Open the sections your role can use."
            />

            {loading ? (
                <p className="ms-home__empty" role="status">Loading overview…</p>
            ) : visibleTiles.length === 0 ? (
                <p className="ms-home__empty">Your account does not have access to any workspace sections yet.</p>
            ) : (
                <ul className="ms-home__grid">
                    {visibleTiles.map((tile) => {
                        const page = pageByKey(tile.key);
                        if (!page) return null;
                        const Icon = tile.icon;
                        return (
                            <li key={tile.key}>
                                <PageLink page={page} current={false} className="ms-cut ms-home__tile">
                                    <span className="ms-home__icon" aria-hidden="true"><Icon /></span>
                                    <span className="ms-home__title">{tile.title}</span>
                                    <span className="ms-home__desc">{tile.desc}</span>
                                    <span className="ms-home__foot">
                                        <span className="ms-home__metric">{tile.metric}</span>
                                        <span className="ms-home__go" aria-hidden="true">
                                            Go <ArrowRight />
                                        </span>
                                    </span>
                                </PageLink>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
