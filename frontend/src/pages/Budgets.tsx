import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CircleAlert, Pencil, Plus, Tags, Trash2, TriangleAlert } from "lucide-react";
import { del, get, post, put } from "../api/client";
import type { BudgetLine, BudgetRequest, BudgetSummary, ExpenseCategory } from "../api/business";
import type { DepartmentResponse } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Dialog, { DialogBody, DialogFooter } from "../ui/Dialog";
import PageHeader from "../ui/PageHeader";
import Toggle from "../ui/Toggle";
import { DepartmentSelect, QuarterSelect, Tile } from "../ui/BizControls";
import BudgetBar from "../ui/charts/BudgetBar";
import Legend from "../ui/charts/Legend";
import { SealMini } from "../ui/seal/Seal";
import { sealOf, useDepartments } from "../ui/useDepartments";
import { useReveal } from "../ui/useReveal";
import { decimalProblem, parseDecimal } from "../utils/goals";
import { formatMoney, quarterLabel, quarterOf, quarterOptions } from "../utils/money";
import type { Quarter } from "../utils/money";
import "../ui/field.css";
import "../ui/list.css";
import "../ui/surface.css";
import "../ui/business.css";
import "./budgets.css";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

type Mode =
    | { kind: "line"; line: BudgetLine | null; preset?: Partial<BudgetLine> }
    | { kind: "delete"; line: BudgetLine }
    | { kind: "categories" }
    | null;

export default function Budgets() {
    const { user } = useAuth();
    const canManage = hasPermission(user, "FINANCE_MANAGE");
    const [now] = useState(() => new Date());
    const quarters = useMemo(() => quarterOptions(now), [now]);
    const departments = useDepartments();
    const [quarter, setQuarter] = useState<Quarter>(() => quarterOf(now));
    const [departmentId, setDepartmentId] = useState("");
    const [data, setData] = useState<BudgetSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [version, setVersion] = useState(0);
    const [mode, setMode] = useState<Mode>(null);
    const reveal = useReveal(data !== null);

    useEffect(() => {
        let alive = true;
        get<BudgetSummary>(`/api/budgets?year=${quarter.year}&quarter=${quarter.quarter}${departmentId ? `&departmentId=${departmentId}` : ""}`)
            .then((d) => { if (alive) { setData(d); setError(null); } })
            .catch((err) => { if (alive) setError(messageOf(err)); });
        return () => { alive = false; };
    }, [quarter, departmentId, version]);

    const reload = useCallback(() => setVersion((v) => v + 1), []);
    const currency = data?.currency ?? "EUR";
    const money = (v: number) => formatMoney(v, currency);

    const groups = useMemo(() => {
        const map = new Map<number, BudgetLine[]>();
        for (const line of data?.lines ?? []) map.set(line.departmentId, [...(map.get(line.departmentId) ?? []), line]);
        return [...map.values()]
            .map((lines) => {
                const first = lines[0] as BudgetLine;
                const sum = (f: "amount" | "spent" | "committed") => lines.reduce((s, l) => s + l[f], 0);
                return {
                    id: first.departmentId,
                    name: first.departmentName,
                    seal: sealOf(first.departmentColor),
                    lines: [...lines].sort((a, b) => a.categoryName.localeCompare(b.categoryName)),
                    budget: sum("amount"),
                    spent: sum("spent"),
                    committed: sum("committed"),
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [data]);

    const unbudgeted = (data?.lines ?? []).filter((l) => l.id === null).length;
    const totals = data?.totals;

    return (
        <section className="ms-biz ms-budgets">
            <PageHeader
                eyebrow="Finance"
                title="Budgets"
                description="Each department's budget per category and quarter, against what has been spent and committed."
                actions={canManage && (
                    <>
                        <Button icon={<Tags aria-hidden="true" />} onClick={() => setMode({ kind: "categories" })} title="Expense categories">
                            <span className="ms-budgets__btn-label">Categories</span>
                            <span className="ms-visually-hidden ms-budgets__btn-sr">Expense categories</span>
                        </Button>
                        <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setMode({ kind: "line", line: null })}>Add budget line</Button>
                    </>
                )}
            />

            {error && (
                <Alert tone="danger" role="alert" className="ms-notice">
                    <span>Could not load budgets: {error}</span>
                    <Button size="sm" onClick={reload}>Retry</Button>
                </Alert>
            )}
            {notice && (
                <Alert tone="ok" role="status" className="ms-notice">
                    <span>{notice}</span>
                    <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>
                </Alert>
            )}

            <div className="ms-filters">
                <QuarterSelect id="bud-quarter" value={quarter} options={quarters} onChange={setQuarter} />
                <DepartmentSelect id="bud-dept" value={departmentId} departments={departments} onChange={setDepartmentId} />
            </div>

            {!data && !error && <div className="ms-empty"><p>Loading budgets…</p></div>}

            {data && totals && (
                <ul className="ms-tiles" aria-label={`Totals for ${quarterLabel(quarter)}`}>
                    <Tile {...reveal(0)} label="Budget" value={money(totals.budget)} detail={quarterLabel(quarter)} />
                    <Tile {...reveal(1)} label="Spent" value={money(totals.spent)} detail="Approved and paid" />
                    <Tile {...reveal(2)} label="Committed" value={money(totals.committed)} detail="Submitted, awaiting approval" />
                    <Tile {...reveal(3)} label="Remaining" value={money(totals.remaining)} tone={totals.remaining < 0 ? "danger" : undefined}
                        detail={unbudgeted > 0 ? `${unbudgeted} unbudgeted line${unbudgeted === 1 ? "" : "s"}` : "Budget left"} />
                </ul>
            )}

            {data && groups.length === 0 && (
                <div className="ms-empty">
                    <p className="ms-empty__title">No budgets or spending for {quarterLabel(quarter)}.</p>
                    <p>{canManage ? "Set a budget per department and category to track spending against it." : "Finance sets the budgets for each quarter."}</p>
                    {canManage && <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setMode({ kind: "line", line: null })}>Add budget line</Button>}
                </div>
            )}

            {groups.length > 0 && (
                <Legend items={[
                    { label: "Spent", tone: "1" }, { label: "Committed", tone: "2" },
                    { label: "Budget", tone: "track" }, { label: "Over budget", tone: "over" },
                ]} />
            )}

            {groups.map((g, gi) => (
                <section key={g.id} {...reveal(4 + gi, "ms-panel")} data-seal={g.seal ?? undefined} aria-labelledby={`bud-d${g.id}`}>
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title ms-budgets__dept" id={`bud-d${g.id}`}><SealMini seal={g.seal} />{g.name}</h2>
                        <span className="ms-panel__meta">{money(g.spent + g.committed)} of {money(g.budget)} used</span>
                    </div>
                    <ul className="ms-budgets__lines">
                        {g.lines.map((line) => {
                            const over = line.id !== null && line.remaining < 0;
                            return (
                                <li key={`${line.categoryId}-${line.id ?? "x"}`} className="ms-budgets__line">
                                    <div className="ms-budgets__cat">
                                        <p className="ms-budgets__name">{line.categoryName}</p>
                                        {line.id === null && <span className="ms-flag"><CircleAlert aria-hidden="true" />Unbudgeted spend</span>}
                                        {over && <span className="ms-flag ms-flag--danger"><TriangleAlert aria-hidden="true" />Over budget</span>}
                                        {line.notes && <p className="ms-muted">{line.notes}</p>}
                                    </div>
                                    <BudgetBar label={`${g.name}, ${line.categoryName}`} budget={line.amount} spent={line.spent} committed={line.committed} format={money} />
                                    <dl className="ms-budgets__nums">
                                        <div><dt>Spent</dt><dd>{money(line.spent)}</dd></div>
                                        <div><dt>Committed</dt><dd>{money(line.committed)}</dd></div>
                                        <div><dt>Budget</dt><dd>{line.id === null ? "None" : money(line.amount)}</dd></div>
                                        <div><dt>{line.remaining < 0 ? "Over by" : "Left"}</dt><dd className={line.remaining < 0 ? "ms-budgets__over" : ""}>{money(Math.abs(line.remaining))}</dd></div>
                                    </dl>
                                    {canManage && (
                                        <div className="ms-budgets__actions">
                                            {line.id === null ? (
                                                <Button size="sm" icon={<Plus aria-hidden="true" />} onClick={() => setMode({ kind: "line", line: null, preset: line })}>
                                                    Set budget<span className="ms-visually-hidden"> for {g.name}, {line.categoryName}</span>
                                                </Button>
                                            ) : (
                                                <>
                                                    <Button size="sm" variant="ghost" icon={<Pencil aria-hidden="true" />} onClick={() => setMode({ kind: "line", line })}
                                                        aria-label={`Edit the ${line.categoryName} budget of ${g.name}`} title="Edit" />
                                                    <Button size="sm" variant="ghost-danger" icon={<Trash2 aria-hidden="true" />} onClick={() => setMode({ kind: "delete", line })}
                                                        aria-label={`Delete the ${line.categoryName} budget of ${g.name}`} title="Delete" />
                                                </>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}

            {mode?.kind === "line" && (
                <BudgetLineDialog line={mode.line} preset={mode.preset} quarter={quarter} quarters={quarters} departments={departments}
                    defaultDepartment={departmentId}
                    onClose={() => setMode(null)} onSaved={(t) => { setMode(null); setNotice(t); reload(); }} />
            )}
            {mode?.kind === "delete" && (
                <DeleteLineDialog line={mode.line} money={money} onClose={() => setMode(null)} onDeleted={(t) => { setMode(null); setNotice(t); reload(); }} />
            )}
            {mode?.kind === "categories" && <CategoriesDialog onClose={() => { setMode(null); reload(); }} />}
        </section>
    );
}

function BudgetLineDialog({ line, preset, quarter, quarters, departments, defaultDepartment, onClose, onSaved }: {
    line: BudgetLine | null;
    preset?: Partial<BudgetLine>;
    quarter: Quarter;
    quarters: readonly Quarter[];
    departments: readonly DepartmentResponse[];
    defaultDepartment: string;
    onClose: () => void;
    onSaved: (notice: string) => void;
}) {
    const source = line ?? preset;
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [departmentId, setDepartmentId] = useState(String(source?.departmentId ?? (defaultDepartment || departments[0]?.id || "")));
    const [categoryId, setCategoryId] = useState(source?.categoryId != null ? String(source.categoryId) : "");
    const [period, setPeriod] = useState<Quarter>(source?.year && source.quarter ? { year: source.year, quarter: source.quarter } : quarter);
    const [amount, setAmount] = useState(line ? String(line.amount) : "");
    const [notes, setNotes] = useState(line?.notes ?? "");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        get<ExpenseCategory[]>("/api/finance/categories").then((list) => {
            if (!alive) return;
            setCategories(list);
            setCategoryId((c) => c || String(list.find((x) => x.active)?.id ?? ""));
        }).catch((err) => { if (alive) setError(messageOf(err)); });
        return () => { alive = false; };
    }, []);

    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!departmentId) { setError("Choose a department."); return; }
        if (!categoryId) { setError("Choose a category."); return; }
        const problem = decimalProblem(amount, "Amount");
        if (problem) { setError(problem); return; }
        const value = parseDecimal(amount) as number;
        if (value < 0) { setError("Amount cannot be negative."); return; }
        if (notes.trim().length > 500) { setError("Notes must be at most 500 characters."); return; }
        const body: BudgetRequest = {
            departmentId: Number(departmentId), categoryId: Number(categoryId),
            year: period.year, quarter: period.quarter, amount: value, notes: notes.trim() || null,
        };
        setBusy(true);
        setError(null);
        try {
            if (line?.id) await put(`/api/budgets/${line.id}`, body);
            else await post("/api/budgets", body);
            const dept = departments.find((d) => d.id === body.departmentId)?.name ?? "the department";
            const cat = categories.find((c) => c.id === body.categoryId)?.name ?? "the category";
            onSaved(`${line ? "Saved" : "Set"} the ${cat} budget of ${dept} for ${quarterLabel(period)}.`);
        } catch (err) {
            setError(messageOf(err));
            setBusy(false);
        }
    }

    const choosable = categories.filter((c) => c.active || String(c.id) === categoryId);
    return (
        <Dialog eyebrow="Budgets" title={line ? "Edit budget line" : "Add budget line"}
            description="One amount per department, category and quarter." onClose={onClose} busy={busy}>
            <form onSubmit={submit} noValidate>
                <DialogBody>
                    <div className="ms-dialog__grid">
                        <DepartmentSelect id="bl-dept" value={departmentId} departments={departments} onChange={setDepartmentId} allLabel={null} />
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="bl-cat">Category</label>
                            <div className="ms-select">
                                <select id="bl-cat" className="ms-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                                    {choosable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <QuarterSelect id="bl-quarter" value={period} options={quarters} onChange={setPeriod} />
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="bl-amount">Amount</label>
                            <input id="bl-amount" data-autofocus className="ms-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="12500.00" />
                        </div>
                    </div>
                    <div className="ms-field">
                        <label className="ms-field__label" htmlFor="bl-notes">Notes (optional)</label>
                        <input id="bl-notes" className="ms-input" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                    {error && <Alert tone="danger" role="alert">{error}</Alert>}
                </DialogBody>
                <DialogFooter>
                    <Button onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : line ? "Save" : "Add line"}</Button>
                </DialogFooter>
            </form>
        </Dialog>
    );
}

function DeleteLineDialog({ line, money, onClose, onDeleted }: { line: BudgetLine; money: (v: number) => string; onClose: () => void; onDeleted: (t: string) => void }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    async function confirm() {
        setBusy(true);
        try {
            await del(`/api/budgets/${line.id}`);
            onDeleted(`Removed the ${line.categoryName} budget of ${line.departmentName}.`);
        } catch (err) {
            setError(messageOf(err));
            setBusy(false);
        }
    }
    return (
        <Dialog eyebrow="Delete budget line" title="Remove this budget?" tone="danger" size="sm" onClose={onClose} busy={busy}>
            <DialogBody>
                <div className="ms-confirm">
                    <span className="ms-confirm__icon" aria-hidden="true"><TriangleAlert /></span>
                    <p>The {money(line.amount)} <strong>{line.categoryName}</strong> budget of {line.departmentName} for Q{line.quarter} {line.year} is removed. Its expenses are kept and show as unbudgeted spend.</p>
                </div>
                {error && <Alert tone="danger" role="alert">{error}</Alert>}
            </DialogBody>
            <DialogFooter>
                <Button onClick={onClose} disabled={busy}>Keep it</Button>
                <Button variant="danger" onClick={confirm} disabled={busy}>{busy ? "Removing…" : "Remove"}</Button>
            </DialogFooter>
        </Dialog>
    );
}

function CategoriesDialog({ onClose }: { onClose: () => void }) {
    const [categories, setCategories] = useState<ExpenseCategory[] | null>(null);
    const [version, setVersion] = useState(0);
    const [name, setName] = useState("");
    const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        get<ExpenseCategory[]>("/api/finance/categories").then((list) => { if (alive) setCategories(list); })
            .catch((err) => { if (alive) setError(messageOf(err)); });
        return () => { alive = false; };
    }, [version]);

    async function run(action: () => Promise<unknown>) {
        setBusy(true);
        setError(null);
        try {
            await action();
            setVersion((v) => v + 1);
            return true;
        } catch (err) {
            setError(messageOf(err));
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function add(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) { setError("Category name is required."); return; }
        if (trimmed.length > 60) { setError("Category name must be at most 60 characters."); return; }
        if (await run(() => post("/api/finance/categories", { name: trimmed }))) setName("");
    }

    async function rename(c: ExpenseCategory) {
        if (!editing) return;
        const trimmed = editing.name.trim();
        if (!trimmed) { setError("Category name is required."); return; }
        if (await run(() => put(`/api/finance/categories/${c.id}`, { name: trimmed, description: c.description, active: c.active }))) setEditing(null);
    }

    return (
        <Dialog eyebrow="Finance" title="Expense categories"
            description="Shared by budgets and expenses. A category in use cannot be deleted; deactivate it so it can no longer be picked."
            onClose={onClose} busy={busy}>
            <DialogBody>
                <form className="ms-budgets__add" onSubmit={add} noValidate>
                    <div className="ms-field">
                        <label className="ms-field__label" htmlFor="cat-new">New category</label>
                        <input id="cat-new" data-autofocus className="ms-input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Licences" />
                    </div>
                    <Button type="submit" variant="primary" disabled={busy} icon={<Plus aria-hidden="true" />}>Add</Button>
                </form>
                {error && <Alert tone="danger" role="alert">{error}</Alert>}
                {categories === null && !error && <p className="ms-muted">Loading categories…</p>}
                <ul className="ms-budgets__cats">
                    {categories?.map((c) => (
                        <li key={c.id}>
                            {editing?.id === c.id ? (
                                <>
                                    <label className="ms-visually-hidden" htmlFor={`cat-${c.id}`}>Name of {c.name}</label>
                                    <input id={`cat-${c.id}`} className="ms-input" maxLength={60} value={editing.name}
                                        onChange={(e) => setEditing({ id: c.id, name: e.target.value })} />
                                    <Button size="sm" variant="primary" disabled={busy} onClick={() => rename(c)}>Save</Button>
                                    <Button size="sm" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
                                </>
                            ) : (
                                <>
                                    <span className="ms-budgets__cat-name">
                                        {c.name}
                                        <span className="ms-muted"> · {c.usageCount === 0 ? "unused" : `used ${c.usageCount}×`}{c.active ? "" : " · inactive"}</span>
                                    </span>
                                    <Toggle on={c.active} disabled={busy} label={`${c.active ? "Deactivate" : "Activate"} ${c.name}`}
                                        onToggle={() => run(() => put(`/api/finance/categories/${c.id}`, { name: c.name, description: c.description, active: !c.active }))} />
                                    <Button size="sm" variant="ghost" icon={<Pencil aria-hidden="true" />} disabled={busy}
                                        onClick={() => setEditing({ id: c.id, name: c.name })} aria-label={`Rename ${c.name}`} title="Rename" />
                                    <Button size="sm" variant="ghost-danger" icon={<Trash2 aria-hidden="true" />} disabled={busy}
                                        onClick={() => run(() => del(`/api/finance/categories/${c.id}`))} aria-label={`Delete ${c.name}`} title="Delete" />
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </DialogBody>
            <DialogFooter>
                <Button onClick={onClose} disabled={busy}>Done</Button>
            </DialogFooter>
        </Dialog>
    );
}
