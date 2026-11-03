import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import QuickActions from "../ui/QuickActions.jsx";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import { PAGES } from "../routes/navigation";
import { get } from "../api/client";
import { getLastSeenAuditId, onAuditSeen } from "../utils/auditSeen";

const POLL_MS = 30000;
const BADGE_LIMIT = 50;

function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function NavGroup({ title, items, onNavigate }) {
    const location = useLocation();
    if (items.length === 0) return null;

    return (
        <div className="sidebar-group">
            <div className="sidebar-group-title">{title}</div>
            <nav className="sidebar-nav">
                {items.map((item) => {
                    const isActive = location.pathname === item.path;
                    const IconComponent = item.icon;
                    return (
                        <Link
                            key={item.key}
                            to={item.path}
                            className={`sidebar-link ${isActive ? "active" : ""}`}
                            onClick={onNavigate}
                        >
                            <span className="sidebar-link-main">
                                <IconComponent size={18} className="sidebar-icon" />
                                <span>{item.label}</span>
                            </span>
                            {item.badge ? <span className="sidebar-badge">{item.badge}</span> : null}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

export default function Sidebar({ onNavigate }) {
    const { user } = useAuth();
    const [qaOpen, setQaOpen] = useState(false);
    const [events, setEvents] = useState([]);
    const [lastSeen, setLastSeen] = useState(() => getLastSeenAuditId(user));

    const canReadAudit = hasPermission(user, "AUDIT_READ");

    useEffect(() => {
        if (!canReadAudit) return undefined;
        let alive = true;
        const fetchEvents = () => get(`/api/audit?limit=${BADGE_LIMIT}`)
            .then((data) => { if (alive) setEvents(Array.isArray(data) ? data : []); })
            .catch(() => { if (alive) setEvents([]); });
        fetchEvents();
        const id = setInterval(fetchEvents, POLL_MS);
        return () => {
            alive = false;
            clearInterval(id);
        };
    }, [canReadAudit]);

    useEffect(() => onAuditSeen(() => setLastSeen(getLastSeenAuditId(user))), [user]);

    useEffect(() => {
        function onKey(e) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setQaOpen(true);
            } else if (e.key === "/" && !e.metaKey && !e.ctrlKey && !isTypingTarget(e.target)) {
                e.preventDefault();
                setQaOpen(true);
            }
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const unread = canReadAudit ? events.filter((ev) => ev.id > lastSeen).length : 0;
    const badge = unread === 0 ? null : unread >= BADGE_LIMIT ? `${BADGE_LIMIT}+` : String(unread);

    const visible = PAGES
        .filter((p) => hasPermission(user, p.permission))
        .map((p) => (p.key === "notifications" ? { ...p, badge } : p));

    return (
        <>
            <div className="sidebar-inner">
                <div className="sidebar-brand">
                    <div className="brand-pill" title="Organisation">
                        <Building2 size={15} />
                        <span>Company</span>
                    </div>
                </div>

                <div className="sidebar-actions">
                    <button type="button" className="quick-action" onClick={() => setQaOpen(true)}>
                        <span>Quick actions</span>
                        <kbd>⌘K</kbd>
                    </button>
                    <button
                        type="button"
                        className="search-shortcut"
                        aria-label="Open quick actions (/)"
                        title="Press / to search"
                        onClick={() => setQaOpen(true)}
                    >
                        /
                    </button>
                </div>

                <NavGroup title="General" items={visible.filter((p) => p.group === "General")} onNavigate={onNavigate} />
                <NavGroup title="Ventures" items={visible.filter((p) => p.group === "Ventures")} onNavigate={onNavigate} />
            </div>

            <QuickActions open={qaOpen} onClose={() => setQaOpen(false)} />
        </>
    );
}
