import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
    Bell, BookText, Box, BriefcaseBusiness, Building2, Cable,
    Clock3, CreditCard, Database, Download, Home, Palette,
    Search, Shield, Upload, UsersRound,
} from "lucide-react";

const ALL_ROUTES = [
    { label: "Home", path: "/", icon: Home, group: "General" },
    { label: "Dashboard", path: "/dashboard", icon: Box, group: "General" },
    { label: "Notifications", path: "/notifications", icon: Bell, group: "General" },
    { label: "Appearance", path: "/appearance", icon: Palette, group: "General" },
    { label: "Database", path: "/database", icon: Database, group: "General" },
    { label: "Connections", path: "/connections", icon: Cable, group: "General" },
    { label: "Timezones", path: "/timezones", icon: Clock3, group: "General" },
    { label: "Documentation", path: "/docs", icon: BookText, group: "General" },
    { label: "Authentication", path: "/auth", icon: BriefcaseBusiness, group: "Ventures" },
    { label: "User Management", path: "/users", icon: UsersRound, group: "Ventures" },
    { label: "Departments", path: "/departments", icon: Building2, group: "Ventures" },
    { label: "Security", path: "/security", icon: Shield, group: "Ventures" },
    { label: "Payments", path: "/payments", icon: CreditCard, group: "Ventures" },
    { label: "Import Data", path: "/import", icon: Upload, group: "Ventures" },
    { label: "Export Data", path: "/export", icon: Download, group: "Ventures" },
];

export default function QuickActions({ open, onClose }) {
    const [query, setQuery] = useState("");
    const [focusedIdx, setFocusedIdx] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    const filtered = query.trim()
        ? ALL_ROUTES.filter((r) =>
            r.label.toLowerCase().includes(query.toLowerCase()) ||
            r.path.toLowerCase().includes(query.toLowerCase())
        )
        : ALL_ROUTES;

    useEffect(() => {
        if (open) {
            setQuery("");
            setFocusedIdx(0);
            setTimeout(() => inputRef.current?.focus(), 30);
        }
    }, [open]);

    useEffect(() => {
        setFocusedIdx(0);
    }, [query]);

    function go(path) {
        navigate(path);
        onClose();
    }

    function handleKey(e) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setFocusedIdx((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setFocusedIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && filtered[focusedIdx]) {
            go(filtered[focusedIdx].path);
        } else if (e.key === "Escape") {
            onClose();
        }
    }

    if (!open) return null;

    const grouped = filtered.reduce((acc, r) => {
        (acc[r.group] = acc[r.group] || []).push(r);
        return acc;
    }, {});

    let runningIdx = 0;

    return createPortal(
        <div className="qa-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="qa-modal" onKeyDown={handleKey}>
                <div className="qa-search-row">
                    <Search size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
                    <input
                        ref={inputRef}
                        className="qa-search-input"
                        placeholder="Search pages…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                        <button
                            style={{ fontSize: 11, color: "var(--muted)", padding: "2px 6px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel-muted)", cursor: "pointer" }}
                            onClick={() => setQuery("")}
                        >
                            Clear
                        </button>
                    )}
                </div>

                <div className="qa-results">
                    {filtered.length === 0 && (
                        <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                            No pages match &ldquo;{query}&rdquo;
                        </div>
                    )}
                    {Object.entries(grouped).map(([group, items]) => (
                        <div key={group}>
                            <div className="qa-section-label">{group}</div>
                            {items.map((item) => {
                                const idx = runningIdx++;
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={item.path}
                                        className={`qa-result${focusedIdx === idx ? " focused" : ""}`}
                                        onMouseEnter={() => setFocusedIdx(idx)}
                                        onClick={() => go(item.path)}
                                    >
                                        <div className="qa-result-icon">
                                            <Icon size={15} />
                                        </div>
                                        <span className="qa-result-label">{item.label}</span>
                                        <span className="qa-result-path">{item.path}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="qa-footer">
                    <span><kbd>↑↓</kbd> navigate</span>
                    <span><kbd>↵</kbd> open</span>
                    <span><kbd>Esc</kbd> close</span>
                </div>
            </div>
        </div>,
        document.body
    );
}
