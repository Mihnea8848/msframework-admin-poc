import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Check, Plus, Search, Send, TriangleAlert } from "lucide-react";
import { del, get, post, put } from "../api/client";
import type { Expense, ExpenseCategory, ExpensePage, ExpenseRequest } from "../api/business";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, hasRole } from "../auth/permissions";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Dialog, { DialogBody, DialogFooter } from "../ui/Dialog";
import PageHeader from "../ui/PageHeader";
import { DepartmentSelect, Pager } from "../ui/BizControls";
import { useDepartments } from "../ui/useDepartments";
import { useReveal } from "../ui/useReveal";
import { EXPENSE_STATUSES, STATUS_META, TAB_LABELS, expenseActions, expenseFormProblem, expenseTabs, tabQuery } from "../utils/expenses";
import type { ExpenseAction, ExpenseForm, ExpenseTab } from "../utils/expenses";
import { parseDecimal } from "../utils/goals";
import { formatDate, formatMoney, toIsoDate } from "../utils/money";
import "../ui/field.css";
import "../ui/list.css";
import "../ui/surface.css";
import "../ui/business.css";
import "./expenses.css";

const PAGE_SIZE = 25;
const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

interface Filters {
    status: string;
    departmentId: string;
    categoryId: string;
    from: string;
    to: string;
    q: string;
}

const NO_FILTERS: Filters = { status: "", departmentId: "", categoryId: "", from: "", to: "", q: "" };

type Mode =
    | { kind: "form"; expense: Expense | null }
    | { kind: "reject" | "pay" | "delete"; expense: Expense }
    | null;

function StatusPill({ expense }: { expense: Expense }) {
    const meta = STATUS_META[expense.status];
    return (
        <span className={`ms-status ms-status--${meta.tone}`}>
            <meta.Icon aria-hidden="true" />
            {meta.label}
        </span>
    );
}

function OverBudget() {
    return <span className="ms-flag ms-flag--danger"><TriangleAlert aria-hidden="true" />Over budget</span>;
}

export default function Expenses() {
    const { user } = useAuth();
    const canSubmit = hasPermission(user, "EXPENSE_SUBMIT");
    const tabs = useMemo(() => expenseTabs(user), [user]);
    const [now] = useState(() => new Date());
    const today = toIsoDate(now);
    const departments = useDepartments();
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [tab, setTab] = useState<ExpenseTab>(() => (tabs.includes("approve") ? "approve" : canSubmit ? "mine" : tabs[tabs.length - 1] ?? "mine"));
    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(0);
    const [data, setData] = useState<ExpensePage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [version, setVersion] = useState(0);
    const [mode, setMode] = useState<Mode>(null);
    const [pending, setPending] = useState<number | null>(null);
    const reveal = useReveal(data !== null);

    useEffect(() => {
        let alive = true;
        get<ExpenseCategory[]>("/api/finance/categories").then((list) => { if (alive) setCategories(Array.isArray(list) ? list : []); }).catch(() => undefined);
        return () => { alive = false; };
    }, []);

    // The search box waits for a pause in typing before it asks the server.
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setFilters((f) => (f.q === query.trim() ? f : { ...f, q: query.trim() }));
            setPage(0);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        let alive = true;
        const params = new URLSearchParams({ ...tabQuery(tab, user), page: String(page), size: String(PAGE_SIZE) });
        for (const [key, value] of Object.entries(filters)) if (value && !params.has(key)) params.set(key, value);
        get<ExpensePage>(`/api/expenses?${params.toString()}`)
            .then((d) => { if (alive) { setData(d); setError(null); setLoading(false); } })
            .catch((err) => { if (alive) { setError(messageOf(err)); setLoading(false); } });
        return () => { alive = false; };
    }, [tab, filters, page, version, user]);

    const reload = useCallback(() => { setLoading(true); setVersion((v) => v + 1); }, []);

    function setFilter(key: keyof Filters, value: string) {
        setLoading(true);
        setPage(0);
        setFilters((f) => ({ ...f, [key]: value }));
    }

    function chooseTab(next: ExpenseTab) {
        setLoading(true);
        setPage(0);
        setTab(next);
    }

    function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
        const i = tabs.indexOf(tab);
        let next = -1;
        if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
        if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = tabs.length - 1;
        const key = tabs[next];
        if (key) {
            e.preventDefault();
            chooseTab(key);
            document.getElementById(`exp-tab-${key}`)?.focus();
        }
    }

    async function quick(expense: Expense, action: "approve" | "submit") {
        setPending(expense.id);
        setError(null);
        try {
            await post(`/api/expenses/${expense.id}/${action}`, action === "approve" ? { note: null } : undefined);
            setNotice(action === "approve"
                ? `Approved ${expense.vendor} (${formatMoney(expense.amount, expense.currency)}).`
                : `Submitted ${expense.vendor} for approval.`);
            reload();
        } catch (err) {
            setError(messageOf(err));
        } finally {
            setPending(null);
        }
    }

    function act(expense: Expense, action: ExpenseAction) {
        if (action.key === "approve" || action.key === "submit") quick(expense, action.key);
        else if (action.key === "edit") setMode({ kind: "form", expense });
        else setMode({ kind: action.key, expense });
    }

    const filtersOn = Object.values(filters).some(Boolean);
    const items = data?.items ?? [];

    function actionsFor(expense: Expense) {
        const list = expenseActions(expense);
        if (list.length === 0) return null;
        return (
            <div className="ms-expenses__actions">
                {list.map((a) => (
                    <Button key={a.key} size="sm" variant={a.variant} disabled={pending === expense.id} onClick={() => act(expense, a)}
                        icon={a.key === "approve" ? <Check aria-hidden="true" /> : a.key === "submit" ? <Send aria-hidden="true" /> : undefined}>
                        {a.label}<span className="ms-visually-hidden"> {expense.vendor}, {formatMoney(expense.amount, expense.currency)}</span>
                    </Button>
                ))}
            </div>
        );
    }

    return (
        <section className="ms-biz ms-expenses">
            <PageHeader
                eyebrow="Finance"
                title="Expenses"
                count={data?.totalItems ?? null}
                description="Submit what you spend, approve your department's requests and record payments."
                actions={canSubmit && (
                    <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setMode({ kind: "form", expense: null })}>New expense</Button>
                )}
            />

            {notice && (
                <Alert tone="ok" role="status" className="ms-notice">
                    <span>{notice}</span>
                    <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>
                </Alert>
            )}
            {error && (
                <Alert tone="danger" role="alert" className="ms-notice">
                    <span>{error}</span>
                    <Button size="sm" onClick={reload}>Retry</Button>
                </Alert>
            )}

            {tabs.length > 1 && (
                <div className="ms-expenses__tabs" role="tablist" aria-label="Which expenses">
                    {tabs.map((t) => (
                        <button key={t} id={`exp-tab-${t}`} type="button" role="tab" className="ms-expenses__tab"
                            aria-selected={tab === t} aria-controls="exp-panel" tabIndex={tab === t ? 0 : -1} onClick={() => chooseTab(t)} onKeyDown={onTabKey}>
                            {TAB_LABELS[t]}
                        </button>
                    ))}
                </div>
            )}

            <div id="exp-panel" role={tabs.length > 1 ? "tabpanel" : undefined} aria-labelledby={tabs.length > 1 ? `exp-tab-${tab}` : undefined} className="ms-biz">
                <div className="ms-filters">
                    <div className="ms-search">
                        <label className="ms-visually-hidden" htmlFor="exp-q">Search expenses</label>
                        <Search aria-hidden="true" />
                        <input id="exp-q" className="ms-input" type="search" placeholder="Vendor, description or reference" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                    {tab !== "approve" && (
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="exp-status">Status</label>
                            <div className="ms-select">
                                <select id="exp-status" className="ms-input" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
                                    <option value="">Any status</option>
                                    {EXPENSE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                    {tab === "all" && (
                        <DepartmentSelect id="exp-dept" value={filters.departmentId} departments={departments} onChange={(v) => setFilter("departmentId", v)} />
                    )}
                    <div className="ms-field">
                        <label className="ms-field__label" htmlFor="exp-cat">Category</label>
                        <div className="ms-select">
                            <select id="exp-cat" className="ms-input" value={filters.categoryId} onChange={(e) => setFilter("categoryId", e.target.value)}>
                                <option value="">All categories</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="ms-field ms-expenses__date">
                        <label className="ms-field__label" htmlFor="exp-from">From</label>
                        <input id="exp-from" className="ms-input" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter("from", e.target.value)} />
                    </div>
                    <div className="ms-field ms-expenses__date">
                        <label className="ms-field__label" htmlFor="exp-to">To</label>
                        <input id="exp-to" className="ms-input" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter("to", e.target.value)} />
                    </div>
                    {filtersOn && <Button variant="ghost" onClick={() => { setQuery(""); setPage(0); setLoading(true); setFilters(NO_FILTERS); }}>Clear filters</Button>}
                </div>

                {data && (
                    <p className="ms-result-count" aria-live="polite">
                        {data.totalItems} expense{data.totalItems === 1 ? "" : "s"} · {formatMoney(data.totalAmount, data.currency)} in total
                    </p>
                )}

                {!data && !error && <div className="ms-empty"><p>Loading expenses…</p></div>}

                {data && items.length === 0 && (
                    <div className="ms-empty">
                        <p className="ms-empty__title">
                            {filtersOn ? "No expenses match these filters." : tab === "approve" ? "Nothing is waiting for approval." : tab === "mine" ? "You have not added any expenses yet." : "No expenses yet."}
                        </p>
                        {tab === "mine" && !filtersOn && canSubmit && (
                            <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setMode({ kind: "form", expense: null })}>New expense</Button>
                        )}
                    </div>
                )}

                {items.length > 0 && (
                    <div className={`ms-table-wrap ms-expenses__wrap${loading ? " ms-expenses__wrap--busy" : ""}`} aria-busy={loading}>
                        <table className="ms-table ms-expenses__table">
                            <thead>
                                <tr>
                                    <th scope="col">Date</th>
                                    <th scope="col">Vendor</th>
                                    <th scope="col">Department · category</th>
                                    {tab !== "mine" && <th scope="col">Submitted by</th>}
                                    <th scope="col" className="ms-num">Amount</th>
                                    <th scope="col">Status</th>
                                    <th scope="col"><span className="ms-visually-hidden">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((e, i) => (
                                    <tr key={e.id} {...reveal(i, "ms-expenses__row")}>
                                        <td className="ms-expenses__date-cell"><time dateTime={e.date}>{formatDate(e.date)}</time></td>
                                        <td className="ms-expenses__vendor">
                                            <strong>{e.vendor}</strong>
                                            {e.description && <span className="ms-muted">{e.description}</span>}
                                            {e.status === "REJECTED" && e.decisionNote && <span className="ms-expenses__note">Rejected: {e.decisionNote}</span>}
                                            {e.status === "PAID" && <span className="ms-muted">Paid {formatDate(e.paidOn)}{e.paymentReference ? ` · ${e.paymentReference}` : ""}</span>}
                                        </td>
                                        <td className="ms-expenses__dept">{e.departmentName}<span className="ms-muted"> · {e.categoryName}</span></td>
                                        {tab !== "mine" && <td className="ms-expenses__who">{e.submittedByName ?? e.submittedByEmail ?? "—"}</td>}
                                        <td className="ms-num ms-expenses__amount">{formatMoney(e.amount, e.currency)}</td>
                                        <td className="ms-expenses__status">
                                            <StatusPill expense={e} />
                                            {e.overBudget && <OverBudget />}
                                        </td>
                                        <td className="ms-table__actions ms-expenses__act">{actionsFor(e)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {data && (
                    <Pager page={data.page} totalPages={data.totalPages} total={data.totalItems} noun={data.totalItems === 1 ? "expense" : "expenses"} busy={loading}
                        onPage={(p) => { setLoading(true); setPage(p); }} />
                )}
            </div>

            {mode?.kind === "form" && (
                <ExpenseDialog expense={mode.expense} categories={categories} departments={departments}
                    anyDepartment={hasRole(user, "ADMIN")} ownDepartmentId={user?.departmentId ?? null} today={today}
                    onClose={() => setMode(null)} onSaved={(t) => { setMode(null); setNotice(t); reload(); }} />
            )}
            {mode && mode.kind !== "form" && (
                <DecisionDialog kind={mode.kind} expense={mode.expense} today={today}
                    onClose={() => setMode(null)} onDone={(t) => { setMode(null); setNotice(t); reload(); }} />
            )}
        </section>
    );
}

function ExpenseDialog({ expense, categories, departments, anyDepartment, ownDepartmentId, today, onClose, onSaved }: {
    expense: Expense | null;
    categories: readonly ExpenseCategory[];
    departments: readonly { id: number; name: string; color: string | null; memberCount: number }[];
    anyDepartment: boolean;
    ownDepartmentId: number | null;
    today: string;
    onClose: () => void;
    onSaved: (notice: string) => void;
}) {
    const [form, setForm] = useState<ExpenseForm>(() => ({
        departmentId: String(expense?.departmentId ?? ownDepartmentId ?? departments[0]?.id ?? ""),
        categoryId: String(expense?.categoryId ?? categories.find((c) => c.active)?.id ?? ""),
        amount: expense ? String(expense.amount) : "",
        date: expense?.date ?? today,
        vendor: expense?.vendor ?? "",
        description: expense?.description ?? "",
        reference: expense?.reference ?? "",
    }));
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const set = (field: keyof ExpenseForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [field]: e.target.value }));
    const choosable = categories.filter((c) => c.active || String(c.id) === form.categoryId);
    const ownName = departments.find((d) => d.id === ownDepartmentId)?.name;

    async function save(submit: boolean) {
        const problem = expenseFormProblem(form, today);
        if (problem) { setError(problem); return; }
        const body: ExpenseRequest = {
            departmentId: anyDepartment && form.departmentId ? Number(form.departmentId) : expense?.departmentId ?? null,
            categoryId: Number(form.categoryId),
            amount: parseDecimal(form.amount) as number,
            date: form.date,
            vendor: form.vendor.trim(),
            description: form.description.trim() || null,
            reference: form.reference.trim() || null,
        };
        setBusy(true);
        setError(null);
        try {
            if (expense) {
                await put(`/api/expenses/${expense.id}`, body);
                if (submit && expense.status === "DRAFT") await post(`/api/expenses/${expense.id}/submit`);
            } else {
                await post("/api/expenses", { ...body, submit });
            }
            onSaved(submit ? `Submitted ${body.vendor} for approval.` : expense ? `Saved ${body.vendor}.` : `Saved ${body.vendor} as a draft.`);
        } catch (err) {
            setError(messageOf(err));
            setBusy(false);
        }
    }

    function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        save(!expense || expense.status === "DRAFT");
    }

    const editingSubmitted = expense?.status === "SUBMITTED";
    return (
        <Dialog eyebrow="Expenses" title={expense ? "Edit expense" : "New expense"}
            description={editingSubmitted ? "It stays submitted; the approver sees your changes." : "Save it as a draft to finish later, or submit it for approval."}
            onClose={onClose} busy={busy}>
            <form onSubmit={onSubmit} noValidate>
                <DialogBody>
                    <div className="ms-dialog__grid">
                        {anyDepartment ? (
                            <DepartmentSelect id="ex-dept" value={form.departmentId} departments={departments} allLabel={null} onChange={(v) => setForm((f) => ({ ...f, departmentId: v }))} />
                        ) : (
                            <div className="ms-field">
                                <span className="ms-field__label">Department</span>
                                <p className="ms-expenses__fixed">{expense?.departmentName ?? ownName ?? "Your department"}</p>
                            </div>
                        )}
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="ex-cat">Category</label>
                            <div className="ms-select">
                                <select id="ex-cat" className="ms-input" value={form.categoryId} onChange={set("categoryId")}>
                                    {choosable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="ex-amount">Amount</label>
                            <input id="ex-amount" data-autofocus className="ms-input" inputMode="decimal" value={form.amount} onChange={set("amount")} placeholder="249.00" />
                        </div>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="ex-date">Date</label>
                            <input id="ex-date" className="ms-input" type="date" max={today} value={form.date} onChange={set("date")} />
                        </div>
                    </div>
                    <div className="ms-field">
                        <label className="ms-field__label" htmlFor="ex-vendor">Vendor</label>
                        <input id="ex-vendor" className="ms-input" maxLength={120} value={form.vendor} onChange={set("vendor")} placeholder="Who was paid" />
                    </div>
                    <div className="ms-field">
                        <label className="ms-field__label" htmlFor="ex-desc">Description (optional)</label>
                        <input id="ex-desc" className="ms-input" maxLength={500} value={form.description} onChange={set("description")} placeholder="What it was for" />
                    </div>
                    <div className="ms-field">
                        <label className="ms-field__label" htmlFor="ex-ref">Reference (optional)</label>
                        <input id="ex-ref" className="ms-input" maxLength={80} value={form.reference} onChange={set("reference")} placeholder="Invoice number" />
                    </div>
                    {error && <Alert tone="danger" role="alert">{error}</Alert>}
                </DialogBody>
                <DialogFooter>
                    <Button onClick={onClose} disabled={busy}>Cancel</Button>
                    {(!expense || expense.status === "DRAFT") && (
                        <Button onClick={() => save(false)} disabled={busy}>Save draft</Button>
                    )}
                    <Button type="submit" variant="primary" disabled={busy} icon={editingSubmitted ? undefined : <Send aria-hidden="true" />}>
                        {busy ? "Saving…" : editingSubmitted ? "Save" : "Submit"}
                    </Button>
                </DialogFooter>
            </form>
        </Dialog>
    );
}

function DecisionDialog({ kind, expense, today, onClose, onDone }: {
    kind: "reject" | "pay" | "delete";
    expense: Expense;
    today: string;
    onClose: () => void;
    onDone: (notice: string) => void;
}) {
    const [note, setNote] = useState("");
    const [paidOn, setPaidOn] = useState(today);
    const [reference, setReference] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const amount = formatMoney(expense.amount, expense.currency);

    async function confirm(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (kind === "reject" && !note.trim()) { setError("Give a reason for the rejection."); return; }
        if (kind === "reject" && note.trim().length > 500) { setError("The reason must be at most 500 characters."); return; }
        if (kind === "pay") {
            if (!paidOn) { setError("Choose the payment date."); return; }
            if (paidOn > today) { setError("The payment date cannot be in the future."); return; }
            if (paidOn < expense.date) { setError("The payment date cannot be before the expense date."); return; }
            if (reference.trim().length > 80) { setError("The payment reference must be at most 80 characters."); return; }
        }
        setBusy(true);
        setError(null);
        try {
            if (kind === "reject") await post(`/api/expenses/${expense.id}/reject`, { note: note.trim() });
            else if (kind === "pay") await post(`/api/expenses/${expense.id}/pay`, { paidOn, paymentReference: reference.trim() || null });
            else await del(`/api/expenses/${expense.id}`);
            onDone(kind === "reject" ? `Rejected ${expense.vendor} (${amount}).`
                : kind === "pay" ? `Recorded the payment of ${amount} to ${expense.vendor}.`
                    : `Deleted the draft for ${expense.vendor}.`);
        } catch (err) {
            setError(messageOf(err));
            setBusy(false);
        }
    }

    const title = kind === "reject" ? "Reject expense?" : kind === "pay" ? "Mark as paid" : "Delete draft?";
    return (
        <Dialog eyebrow="Expenses" title={title} tone={kind === "pay" ? "default" : "danger"} size="sm" onClose={onClose} busy={busy}
            description={`${expense.vendor} · ${amount} · ${expense.departmentName}, ${formatDate(expense.date)}`}>
            <form onSubmit={confirm} noValidate>
                <DialogBody>
                    {kind === "reject" && (
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="ex-note">Reason (required)</label>
                            <input id="ex-note" data-autofocus className="ms-input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
                                placeholder="Tell the submitter what to change" aria-required="true" />
                        </div>
                    )}
                    {kind === "pay" && (
                        <>
                            <p className="ms-muted">MSFramework records the payment; it does not move money. Pay it in your bank first.</p>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="ex-paid">Paid on</label>
                                <input id="ex-paid" className="ms-input" type="date" min={expense.date} max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
                            </div>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="ex-pref">Payment reference (optional)</label>
                                <input id="ex-pref" data-autofocus className="ms-input" maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank transfer ID" />
                            </div>
                        </>
                    )}
                    {kind === "delete" && <p>The draft is deleted. This cannot be undone.</p>}
                    {error && <Alert tone="danger" role="alert">{error}</Alert>}
                </DialogBody>
                <DialogFooter>
                    <Button onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button type="submit" variant={kind === "pay" ? "primary" : "danger"} disabled={busy}>
                        {busy ? "Saving…" : kind === "reject" ? "Reject" : kind === "pay" ? "Mark paid" : "Delete"}
                    </Button>
                </DialogFooter>
            </form>
        </Dialog>
    );
}
