import { useEffect, useState } from "react";
import { fetchUsers } from "../auth/auth";
import {
    Building2, Download, LogIn, Shield, UserCheck, UserPlus, Key,
} from "lucide-react";

const EVENT_TYPES = [
    { key: "login",    label: "Login",           pill: "login",    Icon: LogIn,      color: "#28beef" },
    { key: "created",  label: "User Created",    pill: "created",  Icon: UserPlus,   color: "#2dd881" },
    { key: "dept",     label: "Dept Created",    pill: "created",  Icon: Building2,  color: "#2dd881" },
    { key: "password", label: "Password Changed",pill: "changed",  Icon: Key,        color: "#f0a832" },
    { key: "role",     label: "Role Changed",    pill: "changed",  Icon: UserCheck,  color: "#f0a832" },
    { key: "export",   label: "Data Exported",   pill: "export",   Icon: Download,   color: "#bb2eb8" },
    { key: "security", label: "Security Alert",  pill: "security", Icon: Shield,     color: "#ff6a5f" },
];

function relTime(ms) {
    const diff = Date.now() - ms;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function generateLog(users, departments) {
    const events = [];
    const now = Date.now();

    const templates = [
        (u) => ({ type: "login",    actor: u.fullName || u.email, desc: "signed in" }),
        (u) => ({ type: "created",  actor: "System",              desc: `user ${u.fullName || u.email} was created` }),
        (u) => ({ type: "password", actor: u.fullName || u.email, desc: "changed their password" }),
        (u) => ({ type: "role",     actor: "Admin",               desc: `updated role for ${u.fullName || u.email}` }),
        (u) => ({ type: "export",   actor: u.fullName || u.email, desc: "exported user data as CSV" }),
    ];

    const deptTemplates = [
        (d) => ({ type: "dept",     actor: "Admin",               desc: `department "${d.name}" was created` }),
        (d) => ({ type: "security", actor: "System",              desc: `unusual access detected in ${d.name}` }),
    ];

    let t = now - 120000;

    users.slice(0, 7).forEach((u, i) => {
        const tmpl = templates[i % templates.length];
        const ev = tmpl(u);
        events.push({ ...ev, ts: t, id: `u-${i}` });
        t -= (30 + i * 12) * 60000;
    });

    departments.slice(0, 3).forEach((d, i) => {
        const tmpl = deptTemplates[i % deptTemplates.length];
        const ev = tmpl(d);
        events.push({ ...ev, ts: t, id: `d-${i}` });
        t -= (45 + i * 20) * 60000;
    });

    events.sort((a, b) => b.ts - a.ts);
    return events;
}

const FILTERS = ["All", "Login", "Users", "Departments", "Auth"];

export default function Notifications() {
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [filter, setFilter] = useState("All");

    useEffect(() => {
        fetchUsers().then(setUsers).catch(() => {});
        fetch("/api/departments").then((r) => r.json()).then(setDepartments).catch(() => {});
    }, []);

    const log = generateLog(users, departments);

    const typeFilter = {
        All: null,
        Login: ["login"],
        Users: ["created", "role", "password", "export"],
        Departments: ["dept"],
        Auth: ["password", "security"],
    };

    const visible = filter === "All"
        ? log
        : log.filter((e) => typeFilter[filter]?.includes(e.type));

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">General / Notifications</div>
                    <div className="workspace-title-row">
                        <h1>Notifications</h1>
                        <span className="sidebar-badge" style={{ fontSize: 13, padding: "3px 10px" }}>{log.length}</span>
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
                {visible.length === 0 && (
                    <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                        No events in this category yet.
                    </div>
                )}
                {visible.map((ev) => {
                    const evType = EVENT_TYPES.find((t) => t.key === ev.type) || EVENT_TYPES[0];
                    const Icon = evType.Icon;
                    return (
                        <div key={ev.id} className="audit-row">
                            <div className="audit-icon" style={{ background: `${evType.color}20`, color: evType.color }}>
                                <Icon size={14} />
                            </div>
                            <div className="audit-body">
                                <div className="audit-top">
                                    <span className="audit-actor">{ev.actor}</span>
                                    <span className={`event-pill ${evType.pill}`}>{evType.label}</span>
                                    <span className="audit-time">{relTime(ev.ts)}</span>
                                </div>
                                <div className="audit-desc">{ev.desc}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
