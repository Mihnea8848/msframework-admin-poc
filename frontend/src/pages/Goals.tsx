import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, CircleCheck, CircleDashed, Clock3, ListPlus, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { del, get, post, put } from "../api/client";
import type { DepartmentPerformance, Goal, GoalCheckin, GoalDirection, GoalRequest, PerformanceOverview } from "../api/business";
import type { UserDto } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, hasRole } from "../auth/permissions";
import { visiblePages } from "../routes/navigation";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Dialog, { DialogBody, DialogFooter } from "../ui/Dialog";
import PageHeader from "../ui/PageHeader";
import { DepartmentSelect, QuarterSelect } from "../ui/BizControls";
import ScoreRing from "../ui/charts/ScoreRing";
import Sparkline from "../ui/charts/Sparkline";
import { SealMini } from "../ui/seal/Seal";
import { sealOf, useDepartments } from "../ui/useDepartments";
import { useReveal } from "../ui/useReveal";
import { attainmentStatus, attainmentWidth, checkinProblem, directionHint, formatGoalValue, goalFormProblem, parseDecimal } from "../utils/goals";
import type { GoalForm } from "../utils/goals";
import { checkinDateBounds, formatDate, quarterLabel, quarterOf, quarterOptions } from "../utils/money";
import type { Quarter } from "../utils/money";
import "../ui/field.css";
import "../ui/list.css";
import "../ui/surface.css";
import "../ui/business.css";
import "./goals.css";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

const STATUS_ICONS = { ok: CircleCheck, info: Clock3, warn: TriangleAlert, danger: TriangleAlert, neutral: CircleDashed } as const;

function AttainmentPill({ attainment }: { attainment: number | null }) {
    const status = attainmentStatus(attainment);
    const Icon = STATUS_ICONS[status.tone];
    return (
        <span className={`ms-status ms-status--${status.tone}`}>
            <Icon aria-hidden="true" />
            {status.label}
        </span>
    );
}

const EMPTY_FORM: GoalForm = {
    departmentId: "", name: "", description: "", unit: "", direction: "HIGHER_IS_BETTER",
    baseline: "", target: "", weight: "1", ownerId: "",
};

type Mode = { kind: "create" } | { kind: "edit"; goal: Goal } | { kind: "delete"; goal: Goal } | { kind: "detail"; goal: Goal } | null;

export default function Goals() {
    const { user } = useAuth();
    const [now] = useState(() => new Date());
    const isAdmin = hasRole(user, "ADMIN");
    const canManage = hasPermission(user, "GOALS_MANAGE");
    const canReadUsers = hasPermission(user, "USER_READ");
    const pages = useMemo(() => new Set(visiblePages(user).map((p) => p.key)), [user]);

    const departments = useDepartments();
    const quarters = useMemo(() => quarterOptions(now), [now]);
    const [quarter, setQuarter] = useState<Quarter>(() => quarterOf(now));
    const [departmentId, setDepartmentId] = useState("");
    const [goals, setGoals] = useState<Goal[] | null>(null);
    const [performance, setPerformance] = useState<DepartmentPerformance[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [version, setVersion] = useState(0);
    const [users, setUsers] = useState<UserDto[]>([]);
    const [mode, setMode] = useState<Mode>(null);
    const reveal = useReveal(goals !== null);

    useEffect(() => {
        let alive = true;
        const query = `year=${quarter.year}&quarter=${quarter.quarter}${departmentId ? `&departmentId=${departmentId}` : ""}`;
        Promise.all([
            get<Goal[]>(`/api/goals?${query}`),
            get<PerformanceOverview>(`/api/performance?year=${quarter.year}&quarter=${quarter.quarter}`),
        ]).then(([list, perf]) => {
            if (!alive) return;
            setGoals(Array.isArray(list) ? list : []);
            setPerformance(perf?.departments ?? []);
            setError(null);
        }).catch((err) => {
            if (alive) setError(messageOf(err));
        });
        return () => { alive = false; };
    }, [quarter, departmentId, version]);

    useEffect(() => {
        if (!canReadUsers || !canManage) return undefined;
        let alive = true;
        get<UserDto[]>("/api/users").then((list) => { if (alive) setUsers(Array.isArray(list) ? list : []); }).catch(() => undefined);
        return () => { alive = false; };
    }, [canReadUsers, canManage]);

    const reload = useCallback(() => setVersion((v) => v + 1), []);

    const sections = useMemo(() => {
        if (!goals) return [];
        const byDept = new Map<number, Goal[]>();
        for (const g of goals) byDept.set(g.departmentId, [...(byDept.get(g.departmentId) ?? []), g]);
        return [...byDept.entries()]
            .map(([id, list]) => {
                const perf = performance.find((p) => p.departmentId === id);
                const dept = departments.find((d) => d.id === id);
                return {
                    id,
                    name: list[0]?.departmentName ?? dept?.name ?? "Department",
                    seal: sealOf(perf?.departmentColor ?? dept?.color),
                    perf,
                    goals: list,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [goals, performance, departments]);

    // Which departments the user may create goals in: all for admins, their own otherwise.
    const manageable = isAdmin ? departments : departments.filter((d) => d.id === user?.departmentId);
    const canCreate = canManage && manageable.length > 0;
    const importLink = pages.has("import");
    const connectionsLink = pages.has("connections");

    return (
        <section className="ms-biz ms-goals">
            <PageHeader
                eyebrow="Performance"
                title="Goals"
                count={goals?.length ?? null}
                description="Each department's KPIs for the quarter: where they started, where they are and where they aim to be."
                actions={canCreate && (
                    <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setMode({ kind: "create" })}>
                        New goal
                    </Button>
                )}
            />

            {error && (
                <Alert tone="danger" role="alert" className="ms-notice">
                    <span>Could not load goals: {error}</span>
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
                <QuarterSelect id="goals-quarter" value={quarter} options={quarters} onChange={setQuarter} />
                <DepartmentSelect id="goals-dept" value={departmentId} departments={departments} onChange={setDepartmentId} />
                <p className="ms-muted ms-goals__how">
                    Check-ins are recorded here, imported from CSV
                    {importLink ? <> (<Link className="ms-link" to="/import">Import data</Link>)</> : null}
                    {" "}or pushed by your tools with an API key
                    {connectionsLink ? <> (<Link className="ms-link" to="/connections">Connections</Link>)</> : null}.
                </p>
            </div>

            {goals === null && !error && <div className="ms-empty"><p>Loading goals…</p></div>}

            {goals !== null && sections.length === 0 && (
                <div className="ms-empty">
                    <p className="ms-empty__title">No goals for {quarterLabel(quarter)} yet.</p>
                    <p>{canCreate ? "Set the first KPI for a department and record its progress through the quarter." : "Goals appear here once a manager sets them."}</p>
                    {canCreate && (
                        <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setMode({ kind: "create" })}>New goal</Button>
                    )}
                </div>
            )}

            {sections.map((section, si) => (
                <section key={section.id} {...reveal(si, "ms-panel ms-goals__dept")} data-seal={section.seal ?? undefined} aria-labelledby={`goals-d${section.id}`}>
                    <div className="ms-goals__dept-head">
                        <ScoreRing value={section.perf?.score ?? null} label={`${section.name} performance score`} size={60} />
                        <div className="ms-goals__dept-text">
                            <h2 className="ms-bsection__title ms-goals__dept-name" id={`goals-d${section.id}`}>
                                <SealMini seal={section.seal} />
                                {section.name}
                            </h2>
                            <p className="ms-muted">
                                {section.perf
                                    ? `${section.perf.goalsWithData} of ${section.perf.goalCount} goals with check-ins · weighted score`
                                    : `${section.goals.length} goals`}
                            </p>
                        </div>
                        <AttainmentPill attainment={section.perf?.score ?? null} />
                    </div>
                    <ul className="ms-goals__list">
                        {section.goals.map((goal) => (
                            <GoalRow key={goal.id} goal={goal}
                                onOpen={() => setMode({ kind: "detail", goal })}
                                onEdit={() => setMode({ kind: "edit", goal })}
                                onDelete={() => setMode({ kind: "delete", goal })} />
                        ))}
                    </ul>
                </section>
            ))}

            {(mode?.kind === "create" || mode?.kind === "edit") && (
                <GoalDialog
                    goal={mode.kind === "edit" ? mode.goal : null}
                    quarter={mode.kind === "edit" ? { year: mode.goal.year, quarter: mode.goal.quarter } : quarter}
                    quarters={quarters}
                    departments={manageable.length > 0 || mode.kind === "create" ? manageable : departments}
                    defaultDepartment={departmentId || (user?.departmentId != null ? String(user.departmentId) : "")}
                    users={users}
                    onClose={() => setMode(null)}
                    onSaved={(text) => { setMode(null); setNotice(text); reload(); }}
                />
            )}
            {mode?.kind === "delete" && (
                <DeleteGoalDialog goal={mode.goal} onClose={() => setMode(null)}
                    onDeleted={(text) => { setMode(null); setNotice(text); reload(); }} />
            )}
            {mode?.kind === "detail" && (
                <GoalDetail goal={mode.goal} now={now} onClose={() => setMode(null)} onChanged={reload} />
            )}
        </section>
    );
}

function GoalRow({ goal, onOpen, onEdit, onDelete }: { goal: Goal; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
    const DirIcon = goal.direction === "LOWER_IS_BETTER" ? ArrowDownRight : ArrowUpRight;
    const width = attainmentWidth(goal.attainment);
    return (
        <li className="ms-goals__goal">
            <div className="ms-goals__goal-main">
                <h3 className="ms-goals__goal-name">
                    <button type="button" className="ms-goals__open" onClick={onOpen}>{goal.name}</button>
                </h3>
                <p className="ms-muted ms-goals__meta">
                    <span className="ms-goals__dir"><DirIcon aria-hidden="true" />{directionHint(goal.direction)}</span>
                    <span>Unit: {goal.unit}</span>
                    <span>Weight {goal.weight}</span>
                    <span>{goal.ownerName ? `Owner: ${goal.ownerName}` : "No owner"}</span>
                </p>
            </div>
            <dl className="ms-goals__figures">
                <div><dt>Baseline</dt><dd>{formatGoalValue(goal.baseline, goal.unit)}</dd></div>
                <div><dt>Current</dt><dd className="ms-goals__current">{formatGoalValue(goal.currentValue, goal.unit)}</dd></div>
                <div><dt>Target</dt><dd>{formatGoalValue(goal.target, goal.unit)}</dd></div>
            </dl>
            <div className="ms-goals__progress">
                <div className="ms-goals__bar" role="img"
                    aria-label={goal.attainment === null ? "No check-ins yet" : `${Math.round(goal.attainment)}% of the way from baseline to target`}>
                    <span className="ms-goals__fill" style={{ width: `${width}%` }} />
                </div>
                <p className="ms-goals__att">
                    <strong>{goal.attainment === null ? "—" : `${Math.round(goal.attainment)}%`}</strong>
                    <AttainmentPill attainment={goal.attainment} />
                </p>
                <p className="ms-muted">
                    {goal.lastCheckinDate ? `Last check-in ${formatDate(goal.lastCheckinDate)}` : "No check-ins yet"}
                    {goal.checkinCount > 0 ? ` · ${goal.checkinCount} in total` : ""}
                </p>
            </div>
            <div className="ms-goals__actions">
                <Button size="sm" variant={goal.canCheckIn ? "secondary" : "ghost"} icon={goal.canCheckIn ? <ListPlus aria-hidden="true" /> : undefined} onClick={onOpen}>
                    {goal.canCheckIn ? "Check in" : "Details"}
                    <span className="ms-visually-hidden"> for {goal.name}</span>
                </Button>
                {goal.canEdit && (
                    <>
                        <Button size="sm" variant="ghost" icon={<Pencil aria-hidden="true" />} onClick={onEdit} aria-label={`Edit ${goal.name}`} title="Edit goal" />
                        <Button size="sm" variant="ghost-danger" icon={<Trash2 aria-hidden="true" />} onClick={onDelete} aria-label={`Delete ${goal.name}`} title="Delete goal" />
                    </>
                )}
            </div>
        </li>
    );
}

function GoalDialog({ goal, quarter, quarters, departments, defaultDepartment, users, onClose, onSaved }: {
    goal: Goal | null;
    quarter: Quarter;
    quarters: readonly Quarter[];
    departments: readonly { id: number; name: string }[];
    defaultDepartment: string;
    users: readonly UserDto[];
    onClose: () => void;
    onSaved: (notice: string) => void;
}) {
    const initialDept = goal ? String(goal.departmentId)
        : departments.some((d) => String(d.id) === defaultDepartment) ? defaultDepartment : String(departments[0]?.id ?? "");
    const [form, setForm] = useState<GoalForm>(goal ? {
        departmentId: String(goal.departmentId),
        name: goal.name,
        description: goal.description ?? "",
        unit: goal.unit,
        direction: goal.direction,
        baseline: String(goal.baseline),
        target: String(goal.target),
        weight: String(goal.weight),
        ownerId: goal.ownerId != null ? String(goal.ownerId) : "",
    } : { ...EMPTY_FORM, departmentId: initialDept });
    const [period, setPeriod] = useState<Quarter>(quarter);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const set = (field: keyof GoalForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [field]: e.target.value }));
    const owners = users.filter((u) => String(u.departmentId) === form.departmentId && u.status !== "Inactive");
    const directionNote = form.direction === "HIGHER_IS_BETTER" ? "The target must be above the baseline." : "The target must be below the baseline.";

    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const problem = goalFormProblem(form);
        if (problem) { setError(problem); return; }
        const body: GoalRequest = {
            departmentId: form.departmentId ? Number(form.departmentId) : null,
            name: form.name.trim(),
            description: form.description.trim() || null,
            unit: form.unit.trim(),
            direction: form.direction,
            baseline: parseDecimal(form.baseline) as number,
            target: parseDecimal(form.target) as number,
            weight: form.weight.trim() ? Number(form.weight) : 1,
            year: period.year,
            quarter: period.quarter,
            ownerId: form.ownerId ? Number(form.ownerId) : null,
        };
        setBusy(true);
        setError(null);
        try {
            if (goal) await put(`/api/goals/${goal.id}`, body);
            else await post("/api/goals", body);
            onSaved(goal ? `Saved "${body.name}".` : `Created "${body.name}" for ${quarterLabel(period)}.`);
        } catch (err) {
            setError(messageOf(err));
            setBusy(false);
        }
    }

    return (
        <Dialog eyebrow="Goals" title={goal ? "Edit goal" : "New goal"}
            description="A KPI for one department and quarter. Progress is measured from the baseline toward the target."
            onClose={onClose} busy={busy}>
            <form onSubmit={submit} noValidate>
                <DialogBody>
                    <div className="ms-dialog__grid">
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="g-dept">Department</label>
                            <div className="ms-select">
                                <select id="g-dept" className="ms-input" value={form.departmentId} onChange={set("departmentId")} disabled={departments.length <= 1}>
                                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <QuarterSelect id="g-quarter" value={period} options={quarters} onChange={setPeriod} />
                    </div>
                    <div className="ms-field">
                        <label className="ms-field__label" htmlFor="g-name">Name</label>
                        <input id="g-name" data-autofocus className="ms-input" value={form.name} onChange={set("name")} maxLength={120} required placeholder="Bugs closed per sprint" />
                    </div>
                    <div className="ms-field">
                        <label className="ms-field__label" htmlFor="g-desc">Description (optional)</label>
                        <textarea id="g-desc" className="ms-input ms-goals__textarea" value={form.description} onChange={set("description")} maxLength={500} rows={2} />
                    </div>
                    <div className="ms-dialog__grid">
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="g-unit">Unit</label>
                            <input id="g-unit" className="ms-input" value={form.unit} onChange={set("unit")} maxLength={20} placeholder="%, count, hours, EUR" />
                        </div>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="g-dir">Direction</label>
                            <div className="ms-select">
                                <select id="g-dir" className="ms-input" value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as GoalDirection }))}>
                                    <option value="HIGHER_IS_BETTER">Higher is better</option>
                                    <option value="LOWER_IS_BETTER">Lower is better</option>
                                </select>
                            </div>
                        </div>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="g-base">Baseline</label>
                            <input id="g-base" className="ms-input" inputMode="decimal" value={form.baseline} onChange={set("baseline")} />
                        </div>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="g-target">Target</label>
                            <input id="g-target" className="ms-input" inputMode="decimal" value={form.target} onChange={set("target")} aria-describedby="g-target-hint" />
                            <p className="ms-field__hint" id="g-target-hint">{directionNote}</p>
                        </div>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="g-weight">Weight (1 to 100)</label>
                            <input id="g-weight" className="ms-input" type="number" min={1} max={100} step={1} value={form.weight} onChange={set("weight")} />
                        </div>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="g-owner">Owner (optional)</label>
                            <div className="ms-select">
                                <select id="g-owner" className="ms-input" value={form.ownerId} onChange={set("ownerId")}>
                                    <option value="">No owner</option>
                                    {goal?.ownerId != null && !owners.some((u) => u.id === goal.ownerId) && (
                                        <option value={goal.ownerId}>{goal.ownerName ?? "Current owner"}</option>
                                    )}
                                    {owners.map((u) => <option key={u.id} value={u.id}>{u.fullName || u.email}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                    {error && <Alert tone="danger" role="alert">{error}</Alert>}
                </DialogBody>
                <DialogFooter>
                    <Button onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : goal ? "Save" : "Create goal"}</Button>
                </DialogFooter>
            </form>
        </Dialog>
    );
}

function DeleteGoalDialog({ goal, onClose, onDeleted }: { goal: Goal; onClose: () => void; onDeleted: (notice: string) => void }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    async function confirm() {
        setBusy(true);
        try {
            await del(`/api/goals/${goal.id}`);
            onDeleted(`Deleted "${goal.name}".`);
        } catch (err) {
            setError(messageOf(err));
            setBusy(false);
        }
    }
    return (
        <Dialog eyebrow="Delete goal" title="Delete goal?" tone="danger" size="sm" onClose={onClose} busy={busy}>
            <DialogBody>
                <div className="ms-confirm">
                    <span className="ms-confirm__icon" aria-hidden="true"><TriangleAlert /></span>
                    <p><strong>{goal.name}</strong> and its {goal.checkinCount} check-in{goal.checkinCount === 1 ? "" : "s"} will be deleted. The department score is recalculated without it.</p>
                </div>
                {error && <Alert tone="danger" role="alert">{error}</Alert>}
            </DialogBody>
            <DialogFooter>
                <Button onClick={onClose} disabled={busy}>Keep goal</Button>
                <Button variant="danger" onClick={confirm} disabled={busy}>{busy ? "Deleting…" : "Delete"}</Button>
            </DialogFooter>
        </Dialog>
    );
}

function GoalDetail({ goal, now, onClose, onChanged }: { goal: Goal; now: Date; onClose: () => void; onChanged: () => void }) {
    const [checkins, setCheckins] = useState<GoalCheckin[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [version, setVersion] = useState(0);
    const bounds = checkinDateBounds({ year: goal.year, quarter: goal.quarter }, now);
    const [form, setForm] = useState(() => ({ date: bounds.max, value: "", note: "" }));
    const [formError, setFormError] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        get<GoalCheckin[]>(`/api/goals/${goal.id}/checkins`)
            .then((list) => { if (alive) { setCheckins(Array.isArray(list) ? list : []); setError(null); } })
            .catch((err) => { if (alive) setError(messageOf(err)); });
        return () => { alive = false; };
    }, [goal.id, version]);

    const ordered = checkins ? [...checkins].reverse() : [];
    const values = ordered.map((c) => c.value);
    const lo = Math.min(goal.baseline, goal.target, ...values);
    const hi = Math.max(goal.baseline, goal.target, ...values);

    async function record(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const problem = checkinProblem(form, bounds);
        if (problem) { setFormError(problem); return; }
        setBusy(true);
        setFormError(null);
        try {
            await post(`/api/goals/${goal.id}/checkins`, { date: form.date, value: parseDecimal(form.value), note: form.note.trim() || null });
            setSaved(`Recorded ${formatGoalValue(parseDecimal(form.value), goal.unit)} for ${formatDate(form.date)}.`);
            setForm((f) => ({ ...f, value: "", note: "" }));
            setVersion((v) => v + 1);
            onChanged();
        } catch (err) {
            setFormError(messageOf(err));
        } finally {
            setBusy(false);
        }
    }

    async function remove(c: GoalCheckin) {
        setBusy(true);
        try {
            await del(`/api/goals/${goal.id}/checkins/${c.id}`);
            setVersion((v) => v + 1);
            onChanged();
        } catch (err) {
            setFormError(messageOf(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog eyebrow={`${goal.departmentName} · ${quarterLabel(goal)}`} title={goal.name}
            description={goal.description ?? `${directionHint(goal.direction)}. Measured in ${goal.unit}.`} onClose={onClose} busy={busy}>
            <DialogBody>
                <dl className="ms-dl">
                    <dt>Baseline</dt><dd>{formatGoalValue(goal.baseline, goal.unit)}</dd>
                    <dt>Target</dt><dd>{formatGoalValue(goal.target, goal.unit)} ({directionHint(goal.direction).toLowerCase()})</dd>
                    <dt>Current</dt><dd>{formatGoalValue(goal.currentValue, goal.unit)}{goal.attainment !== null ? `, ${Math.round(goal.attainment)}% of the way` : ""}</dd>
                    <dt>Owner</dt><dd>{goal.ownerName ?? "No owner"}</dd>
                    <dt>Weight</dt><dd>{goal.weight}</dd>
                    <dt>Goal id</dt><dd>{goal.id} <span className="ms-muted">(for CSV imports and the check-in API)</span></dd>
                </dl>

                {checkins && checkins.length > 1 && (
                    <div className="ms-goals__trend">
                        <Sparkline values={values} labels={ordered.map((c) => formatDate(c.date))} label={`${goal.name}, check-ins this quarter`}
                            format={(v) => formatGoalValue(v, goal.unit)} width={300} height={72} min={lo} max={hi} reference={goal.target} valueName={goal.unit} />
                        <p className="ms-muted">The thin line is the target.</p>
                    </div>
                )}

                {goal.canCheckIn && (
                    <form className="ms-goals__checkin" onSubmit={record} noValidate>
                        <h3 className="ms-goals__h">Record check-in</h3>
                        {bounds.open ? (
                            <>
                                <div className="ms-dialog__grid">
                                    <div className="ms-field">
                                        <label className="ms-field__label" htmlFor="c-date">Date</label>
                                        <input id="c-date" className="ms-input" type="date" min={bounds.min} max={bounds.max} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                                    </div>
                                    <div className="ms-field">
                                        <label className="ms-field__label" htmlFor="c-value">Value ({goal.unit})</label>
                                        <input id="c-value" data-autofocus className="ms-input" inputMode="decimal" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="ms-field">
                                    <label className="ms-field__label" htmlFor="c-note">Note (optional)</label>
                                    <input id="c-note" className="ms-input" maxLength={500} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                                </div>
                                {formError && <Alert tone="danger" role="alert">{formError}</Alert>}
                                {saved && <Alert tone="ok" role="status">{saved}</Alert>}
                                <div><Button type="submit" variant="primary" disabled={busy} icon={<ListPlus aria-hidden="true" />}>{busy ? "Saving…" : "Record check-in"}</Button></div>
                            </>
                        ) : (
                            <p className="ms-muted">This quarter has not started yet, so there is nothing to record.</p>
                        )}
                    </form>
                )}

                <h3 className="ms-goals__h">History</h3>
                {error && <Alert tone="danger" role="alert">{error}</Alert>}
                {checkins === null && !error && <p className="ms-muted">Loading check-ins…</p>}
                {checkins?.length === 0 && <p className="ms-muted">No check-ins yet this quarter.</p>}
                {checkins && checkins.length > 0 && (
                    <ul className="ms-goals__history">
                        {checkins.map((c) => (
                            <li key={c.id}>
                                <span className="ms-goals__hval">{formatGoalValue(c.value, goal.unit)}</span>
                                <span className="ms-muted">
                                    {formatDate(c.date)} · {c.source === "UI" ? "" : `${c.source} · `}{c.recordedBy ?? "unknown"}
                                    {c.note ? ` · ${c.note}` : ""}
                                </span>
                                {c.canDelete && (
                                    <Button size="sm" variant="ghost" icon={<Trash2 aria-hidden="true" />} disabled={busy}
                                        onClick={() => remove(c)} aria-label={`Delete the check-in of ${formatDate(c.date)}`} title="Delete check-in" />
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </DialogBody>
            <DialogFooter>
                <Button onClick={onClose} disabled={busy}>Close</Button>
            </DialogFooter>
        </Dialog>
    );
}
