import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import {
    Building2, Download, LogIn, LogOut, Shield, UserCheck, UserPlus, Key,
    Cable, Webhook, RefreshCw,
} from "lucide-react";

const TYPE_META = {
    user_login: { label: "Login", pill: "login", Icon: LogIn, color: "#28beef" },
    user_logout: { label: "Logout", pill: "login", Icon: LogOut, color: "#28beef" },
    user_created: { label: "User Created", pill: "created", Icon: UserPlus, color: "#2dd881" },
    dept_created: { label: "Dept Created", pill: "created", Icon: Building2, color: "#2dd881" },
    dept_updated: { label: "Dept Updated", pill: "changed", Icon: Building2, color: "#f0a832" },
    dept_deleted: { label: "Dept Deleted", pill: "security", Icon: Building2, color: "#ff6a5f" },
    email_changed: { label: "Email Changed", pill: "security", Icon: UserCheck, color: "#f0a832" },
    password_changed: { label: "Password", pill: "security", Icon: Key, color: "#f0a832" },
    password_reset_requested: { label: "Password reset requested", pill: "security", Icon: Key, color: "#ff6a5f" },
    password_reset_completed: { label: "Password reset completed", pill: "security", Icon: Key, color: "#f0a832" },
    key_generated: { label: "API Key", pill: "security", Icon: Key, color: "#bb2eb8" },
    key_revoked: { label: "Key Revoked", pill: "security", Icon: Key, color: "#ff6a5f" },
    connection_changed: { label: "Integration", pill: "changed", Icon: Cable, color: "#f0a832" },
    webhook_added: { label: "Webhook Added", pill: "created", Icon: Webhook, color: "#2dd881" },
    webhook_removed: { label: "Webhook Removed", pill: "security", Icon: Webhook, color: "#ff6a5f" },
    export_generated: { label: "Export", pill: "export", Icon: Download, color: "#bb2eb8" },
    import_completed: { label: "Import", pill: "export", Icon: RefreshCw, color: "#bb2eb8" },
    default: { label: "Event", pill: "changed", Icon: Shield, color: "#6b7568" },
};

function relTime(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

const FILTERS = ["All", "Login", "Users", "Departments", "Auth"];

function matchesFilter(ev, filter) {
    if (filter === "All") return true;
    if (filter === "Login") return ev.eventType === "user_login" || ev.eventType === "user_logout";
    if (filter === "Users") return ev.eventType.startsWith("user_") && ev.eventType !== "user_login" && ev.eventType !== "user_logout";
    if (filter === "Departments") return ev.eventType.startsWith("dept_");
    if (filter === "Auth") return ["email_changed", "password_changed", "key_generated", "key_revoked", "password_reset_requested"
        , "password_reset_completed"].includes(ev.eventType);
    return true;
}

export default function Notifications() {
    const { user, loading: authLoading } = useAuth();
    const canReadAudit = hasPermission(user, "AUDIT_READ");
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");

    useEffect(() => {
        if (authLoading || !canReadAudit) return;

        let alive = true;

        async function loadAuditEvents() {
            setLoading(true);

            try {
                const res = await fetch("/api/audit", { credentials: "include" });

                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || "Failed to load audit events");
                }

                const data = await res.json();

                if (alive) {
                    setEvents(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error(err);

                if (alive) {
                    setEvents([]);
                }
            } finally {
                if (alive) {
                    setLoading(false);
                }
            }
        }

        loadAuditEvents();

        return () => {
            alive = false;
        };
    }, [authLoading, canReadAudit]);

    const visible = events.filter((ev) => matchesFilter(ev, filter));
    if (authLoading || loading) {
        return (
            <section className="workspace">
                <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>
                    Loading events…
                </div>
            </section>
        );
    }

    if (!canReadAudit) {
        return (
            <section className="workspace">
                <div className="workspace-hero">
                    <div>
                        <div className="workspace-breadcrumb">General / Notifications</div>
                        <div className="workspace-title-row">
                            <h1>Notifications</h1>
                        </div>
                        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                            You do not have permission to view audit events.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">General / Notifications</div>
                    <div className="workspace-title-row">
                        <h1>Notifications</h1>
                        {events.length > 0 && (
                            <span className="sidebar-badge" style={{ fontSize: 13, padding: "3px 10px" }}>{events.length}</span>
                        )}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Audit trail of all activity across the platform.
                    </p>
                </div>
            </div>

            <div className="filter-chips-row">
                {FILTERS.map((f) => (
                    <button
                        key={f}
                        type="button"
                        className={`filter-chip${filter === f ? " active" : ""}`}
                        onClick={() => setFilter(f)}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <div className="audit-list">
                {loading && (
                    <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                        Loading events…
                    </div>
                )}
                {!loading && visible.length === 0 && (
                    <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                        No events in this category yet.
                    </div>
                )}
                {visible.map((ev) => {
                    const meta = TYPE_META[ev.eventType] || TYPE_META.default;
                    const Icon = meta.Icon;
                    return (
                        <div key={ev.id} className="audit-row">
                            <div className="audit-icon" style={{ background: `${meta.color}20`, color: meta.color }}>
                                <Icon size={14} />
                            </div>
                            <div className="audit-body">
                                <div className="audit-top">
                                    <span className="audit-actor">{ev.actorEmail}</span>
                                    <span className={`event-pill ${meta.pill}`}>{meta.label}</span>
                                    <span className="audit-time">{relTime(ev.createdAt)}</span>
                                </div>
                                <div className="audit-desc">{ev.description}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
