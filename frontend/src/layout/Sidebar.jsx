import { useMemo, useState } from "react";
import logo from "../assets/ms-banner-transparent.png";
import { LayoutDashboard, Users, Building2, FolderUp, Settings } from "lucide-react";

export default function Sidebar({ onNavigate }) {
    const items = useMemo(
        () => [
            { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
            { key: "users", label: "Users", icon: <Users size={18} /> },
            { key: "departments", label: "Departments", icon: <Building2 size={18} /> },
            { key: "resources", label: "Resources", icon: <FolderUp size={18} /> },
            { key: "settings", label: "Settings", icon: <Settings size={18} /> },
        ],
        []
    );

    // For now: local “active page” state (later: wire to React Router)
    const [active, setActive] = useState("dashboard");

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ padding: "6px 10px 14px 10px" }}>
                <img
                    src={logo}
                    alt="MEH Studios Incorporated"
                    style={{ width: "100%", height: "auto", opacity: 0.95 }}
                />
            </div>

            <div style={{ height: 1, background: "var(--border)", margin: "6px 10px 12px" }} />

            <nav style={{ flex: 1 }}>
                {items.map((it) => (
                    <div
                        key={it.key}
                        className={`nav-item ${active === it.key ? "active" : ""}`}
                        onClick={() => {
                            setActive(it.key);
                            onNavigate?.();
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                setActive(it.key);
                                onNavigate?.();
                            }
                        }}
                    >
                        <span style={{ opacity: 0.95 }}>{it.icon}</span>
                        <span style={{ fontWeight: 650 }}>{it.label}</span>
                    </div>
                ))}
            </nav>

            <div className="card" style={{ padding: 14, margin: "10px" }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Signed in as</div>
                <div style={{ marginTop: 6, fontWeight: 800 }}>MEH User</div>
                <div style={{ marginTop: 8, display: "flex", gap: 10 }}>
                    <button className="btn-brand" style={{ flex: 1 }}>Profile</button>
                </div>
            </div>
        </div>
    );
}