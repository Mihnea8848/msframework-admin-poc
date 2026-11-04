import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, hasRole } from "../auth/permissions";
import { del, get, post, put } from "../api/client";
import type { DepartmentResponse } from "../api/types";
import type { BudgetSummaryLite, DepartmentPerformanceLite, PerformanceOverviewLite } from "../api/people";
import { prefetchPage } from "../app/pages";
import { formatMoney } from "../utils/format";
import { budgetsByDepartment, quarterLabel, utilisation } from "../utils/people";
import type { DepartmentBudget } from "../utils/people";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Dialog, { DialogBody, DialogFooter } from "../ui/Dialog";
import PageHeader from "../ui/PageHeader";
import { useReveal } from "../ui/useReveal";
import OfficialSeal from "../ui/seal/OfficialSeal";
import { SealMini } from "../ui/seal/Seal";
import { DEFAULT_COLOR, SEALS, sealForColor, sealRingTitle } from "../ui/seal/seals";
import "../ui/field.css";
import "../ui/list.css";
import BudgetBar from "./departments/BudgetBar";
import Sparkline from "./departments/Sparkline";
import "../ui/surface.css";
import "./departments.css";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** What the cards show from /api/performance and /api/budgets; null where the user may not read it. */
interface Figures {
    performance: { period: string; byDept: Map<number, DepartmentPerformanceLite> } | null;
    budgets: { period: string; currency: string; byDept: Map<number, DepartmentBudget> } | null;
}

/**
 * The department's real figures for the current quarter: the performance score with its six-month
 * trend, and the share of its budget spent. A row the user may not read is not shown at all.
 */
function DepartmentFigures({ deptId, figures }: { deptId: number; figures: Figures }) {
    const { performance, budgets } = figures;
    if (!performance && !budgets) return null;
    const perf = performance?.byDept.get(deptId);
    const budget = budgets?.byDept.get(deptId);
    const used = budget ? utilisation(budget.spent, budget.budget) : null;
    return (
        <dl className="ms-departments__figures">
            {performance && (
                <div className="ms-departments__figure">
                    <dt className="ms-departments__stat-label">Performance <span className="ms-departments__period">{performance.period}</span></dt>
                    <dd className="ms-departments__perf">
                        {perf?.score != null ? (
                            <>
                                <span className="ms-departments__stat-value">{Math.round(perf.score)}%</span>
                                <Sparkline trend={perf.trend} />
                            </>
                        ) : (
                            <span className="ms-departments__stat-none">{perf && perf.goalCount > 0 ? "No check-ins yet" : "No goals"}</span>
                        )}
                    </dd>
                </div>
            )}
            {budgets && (
                <div className="ms-departments__figure">
                    <dt className="ms-departments__stat-label">Budget used <span className="ms-departments__period">{budgets.period}</span></dt>
                    <dd className="ms-departments__budget">
                        {used != null && budget ? (
                            <>
                                <span className="ms-departments__stat-value">{used}%</span>
                                <BudgetBar percent={used} className="ms-departments__bar" />
                                <span className="ms-departments__money">
                                    {formatMoney(budget.spent, budgets.currency)} of {formatMoney(budget.budget, budgets.currency)}
                                </span>
                            </>
                        ) : (
                            <span className="ms-departments__stat-none">
                                {budget && budget.spent > 0 ? `${formatMoney(budget.spent, budgets.currency)} spent, no budget set` : "No budget set"}
                            </span>
                        )}
                    </dd>
                </div>
            )}
        </dl>
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
    const reveal = useReveal(!loading && !authLoading);

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

    const canReadPerformance = hasPermission(user, "GOALS_READ") || hasPermission(user, "REPORTS_READ");
    const canReadBudgets = hasPermission(user, "FINANCE_READ");
    const [performance, setPerformance] = useState<PerformanceOverviewLite | null>(null);
    const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryLite | null>(null);

    useEffect(() => {
        if (!canReadPerformance) return;
        get<PerformanceOverviewLite>("/api/performance")
            .then(setPerformance)
            .catch(() => setPerformance(null));
    }, [canReadPerformance]);

    useEffect(() => {
        if (!canReadBudgets) return;
        get<BudgetSummaryLite>("/api/budgets")
            .then(setBudgetSummary)
            .catch(() => setBudgetSummary(null));
    }, [canReadBudgets]);

    const figures = useMemo<Figures>(() => ({
        performance: canReadPerformance && performance
            ? {
                period: quarterLabel(performance.year, performance.quarter),
                byDept: new Map((performance.departments ?? []).map((d) => [d.departmentId, d])),
            }
            : null,
        budgets: canReadBudgets && budgetSummary
            ? {
                period: quarterLabel(budgetSummary.year, budgetSummary.quarter),
                currency: budgetSummary.currency,
                byDept: budgetsByDepartment(budgetSummary.lines ?? []),
            }
            : null,
    }), [canReadPerformance, performance, canReadBudgets, budgetSummary]);
    const prefetchDetail = () => prefetchPage("departmentDetail");

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
                eyebrow="People"
                title="Departments"
                count={loading || authLoading ? null : departments.length}
                description="The studio departments, their seals, managers and members, with this quarter's performance and budget."
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
                    {departments.map((dept, i) => {
                        const seal = sealForColor(dept.color);
                        const members = dept.memberCount ?? 0;
                        const isOwnDepartment = String(dept.id) === String(currentUserDepartmentId);
                        const canEditThisDepartment = canEditDepartments && (currentUserIsAdmin || isOwnDepartment);
                        const canDeleteThisDepartment = canDeleteDepartments;
                        return (
                            <li key={dept.id} {...reveal(i, "ms-cut ms-lift ms-departments__card")}>
                                <OfficialSeal className="ms-departments__seal" seal={seal.key} title={sealRingTitle(dept.name, seal)} />
                                <span className="ms-departments__mini"><SealMini seal={seal.key} /></span>
                                <div className="ms-departments__info">
                                    <h2 className="ms-departments__name">
                                        <Link className="ms-departments__link" to={`/departments/${dept.id}`} onMouseEnter={prefetchDetail} onFocus={prefetchDetail}>
                                            {dept.name}
                                        </Link>
                                    </h2>
                                    <p className="ms-departments__meta">
                                        <b>{members}</b> {members === 1 ? "member" : "members"}
                                        <span className="ms-departments__manager">
                                            {" · "}
                                            {dept.managerName ? <>Led by <b>{dept.managerName}</b></> : "No manager"}
                                        </span>
                                    </p>
                                </div>
                                <DepartmentFigures deptId={dept.id} figures={figures} />
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
