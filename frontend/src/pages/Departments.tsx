import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Pencil, Plus, Trash2, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, hasRole } from "../auth/permissions";
import { del, get, post, put } from "../api/client";
import type { DepartmentResponse } from "../api/types";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Dialog, { DialogBody, DialogFooter } from "../ui/Dialog";
import PageHeader from "../ui/PageHeader";
import { SealBadge, SealMini } from "../ui/seal/Seal";
import { DEFAULT_COLOR, SEALS, sealForColor } from "../ui/seal/seals";
import "../ui/field.css";
import "../ui/list.css";
import "../ui/surface.css";
import "./departments.css";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

// Deterministic per-department sample stats (performance and budget), stable across renders.
function deptStats(dept: DepartmentResponse) {
    const seed = dept.id * 7919;
    const perfPct = 40 + (dept.id * 37 + 11) % 55;
    const isUp = (dept.id % 3) !== 0;
    const budgetUsed = 30 + (dept.id * 53 + 7) % 65;
    return { perfPct, isUp, budgetUsed, seed };
}

function sparklinePath(seed: number, width = 80, height = 28, points = 8) {
    let s = seed;
    const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
    const values = Array.from({ length: points }, () => rand());
    const min = Math.min(...values);
    const max = Math.max(...values);
    const norm = values.map((v) => (max === min ? 0.5 : (v - min) / (max - min)));
    return norm.map((v, i) => `${(i / (points - 1)) * width},${height - v * height}`).join(" ");
}

function SampleStats({ dept }: { dept: DepartmentResponse }) {
    const { perfPct, isUp, budgetUsed, seed } = deptStats(dept);
    const TrendIcon = isUp ? TrendingUp : TrendingDown;
    const budgetTone = budgetUsed > 80 ? "danger" : budgetUsed > 60 ? "warn" : "ok";
    return (
        <div className="ms-departments__sample">
            <span className="ms-tag">Sample data</span>
            <div className={`ms-departments__perf ms-departments__perf--${isUp ? "up" : "down"}`}>
                <span className="ms-departments__stat-label">Performance</span>
                <TrendIcon aria-hidden="true" />
                <span className="ms-departments__stat-value">{perfPct}%</span>
                <svg className="ms-departments__spark" width="80" height="28" viewBox="0 0 80 28" fill="none" aria-hidden="true">
                    <polyline points={sparklinePath(seed)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="none" />
                </svg>
            </div>
            <div className="ms-departments__budget">
                <span className="ms-departments__stat-label">Budget used</span>
                <span className="ms-departments__stat-value">{budgetUsed}%</span>
                <svg className={`ms-departments__bar ms-departments__bar--${budgetTone}`} viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true">
                    <rect className="ms-departments__bar-track" width="100" height="4" />
                    <rect className="ms-departments__bar-fill" width={budgetUsed} height="4" />
                </svg>
            </div>
        </div>
    );
}

export default function Departments() {
    const { user, loading: authLoading } = useAuth();

    const currentUserIsAdmin = hasRole(user, "ADMIN");
    const currentUserDepartmentId = user?.departmentId;

    const canCreateDepartments = hasPermission(user, "DEPARTMENT_CREATE");
    const canEditDepartments = hasPermission(user, "DEPARTMENT_UPDATE");
    const canDeleteDepartments = hasPermission(user, "DEPARTMENT_DELETE");

    const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<DepartmentResponse | null>(null);
    const [deptToDelete, setDeptToDelete] = useState<DepartmentResponse | null>(null);
    const [nameInput, setNameInput] = useState("");
    const [colorInput, setColorInput] = useState(DEFAULT_COLOR);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const fetchDepartments = useCallback(async () => {
        try {
            const data = await get<DepartmentResponse[]>("/api/departments");
            setDepartments(Array.isArray(data) ? data : []);
            setLoadError(null);
        } catch (err) {
            setLoadError(messageOf(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
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
            setFormError(messageOf(err));
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
            setFormError(messageOf(err));
        } finally {
            setBusy(false);
        }
    };

    const openEditModal = (dept: DepartmentResponse) => {
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
    const openDeleteModal = (dept: DepartmentResponse) => { setDeptToDelete(dept); setFormError(null); setIsDeleteModalOpen(true); };
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

    const showActions = canEditDepartments || canDeleteDepartments;
    const selectedSeal = sealForColor(colorInput).key;

    return (
        <section className="ms-departments">
            <PageHeader
                eyebrow="Ventures"
                title="Departments"
                count={loading || authLoading ? null : departments.length}
                description="The studio departments, their seals and members. Performance and budget figures are illustrative sample data; member counts are live."
                actions={canCreateDepartments && (
                    <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={openCreateModal}>
                        Add department
                    </Button>
                )}
            />

            {loadError && (
                <Alert tone="danger" role="alert" className="ms-notice">
                    <span>Failed to load departments: {loadError}</span>
                    <Button size="sm" onClick={fetchDepartments}>Retry</Button>
                </Alert>
            )}
            {notice && (
                <Alert tone="ok" role="status" className="ms-notice">
                    <span>{notice}</span>
                    <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>
                </Alert>
            )}

            {loading || authLoading ? (
                <div className="ms-empty"><p>Loading departments...</p></div>
            ) : departments.length === 0 ? (
                <div className="ms-empty">
                    <p className="ms-empty__title">No departments yet</p>
                    <p>Add a department to group users under a seal.</p>
                </div>
            ) : (
                <ul className="ms-departments__grid">
                    {departments.map((dept) => {
                        const seal = sealForColor(dept.color);
                        const members = dept.memberCount ?? 0;
                        const isOwnDepartment = String(dept.id) === String(currentUserDepartmentId);
                        const canEditThisDepartment = canEditDepartments && (currentUserIsAdmin || isOwnDepartment);
                        const canDeleteThisDepartment = canDeleteDepartments;
                        return (
                            <li key={dept.id} className="ms-cut ms-departments__card">
                                <SealBadge seal={seal.key} />
                                <div className="ms-departments__info">
                                    <h2 className="ms-departments__name">{dept.name}</h2>
                                    <p className="ms-departments__meta">
                                        <b>{members}</b> {members === 1 ? "member" : "members"}
                                        <span className="ms-departments__seal-name"> · {seal.name} seal</span>
                                    </p>
                                </div>
                                <SampleStats dept={dept} />
                                {showActions && (
                                    <div className="ms-departments__actions">
                                        {canEditThisDepartment ? (
                                            <Button size="sm" className="ms-departments__btn" icon={<Pencil aria-hidden="true" />} onClick={() => openEditModal(dept)}>
                                                <span className="ms-departments__btn-label">Edit</span>
                                                <span className="ms-visually-hidden"> {dept.name}</span>
                                            </Button>
                                        ) : (
                                            <span className="ms-departments__locked">Locked</span>
                                        )}
                                        {canDeleteThisDepartment && (
                                            <Button size="sm" variant="ghost-danger" className="ms-departments__btn" icon={<Trash2 aria-hidden="true" />} onClick={() => openDeleteModal(dept)}>
                                                <span className="ms-departments__btn-label">Delete</span>
                                                <span className="ms-visually-hidden"> {dept.name}</span>
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {isModalOpen && (
                <Dialog
                    eyebrow="Departments"
                    title={editingDept ? "Edit Department" : "New Department"}
                    description="Configure the details for this organisation branch."
                    onClose={closeModal}
                    busy={busy}
                >
                    <form onSubmit={handleSubmit}>
                        <DialogBody>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="dept-name">Department name</label>
                                <input id="dept-name" data-autofocus className="ms-input" placeholder="e.g. Engineering" maxLength={60}
                                    value={nameInput} onChange={(e) => setNameInput(e.target.value)} required />
                            </div>
                            <fieldset className="ms-departments__seals">
                                <legend className="ms-field__label">Seal</legend>
                                <div className="ms-departments__seal-opts">
                                    {SEALS.map((s) => (
                                        <div key={s.key} className="ms-departments__seal-opt">
                                            <input
                                                type="radio"
                                                id={`seal-${s.key}`}
                                                name="dept-seal"
                                                className="ms-departments__seal-radio"
                                                checked={selectedSeal === s.key}
                                                onChange={() => setColorInput(s.color)}
                                            />
                                            <label htmlFor={`seal-${s.key}`} className="ms-departments__seal-label" data-seal={s.key}>
                                                <SealMini seal={s.key} />
                                                <span>{s.name}</span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </fieldset>

                            {formError && <Alert tone="danger" role="alert">{formError}</Alert>}
                        </DialogBody>
                        <DialogFooter>
                            <Button onClick={closeModal} disabled={busy}>Cancel</Button>
                            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
                        </DialogFooter>
                    </form>
                </Dialog>
            )}

            {isDeleteModalOpen && deptToDelete && (
                <Dialog eyebrow="Delete department" title="Delete Department?" tone="danger" size="sm" onClose={closeDeleteModal} busy={busy}>
                    <DialogBody>
                        <div className="ms-confirm">
                            <span className="ms-confirm__icon" aria-hidden="true"><TriangleAlert /></span>
                            <p>
                                You are about to remove <strong>{deptToDelete.name}</strong>.
                                {deptToDelete.memberCount > 0
                                    ? ` Its ${deptToDelete.memberCount} member${deptToDelete.memberCount === 1 ? "" : "s"} will be kept but left without a department.`
                                    : " It has no members."}{" "}
                                This cannot be undone.
                            </p>
                        </div>
                        {formError && <Alert tone="danger" role="alert">{formError}</Alert>}
                    </DialogBody>
                    <DialogFooter>
                        <Button onClick={closeDeleteModal} disabled={busy}>Keep it</Button>
                        <Button variant="danger" onClick={confirmDelete} disabled={busy}>
                            {busy ? "Deleting…" : "Delete"}
                        </Button>
                    </DialogFooter>
                </Dialog>
            )}
        </section>
    );
}
