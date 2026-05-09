import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchUsers } from "../auth/auth";
import {
    ArrowRight, Bell, Building2, CreditCard, Database,
    Download, Shield, Upload, UsersRound,
} from "lucide-react";

export default function HomePage() {
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchUsers().then(setUsers).catch(() => {});
        fetch("/api/departments").then((r) => r.json()).then(setDepartments).catch(() => {});
    }, []);

    const activeUsers = users.filter((u) => (u.status || "").toLowerCase() === "active").length;
    const admins = users.filter((u) => u.role === "ADMIN").length;

    const tiles = [
        {
            icon: UsersRound,
            iconColor: "#28beef",
            title: "User Management",
            desc: "View, invite, and manage all members in your organisation.",
            metric: `${users.length} total · ${activeUsers} active`,
            path: "/users",
        },
        {
            icon: Building2,
            iconColor: "#bb2eb8",
            title: "Departments",
            desc: "Create and organise departments, track budgets and performance.",
            metric: `${departments.length} department${departments.length !== 1 ? "s" : ""}`,
            path: "/departments",
        },
        {
            icon: Bell,
            iconColor: "#f0a832",
            title: "Notifications",
            desc: "Full audit log of every action taken across the platform.",
            metric: "10 recent events",
            path: "/notifications",
        },
        {
            icon: Database,
            iconColor: "#2dd881",
            title: "Database",
            desc: "Browse live and mock databases — Users, Departments, Finance.",
            metric: "3 databases",
            path: "/database",
        },
        {
            icon: Shield,
            iconColor: "#ff6a5f",
            title: "Security",
            desc: "Monitor your security score, open vulnerabilities, and alerts.",
            metric: `${admins} admin account${admins !== 1 ? "s" : ""}`,
            path: "/security",
        },
        {
            icon: CreditCard,
            iconColor: "#d2ff72",
            title: "Payments",
            desc: "View balance, send payments, and review transaction history.",
            metric: "$24,860.00 balance",
            path: "/payments",
        },
        {
            icon: Upload,
            iconColor: "#6c32db",
            title: "Import Data",
            desc: "Upload CSV files to import users, departments, and more.",
            metric: "CSV supported",
            path: "/import",
        },
        {
            icon: Download,
            iconColor: "#1a9ddf",
            title: "Export Data",
            desc: "Download real CSV exports of any dataset in the system.",
            metric: "Live data",
            path: "/export",
        },
    ];

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">General / Home</div>
                    <div className="workspace-title-row">
                        <h1>Company Overview</h1>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Everything at a glance — navigate to any section from here.
                    </p>
                </div>
            </div>

            <div className="home-grid">
                {tiles.map((tile) => {
                    const Icon = tile.icon;
                    return (
                        <div
                            key={tile.path}
                            className="nav-tile"
                            onClick={() => navigate(tile.path)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && navigate(tile.path)}
                        >
                            <div className="nav-tile-icon" style={{ color: tile.iconColor }}>
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
        </section>
    );
}
