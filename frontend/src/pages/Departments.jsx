import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import { Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";

// Curated swatches the user can pick from — each maps to a CSS class + a preview hex
const COLOR_SWATCHES = [
    { label: "Azure", cssClass: "avatar-azure", hex: "#2952ff" },
    { label: "Rose", cssClass: "avatar-rose", hex: "#cb3a77" },
    { label: "Cyan", cssClass: "avatar-cyan", hex: "#0078c8" },
    { label: "Magenta", cssClass: "avatar-magenta", hex: "#bb2eb8" },
    { label: "Amber", cssClass: "avatar-amber", hex: "#f18d1c" },
    { label: "Gold", cssClass: "avatar-gold", hex: "#d59b0b" },
    { label: "Violet", cssClass: "avatar-violet", hex: "#6c32db" },
    { label: "Jade", cssClass: "avatar-jade", hex: "#117d5d" },
    { label: "Sky", cssClass: "avatar-sky", hex: "#1a9ddf" },
    { label: "Coral", cssClass: "avatar-coral", hex: "#dd5a3a" },
    { label: "Orange", cssClass: "avatar-orange", hex: "#df7f12" },
    { label: "Plum", cssClass: "avatar-plum", hex: "#9d3ac0" },
];

const DEFAULT_COLOR = "avatar-azure";

function swatchByClass(cls) {
    return COLOR_SWATCHES.find((s) => s.cssClass === cls) ?? COLOR_SWATCHES[0];
}

function deptInitials(name) {
    if (!name) return "??";
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// Deterministic per-dept fake stats (performance + budget) — stable across renders
function deptStats(dept) {
    const seed = dept.id * 7919;
    const perfPct = 40 + (dept.id * 37 + 11) % 55;
    const isUp = (dept.id % 3) !== 0;
    const budgetUsed = 30 + (dept.id * 53 + 7) % 65;
    return { perfPct, isUp, budgetUsed, seed };
}

function sparklinePath(seed, width = 80, height = 28, points = 8) {
    let s = seed;
    const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
    const values = Array.from({ length: points }, () => rand());
    const min = Math.min(...values);
    const max = Math.max(...values);
    const norm = values.map((v) => (max === min ? 0.5 : (v - min) / (max - min)));
    return norm.map((v, i) => `${(i / (points - 1)) * width},${height - v * height}`).join(" ");
}

function Sparkline({ seed, isUp }) {
    const color = isUp ? "var(--success)" : "var(--danger)";
    return (
        <svg width="80" height="28" viewBox="0 0 80 28" fill="none" style={{ display: "block", flexShrink: 0 }}>
            <polyline points={sparklinePath(seed)} stroke={color} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" fill="none" opacity="0.85" />
        </svg>
    );
}

// ── Modal overlay — always on top ──────────────────────────────────────────────
function ModalOverlay({ children }) {
    return (
        <div style={{
            position: "fixed", inset: 0,
            zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(10px)",
        }}>
            {children}
        </div>
    );
}

export default function Departments() {
    const { user, loading: authLoading } = useAuth();

    const canCreateDepartments = hasPermission(user, "DEPARTMENT_CREATE");
    const canEditDepartments = hasPermission(user, "DEPARTMENT_UPDATE");
    const canDeleteDepartments = hasPermission(user, "DEPARTMENT_DELETE");
    const [departments, setDepartments] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState(null);
    const [deptToDelete, setDeptToDelete] = useState(null);
    const [nameInput, setNameInput] = useState("");
    const [colorInput, setColorInput] = useState(DEFAULT_COLOR);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchDepartments(); }, []);

    const fetchDepartments = async () => {
        try {
            const res = await fetch("/api/departments");
            const data = await res.json();

            const sorted = [...data].sort((a, b) => a.id - b.id);

            setDepartments(sorted);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const url = editingDept ? `/api/departments/${editingDept.id}` : "/api/departments";
        const method = editingDept ? "PUT" : "POST";
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: nameInput, color: colorInput }),
        });
        if (res.ok) { closeModal(); fetchDepartments(); }
    };

    const confirmDelete = async () => {
        if (!deptToDelete) return;
        const res = await fetch(`/api/departments/${deptToDelete.id}`, { method: "DELETE" });
        if (res.ok) { setIsDeleteModalOpen(false); setDeptToDelete(null); fetchDepartments(); }
    };

    const openEditModal = (dept) => {
        setEditingDept(dept);
        setNameInput(dept.name);
        setColorInput(dept.color ?? DEFAULT_COLOR);
        setIsModalOpen(true);
    };
    const openCreateModal = () => {
        setEditingDept(null);
        setNameInput("");
        setColorInput(DEFAULT_COLOR);
        setIsModalOpen(true);
    };
    const openDeleteModal = (dept) => { setDeptToDelete(dept); setIsDeleteModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setEditingDept(null); setNameInput(""); setColorInput(DEFAULT_COLOR); };

    if (loading || authLoading) {
        return (
            <div className="workspace">
                <h1 style={{ padding: "40px" }}>Loading departments...</h1>
            </div>
        );
    }

    return (
        <section className="workspace">
            {/* ── Header ── */}
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">Ventures / Department Management</div>
                    <div className="workspace-title-row">
                        <h1>Departments</h1>
                        <span className="workspace-count">{departments.length}</span>
                    </div>
                </div>
                {canCreateDepartments && (
                    <button
                        onClick={openCreateModal}
                        className="auth-primary"
                        style={{ padding: "0 24px", minWidth: 160, marginTop: "auto" }}
                    >
                        + Add Department
                    </button>
                )}
            </div>

            {/* ── Table ── */}
            <div className="workspace-panel">
                <div className="data-table-shell">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 48 }}>#</th>
                                <th>Department</th>
                                <th style={{ width: 140, paddingLeft: 24 }}>Members</th>
                                <th style={{ width: 220, paddingLeft: 24 }}>Performance</th>
                                <th style={{ width: 190, paddingLeft: 24 }}>Budget Used</th>
                                {(canEditDepartments || canDeleteDepartments) && (
                                    <th style={{ width: 200, paddingLeft: 24 }}>Actions</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {departments.map((dept) => {
                                const { perfPct, isUp, budgetUsed, seed } = deptStats(dept);
                                const TrendIcon = isUp ? TrendingUp : TrendingDown;
                                const trendColor = isUp ? "var(--success)" : "var(--danger)";
                                const avatarCls = dept.color ?? DEFAULT_COLOR;

                                return (
                                    <tr key={dept.id}>
                                        {/* ID */}
                                        <td style={{ color: "var(--muted)", fontFamily: "monospace", fontSize: 12 }}>
                                            {dept.id}
                                        </td>

                                        {/* Name + avatar */}
                                        <td>
                                            <div className="member-cell">
                                                <div className={`avatar ${avatarCls}`}>{deptInitials(dept.name)}</div>
                                                <span style={{ fontWeight: 600 }}>{dept.name}</span>
                                            </div>
                                        </td>

                                        {/* Members — real count from DB */}
                                        <td style={{ paddingLeft: 24 }}>
                                            <span style={{ fontWeight: 700 }}>{dept.memberCount ?? 0}</span>
                                            <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 4 }}>members</span>
                                        </td>

                                        {/* Performance */}
                                        <td style={{ paddingLeft: 24 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <TrendIcon size={14} color={trendColor} />
                                                <span style={{ color: trendColor, fontWeight: 700, fontSize: 13, minWidth: 36 }}>
                                                    {perfPct}%
                                                </span>
                                                <Sparkline seed={seed} isUp={isUp} />
                                            </div>
                                        </td>

                                        {/* Budget used */}
                                        <td style={{ paddingLeft: 24 }}>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 120 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                                    <span style={{ color: "var(--muted-strong)", fontWeight: 600 }}>{budgetUsed}%</span>
                                                    <span style={{ color: "var(--muted)" }}>used</span>
                                                </div>
                                                <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                                                    <div style={{
                                                        height: "100%", width: `${budgetUsed}%`, borderRadius: 999,
                                                        background: budgetUsed > 80 ? "var(--danger)" : budgetUsed > 60 ? "#f0a832" : "var(--success)",
                                                        transition: "width 0.4s ease",
                                                    }} />
                                                </div>
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        {(canEditDepartments || canDeleteDepartments) && (
                                            <td style={{ paddingLeft: 24 }}>
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    {canEditDepartments && (
                                                        <button
                                                            onClick={() => openEditModal(dept)}
                                                            className="topbar-icon-button"
                                                            aria-label="Edit"
                                                            style={{
                                                                width: "auto",
                                                                padding: "0 12px",
                                                                gap: 6,
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                fontSize: 12,
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            <Pencil size={13} /> Edit
                                                        </button>
                                                    )}

                                                    {canDeleteDepartments && (
                                                        <button
                                                            onClick={() => openDeleteModal(dept)}
                                                            className="topbar-icon-button"
                                                            aria-label="Delete"
                                                            style={{
                                                                width: "auto",
                                                                padding: "0 12px",
                                                                gap: 6,
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                fontSize: 12,
                                                                fontWeight: 600,
                                                                color: "var(--danger)",
                                                                borderColor: "rgba(255,106,95,0.25)",
                                                            }}
                                                        >
                                                            <Trash2 size={13} /> Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Create / Edit Modal ── */}
            {isModalOpen && (
                <ModalOverlay>
                    <div style={{ background: "var(--panel)", border: "1px solid var(--line-strong)", borderRadius: 20, padding: "36px 32px", width: "90%", maxWidth: 440 }}>
                        <h2 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>
                            {editingDept ? "Edit Department" : "New Department"}
                        </h2>
                        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 28 }}>
                            Configure the details for this organisation branch.
                        </p>

                        <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: 0 }}>
                            {/* Name */}
                            <div className="auth-field">
                                <label className="auth-label">Department name</label>
                                <input autoFocus className="auth-input" placeholder="e.g. Engineering"
                                    value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
                            </div>

                            {/* Colour picker */}
                            <div className="auth-field" style={{ marginTop: 16 }}>
                                <label className="auth-label">Department colour</label>

                                {/* Live preview */}
                                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                                    <div className={`avatar ${colorInput}`} style={{ width: 44, height: 44, fontSize: 15, borderRadius: 12, flexShrink: 0 }}>
                                        {deptInitials(nameInput || "Dept")}
                                    </div>
                                    <span style={{ color: "var(--muted-strong)", fontSize: 13 }}>
                                        {swatchByClass(colorInput).label}
                                    </span>
                                </div>

                                {/* Swatch grid */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                                    {COLOR_SWATCHES.map((sw) => (
                                        <button
                                            key={sw.cssClass}
                                            type="button"
                                            title={sw.label}
                                            onClick={() => setColorInput(sw.cssClass)}
                                            style={{
                                                width: 36, height: 36, borderRadius: 10,
                                                background: `linear-gradient(135deg, ${sw.hex}cc, ${sw.hex})`,
                                                border: colorInput === sw.cssClass
                                                    ? "2px solid var(--text)"
                                                    : "2px solid transparent",
                                                cursor: "pointer",
                                                outline: "none",
                                                transition: "border-color 120ms ease, transform 120ms ease",
                                                transform: colorInput === sw.cssClass ? "scale(1.15)" : "scale(1)",
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                                <button type="button" onClick={closeModal} className="auth-primary"
                                    style={{ flex: 1, background: "none", border: "1px solid var(--line-strong)" }}>
                                    Cancel
                                </button>
                                <button type="submit" className="auth-primary" style={{ flex: 1 }}>
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </ModalOverlay>
            )}

            {/* ── Delete Confirmation Modal ── */}
            {isDeleteModalOpen && (
                <ModalOverlay>
                    <div style={{ background: "var(--panel)", border: "1px solid var(--line-strong)", borderRadius: 20, padding: "36px 32px", width: "90%", maxWidth: 400, textAlign: "center" }}>
                        <Trash2 size={36} color="var(--danger)" style={{ marginBottom: 16 }} />
                        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>Delete Department?</h2>
                        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 28 }}>
                            You are about to remove <strong>{deptToDelete?.name}</strong>. This cannot be undone.
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setIsDeleteModalOpen(false)} className="auth-primary"
                                style={{ flex: 1, background: "none", border: "1px solid var(--line-strong)" }}>
                                Keep it
                            </button>
                            <button onClick={confirmDelete} className="auth-primary"
                                style={{ flex: 1, background: "rgba(255,106,95,0.15)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
                                Delete
                            </button>
                        </div>
                    </div>
                </ModalOverlay>
            )}
        </section>
    );
}