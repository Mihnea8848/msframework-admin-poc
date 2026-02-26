import { Menu, Search, Download } from "lucide-react";

export default function Topbar({ onOpenSidebar }) {
    return (
        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 12 }}>
            {/* Mobile hamburger */}
            <button
                onClick={onOpenSidebar}
                className="card"
                style={{
                    width: 42,
                    height: 42,
                    display: "grid",
                    placeItems: "center",
                    background: "transparent",
                    cursor: "pointer",
                }}
                aria-label="Open sidebar"
                title="Open menu"
            >
                <Menu size={18} />
            </button>

            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.2 }}>
                Dashboard <span className="accent">Overview</span>
            </div>

            <div style={{ flex: 1 }} />

            {/* Search */}
            <div
                className="card"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    width: "min(420px, 46vw)",
                    background: "var(--card-2)",
                }}
            >
                <Search size={16} style={{ color: "var(--muted)" }} />
                <input
                    placeholder="Search"
                    style={{
                        flex: 1,
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        color: "var(--text)",
                    }}
                />
            </div>

            <button className="btn-brand" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Download size={16} />
                Download
            </button>
        </div>
    );
}