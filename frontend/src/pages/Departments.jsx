import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, hasRole } from "../auth/permissions";
import { Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { del, get, post, put } from "../api/client";
import Modal, { ModalActions } from "../ui/Modal.jsx";
import PageHeader from "../ui/PageHeader.jsx";

// Curated swatches the user can pick from. Each key is a CSS class (flat colour, see theme.css).
const COLOR_SWATCHES = [
    { label: "Azure", cssClass: "avatar-azure" },
    { label: "Rose", cssClass: "avatar-rose" },
    { label: "Cyan", cssClass: "avatar-cyan" },
    { label: "Magenta", cssClass: "avatar-magenta" },
    { label: "Amber", cssClass: "avatar-amber" },
    { label: "Gold", cssClass: "avatar-gold" },
    { label: "Violet", cssClass: "avatar-violet" },
    { label: "Jade", cssClass: "avatar-jade" },
    { label: "Sky", cssClass: "avatar-sky" },
    { label: "Coral", cssClass: "avatar-coral" },
    { label: "Orange", cssClass: "avatar-orange" },
    { label: "Plum", cssClass: "avatar-plum" },
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

export default function Departments() {
    const { user, loading: authLoading } = useAuth();

    const currentUserIsAdmin = hasRole(user, "ADMIN");
    const currentUserDepartmentId = user?.departmentId;

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
    const [loadError, setLoadError] = useState(null);
    const [formError, setFormError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);

    const fetchDepartments = useCallback(async () => {
        try {
            const data = await get("/api/departments");
            setDepartments(Array.isArray(data) ? data : []);
            setLoadError(null);
        } catch (err) {
            setLoadError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError(null);
        const name = nameInput.trim();
        if (!name) { setFormError("Department name is required."); return; }

        setBusy(true);
        try {
            if (editingDept) {
                await put(`/api/departments/${editingDept.id}`, { name, color: colorInput });
                setNotice(`Saved ${name}.`);
            } else {
                await post("/api/departments", { name, color: colorInput });
                setNotice(`Created ${name}.`);
            }
            setIsModalOpen(false);
            setEditingDept(null);
            await fetchDepartments();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const confirmDelete = async () => {
        if (!deptToDelete) return;
        setBusy(true);
        setFormError(null);
        try {
            await del(`/api/departments/${deptToDelete.id}`);
            setNotice(`Deleted ${deptToDelete.name}.`);
            setIsDeleteModalOpen(false);
            setDeptToDelete(null);
            await fetchDepartments();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const openEditModal = (dept) => {
        setEditingDept(dept);
        setNameInput(dept.name);
        setColorInput(dept.color ?? DEFAULT_COLOR);
        setFormError(null);
        setIsModalOpen(true);
    };
    const openCreateModal = () => {
        setEditingDept(null);
        setNameInput("");
        setColorInput(DEFAULT_COLOR);
        setFormError(null);
        setIsModalOpen(true);
    };
    const openDeleteModal = (dept) => { setDeptToDelete(dept); setFormError(null); setIsDeleteModalOpen(true); };
    const closeModal = () => {
        if (busy) return;
        setIsModalOpen(false);
        setEditingDept(null);
        setNameInput("");
        setColorInput(DEFAULT_COLOR);
        setFormError(null);
    };
    const closeDeleteModal = () => {
        if (busy) return;
        setIsDeleteModalOpen(false);
        setDeptToDelete(null);
        setFormError(null);
    };

    if (loading || authLoading) {
        return (
            <div className="workspace">
                <h1 style={{ padding: "40px" }}>Loading departments...</h1>
            </div>
        );
    }

    return (
        <section className="workspace">
            <PageHeader
                breadcrumb="Ventures / Department Management"
                title="Departments"
                count={departments.length}
                subtitle="Performance and budget figures are illustrative sample data; member counts are live."
                actions={canCreateDepartments && (
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="auth-primary"
                        style={{ padding: "0 24px", minWidth: 160 }}
                    >
                        + Add Department
                    </button>
                )}
            />

            {loadError && (
                <div className="inline-error page-banner" role="alert">
                    Failed to load departments: {loadError}{" "}
                    <button type="button" className="btn-secondary btn-small" onClick={fetchDepartments}>Retry</button>
                </div>
            )}
            {notice && <div className="inline-success page-banner" role="status" onClick={() => setNotice(null)}>{notice}</div>}

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
                                    <th style={{ width: 200, paddingLeft: 24 }}>Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {departments.map((dept) => {
                                const { perfPct, isUp, budgetUsed, seed } = deptStats(dept);
                                const TrendIcon = isUp ? TrendingUp : TrendingDown;
                                const trendColor = isUp ? "var(--success)" : "var(--danger)";
                                const avatarCls = dept.color ?? DEFAULT_COLOR;

                                const isOwnDepartment =
                                    String(dept.id) === String(currentUserDepartmentId);

                                const canEditThisDepartment =
                                    canEditDepartments && (currentUserIsAdmin || isOwnDepartment);

                                const canDeleteThisDepartment = canDeleteDepartments;
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
                                                <div style={{ height: 5, borderRadius: 999, background: "var(--border-faint)", overflow: "hidden" }}>
                                                    <div style={{
                                                        height: "100%", width: `${budgetUsed}%`, borderRadius: 999,
                                                        background: budgetUsed > 80 ? "var(--danger)" : budgetUsed > 60 ? "var(--status-warn-fg)" : "var(--success)",
                                                        transition: "width 0.4s ease",
                                                    }} />
                                                </div>
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        {(canEditDepartments || canDeleteDepartments) && (
                                            <td style={{ paddingLeft: 24 }}>
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    {canEditThisDepartment ? (
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
                                                    ) : (
                                                        <span style={{ color: "var(--muted)", fontSize: 12 }}>
                                                            Locked
                                                        </span>
                                                    )}

                                                    {canDeleteThisDepartment && (
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
                                                                borderColor: "var(--status-danger-border)",
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
                <Modal
                    title={editingDept ? "Edit Department" : "New Department"}
                    subtitle="Configure the details for this organisation branch."
                    onClose={closeModal}
                    busy={busy}
                >
                    <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: 0 }}>
                        <div className="auth-field">
                            <label className="auth-label" htmlFor="dept-name">Department name</label>
                            <input id="dept-name" autoFocus className="auth-input" placeholder="e.g. Engineering" maxLength={60}
                                value={nameInput} onChange={(e) => setNameInput(e.target.value)} required />
                        </div>

                        <div className="auth-field" style={{ marginTop: 16 }}>
                            <label className="auth-label">Department colour</label>

                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                                <div className={`avatar ${colorInput}`} style={{ width: 44, height: 44, fontSize: 15, borderRadius: 12, flexShrink: 0 }}>
                                    {deptInitials(nameInput || "Dept")}
                                </div>
                                <span style={{ color: "var(--muted-strong)", fontSize: 13 }}>
                                    {swatchByClass(colorInput).label}
                                </span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                                {COLOR_SWATCHES.map((sw) => (
                                    <button
                                        key={sw.cssClass}
                                        type="button"
                                        className={sw.cssClass}
                                        title={sw.label}
                                        aria-label={sw.label}
                                        aria-pressed={colorInput === sw.cssClass}
                                        onClick={() => setColorInput(sw.cssClass)}
                                        style={{
                                            width: 36, height: 36, borderRadius: 2,
                                            border: colorInput === sw.cssClass ? "2px solid var(--text)" : "2px solid transparent",
                                            cursor: "pointer",
                                            transition: "border-color 120ms ease, transform 120ms ease",
                                            transform: colorInput === sw.cssClass ? "scale(1.15)" : "scale(1)",
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {formError && <div className="inline-error" role="alert" style={{ marginTop: 14 }}>{formError}</div>}

                        <ModalActions>
                            <button type="button" onClick={closeModal} className="btn-secondary" disabled={busy}>Cancel</button>
                            <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                        </ModalActions>
                    </form>
                </Modal>
            )}

            {/* ── Delete Confirmation Modal ── */}
            {isDeleteModalOpen && deptToDelete && (
                <Modal title="Delete Department?" onClose={closeDeleteModal} busy={busy} maxWidth={420}>
                    <p style={{ color: "var(--muted)", fontSize: 14 }}>
                        You are about to remove <strong style={{ color: "var(--text)" }}>{deptToDelete.name}</strong>.
                        {deptToDelete.memberCount > 0
                            ? ` Its ${deptToDelete.memberCount} member${deptToDelete.memberCount === 1 ? "" : "s"} will be kept but left without a department.`
                            : " It has no members."}{" "}
                        This cannot be undone.
                    </p>
                    {formError && <div className="inline-error" role="alert">{formError}</div>}
                    <ModalActions>
                        <button type="button" onClick={closeDeleteModal} className="btn-secondary" disabled={busy}>Keep it</button>
                        <button type="button" onClick={confirmDelete} className="btn-danger" disabled={busy}>
                            {busy ? "Deleting…" : "Delete"}
                        </button>
                    </ModalActions>
                </Modal>
            )}
        </section>
    );
}