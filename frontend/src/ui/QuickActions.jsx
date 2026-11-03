import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import { PAGES } from "../routes/navigation";

export default function QuickActions({ open, onClose }) {
    const { user } = useAuth();
    const [query, setQuery] = useState("");
    const [focusedIdx, setFocusedIdx] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    const allowed = useMemo(() => PAGES.filter((p) => hasPermission(user, p.permission)), [user]);

    const q = query.trim().toLowerCase();
    const filtered = q
        ? allowed.filter((r) => r.label.toLowerCase().includes(q) || r.path.toLowerCase().includes(q))
        : allowed;

    useEffect(() => {
        if (!open) return undefined;
        const id = setTimeout(() => inputRef.current?.focus(), 30);
        return () => clearTimeout(id);
    }, [open]);

    function close() {
        setQuery("");
        setFocusedIdx(0);
        onClose();
    }

    function go(path) {
        navigate(path);
        close();
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
            close();
        }
    }

    if (!open) return null;

    const grouped = filtered.reduce((acc, r) => {
        (acc[r.group] = acc[r.group] || []).push(r);
        return acc;
    }, {});

    let runningIdx = 0;

    return createPortal(
        <div className="qa-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            <div className="qa-modal" onKeyDown={handleKey} role="dialog" aria-label="Quick actions">
                <div className="qa-search-row">
                    <Search size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
                    <input
                        ref={inputRef}
                        className="qa-search-input"
                        placeholder="Search pages…"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setFocusedIdx(0); }}
                    />
                    {query && (
                        <button
                            type="button"
                            style={{ fontSize: 11, color: "var(--muted)", padding: "2px 6px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel-muted)", cursor: "pointer" }}
                            onClick={() => { setQuery(""); setFocusedIdx(0); }}
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
