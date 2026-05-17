import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import QuickActions from "../ui/QuickActions.jsx";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";

import {
    Bell,
    BookText,
    Box,
    BriefcaseBusiness,
    Building2,
    Cable,
    ChevronDown,
    Clock3,
    CreditCard,
    Database,
    Download,
    Home,
    Palette,
    Shield,
    SquarePen,
    Upload,
    UsersRound,
} from "lucide-react";

function NavGroup({ title, items, user }) {
    const location = useLocation();

    const visibleItems = items.filter((item) => {
        if (!item.permission) return true;
        return hasPermission(user, item.permission);
    });

    if (visibleItems.length === 0) {
        return null;
    }

    return (
        <div className="sidebar-group">
            <div className="sidebar-group-title">{title}</div>

            <nav className="sidebar-nav">
                {visibleItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const IconComponent = item.icon;

                    return (
                        <Link
                            key={item.key}
                            to={item.path}
                            className={`sidebar-link ${isActive ? "active" : ""}`}
                        >
                            <span className="sidebar-link-main">
                                <IconComponent size={18} className="sidebar-icon" />
                                <span>{item.label}</span>
                            </span>

                            {item.badge ? (
                                <span className="sidebar-badge">{item.badge}</span>
                            ) : null}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

export default function Sidebar() {
    const { user, loading: authLoading } = useAuth();

    const [qaOpen, setQaOpen] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);

    const canReadAudit = hasPermission(user, "AUDIT_READ");
    const canEditWorkspace = hasPermission(user, "WORKSPACE_UPDATE");

    useEffect(() => {
        async function fetchNotificationCount() {
            if (authLoading || !canReadAudit) {
                setNotificationCount(0);
                return;
            }

            try {
                const res = await fetch("/api/audit", { credentials: "include" });

                if (!res.ok) {
                    setNotificationCount(0);
                    return;
                }

                const data = await res.json();

                if (Array.isArray(data)) {
                    setNotificationCount(data.length);
                } else {
                    setNotificationCount(0);
                }
            } catch {
                setNotificationCount(0);
            }
        }

        fetchNotificationCount().catch(() => { });

        function onKey(e) {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setQaOpen(true);
            }
        }

        document.addEventListener("keydown", onKey);

        return () => document.removeEventListener("keydown", onKey);
    }, [authLoading, canReadAudit]);

    const generalItems = [
        {
            key: "home",
            label: "Home",
            icon: Home,
            path: "/",
        },
        {
            key: "dashboard",
            label: "Dashboard",
            icon: Box,
            path: "/dashboard",
            permission: "DASHBOARD_READ",
        },
        {
            key: "notifications",
            label: "Notifications",
            icon: Bell,
            badge: notificationCount > 0 ? String(notificationCount) : null,
            path: "/notifications",
            permission: "AUDIT_READ",
        },
        {
            key: "appearance",
            label: "Appearance",
            icon: Palette,
            path: "/appearance",
            permission: "APPEARANCE_READ",
        },
        {
            key: "database",
            label: "Database",
            icon: Database,
            path: "/database",
            permission: "DATABASE_READ",
        },
        {
            key: "connections",
            label: "Connections",
            icon: Cable,
            path: "/connections",
            permission: "CONNECTIONS_READ",
        },
        {
            key: "timezones",
            label: "Timezones",
            icon: Clock3,
            path: "/timezones",
            permission: "TIMEZONES_READ",
        },
        {
            key: "documentation",
            label: "Documentation",
            icon: BookText,
            path: "/docs",
            permission: "DOCUMENTATION_READ",
        },
    ];

    const ventureItems = [
        {
            key: "authentication",
            label: "Authentication",
            icon: BriefcaseBusiness,
            path: "/auth",
            permission: "AUTH_SETTINGS_READ",
        },
        {
            key: "user-management",
            label: "User management",
            icon: UsersRound,
            path: "/users",
            permission: "USER_READ",
        },
        {
            key: "departments",
            label: "Departments",
            icon: Building2,
            path: "/departments",
            permission: "DEPARTMENT_READ",
        },
        {
            key: "security",
            label: "Security",
            icon: Shield,
            path: "/security",
            permission: "SECURITY_READ",
        },
        {
            key: "payments",
            label: "Payments",
            icon: CreditCard,
            path: "/payments",
            permission: "PAYMENTS_READ",
        },
        {
            key: "import-data",
            label: "Import data",
            icon: Upload,
            path: "/import",
            permission: "IMPORT_DATA",
        },
        {
            key: "export-data",
            label: "Export data",
            icon: Download,
            path: "/export",
            permission: "EXPORT_DATA",
        },
    ];

    if (authLoading) {
        return (
            <div className="sidebar-inner">
                <div className="sidebar-brand">
                    <button type="button" className="brand-pill">
                        <Building2 size={15} />
                        <span>Company</span>
                        <ChevronDown size={14} />
                    </button>
                </div>

                <div style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>
                    Loading menu...
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="sidebar-inner">
                <div className="sidebar-brand">
                    <button type="button" className="brand-pill">
                        <Building2 size={15} />
                        <span>Company</span>
                        <ChevronDown size={14} />
                    </button>

                    {canEditWorkspace && (
                        <button
                            type="button"
                            className="icon-square"
                            aria-label="Edit workspace"
                        >
                            <SquarePen size={16} />
                        </button>
                    )}
                </div>

                <div className="sidebar-actions">
                    <button
                        type="button"
                        className="quick-action"
                        onClick={() => setQaOpen(true)}
                    >
                        <span>Quick actions</span>
                        <kbd>⌘K</kbd>
                    </button>

                    <button
                        type="button"
                        className="search-shortcut"
                        aria-label="Search shortcut"
                        onClick={() => setQaOpen(true)}
                    >
                        /
                    </button>
                </div>

                <NavGroup title="General" items={generalItems} user={user} />
                <NavGroup title="Ventures" items={ventureItems} user={user} />
            </div>

            <QuickActions open={qaOpen} onClose={() => setQaOpen(false)} />
        </>
    );
}