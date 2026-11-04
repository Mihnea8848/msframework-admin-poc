import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Crown, Search, UserMinus, UserPlus } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { hasPermission, hasRole, primaryRole } from "../../auth/permissions";
import { ApiError, del, get, post, put } from "../../api/client";
import type { UserDto } from "../../api/types";
import type {
    BudgetSummaryLite, DepartmentDetailsDto, DepartmentPerformanceLite, PerformanceOverviewLite, UserPage,
} from "../../api/people";
import { prefetchPage } from "../../app/pages";
import { visiblePages } from "../../routes/navigation";
import { formatMoney } from "../../utils/format";
import { eligibleManagers, quarterLabel, utilisation } from "../../utils/people";
import ActivityTimeline from "../../ui/ActivityTimeline";
import Alert from "../../ui/Alert";
import Avatar from "../../ui/Avatar";
import BackLink from "../../ui/BackLink";
import Button from "../../ui/Button";
import Dialog, { DialogBody, DialogFooter } from "../../ui/Dialog";
import StatusPill from "../../ui/StatusPill";
import { useReveal } from "../../ui/useReveal";
import OfficialSeal from "../../ui/seal/OfficialSeal";
import { sealForColor, sealRingTitle } from "../../ui/seal/seals";
import BudgetBar from "./BudgetBar";
import Sparkline from "./Sparkline";
import "../../ui/field.css";
import "../../ui/list.css";
import "../../ui/surface.css";
import "./department-detail.css";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));
const CANDIDATES = 8;

type Load = { key: string; dept: DepartmentDetailsDto | null; error: string | null; notFound: boolean };

export default function DepartmentDetail() {
    const { id: idParam } = useParams();
    const id = idParam && /^\d+$/.test(idParam) ? Number(idParam) : null;
    const { user } = useAuth();

    const isAdmin = hasRole(user, "ADMIN");
    const canAssignManager = isAdmin && hasPermission(user, "DEPARTMENT_UPDATE");
    const canManageMembers = hasPermission(user, "USER_UPDATE") && (isAdmin || (hasRole(user, "MANAGER") && user?.departmentId === id));
    const canReadAudit = hasPermission(user, "AUDIT_READ");
    const canReadPerformance = hasPermission(user, "GOALS_READ") || hasPermission(user, "REPORTS_READ");
    const canReadBudgets = hasPermission(user, "FINANCE_READ");
    const pages = visiblePages(user);
    const goalsPage = pages.find((p) => p.path === "/goals");
    const budgetsPage = pages.find((p) => p.path === "/budgets");

    // ---- The department -----------------------------------------------------------------
    const [reloadToken, setReloadToken] = useState(0);
    const requestKey = `${id}#${reloadToken}`;
    const [load, setLoad] = useState<Load | null>(null);
    const reload = useCallback(() => setReloadToken((t) => t + 1), []);

    useEffect(() => {
        if (id === null) return undefined;
        const controller = new AbortController();
        get<DepartmentDetailsDto>(`/api/departments/${id}`, { signal: controller.signal })
            .then((data) => setLoad({ key: requestKey, dept: data, error: null, notFound: false }))
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                const notFound = err instanceof ApiError && err.status === 404;
                setLoad((prev) => ({ key: requestKey, dept: notFound ? null : prev?.dept ?? null, error: messageOf(err), notFound }));
            });
        return () => controller.abort();
    }, [id, requestKey]);

    const dept = load?.dept && load.dept.id === id ? load.dept : null;
    const reveal = useReveal(dept !== null);

    // ---- Figures --------------------------------------------------------------------------
    const [performance, setPerformance] = useState<{ period: string; dept: DepartmentPerformanceLite | null } | null>(null);
    const [budget, setBudget] = useState<BudgetSummaryLite | null>(null);

    useEffect(() => {
        if (!canReadPerformance || id === null) return;
        get<PerformanceOverviewLite>("/api/performance")
            .then((data) => setPerformance({
                period: quarterLabel(data.year, data.quarter),
                dept: (data.departments ?? []).find((d) => d.departmentId === id) ?? null,
            }))
            .catch(() => setPerformance(null));
    }, [canReadPerformance, id]);

    useEffect(() => {
        if (!canReadBudgets || id === null) return;
        get<BudgetSummaryLite>(`/api/budgets?departmentId=${id}`)
            .then(setBudget)
            .catch(() => setBudget(null));
    }, [canReadBudgets, id, reloadToken]);

    // ---- Manager --------------------------------------------------------------------------
    const members = useMemo(() => dept?.members ?? [], [dept]);
    const eligible = useMemo(() => eligibleManagers(members), [members]);
    const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
    const [managerChoice, setManagerChoice] = useState<string | null>(null);
    const [managerBusy, setManagerBusy] = useState(false);
    const [managerError, setManagerError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const currentManager = dept?.managerId != null ? String(dept.managerId) : "";
    const chosenManager = managerChoice ?? currentManager;

    async function saveManager() {
        if (!dept) return;
        setManagerBusy(true);
        setManagerError(null);
        try {
            await put(`/api/departments/${dept.id}/manager`, { userId: chosenManager === "" ? null : Number(chosenManager) });
            const chosen = members.find((m) => String(m.id) === chosenManager);
            setNotice(chosen ? `${chosen.fullName || chosen.email} now manages ${dept.name}.` : `${dept.name} has no manager now.`);
            setManagerChoice(null);
            reload();
        } catch (err) {
            setManagerError(messageOf(err));
        } finally {
            setManagerBusy(false);
        }
    }

    // ---- Members --------------------------------------------------------------------------
    const [memberError, setMemberError] = useState<string | null>(null);
    const [removing, setRemoving] = useState<UserDto | null>(null);
    const [removeBusy, setRemoveBusy] = useState(false);
    const [adding, setAdding] = useState(false);

    async function confirmRemove() {
        if (!dept || !removing) return;
        setRemoveBusy(true);
        setMemberError(null);
        try {
            await del(`/api/departments/${dept.id}/members/${removing.id}`);
            setNotice(`${removing.fullName || removing.email} is no longer in ${dept.name}.`);
            setRemoving(null);
            reload();
        } catch (err) {
            setMemberError(messageOf(err));
        } finally {
            setRemoveBusy(false);
        }
    }

    if (id === null || load?.notFound) {
        return (
            <section className="ms-dept">
                <BackLink to="/departments" label="Departments" />
                <div className="ms-empty">
                    <p className="ms-empty__title">This department does not exist.</p>
                    <p>It may have been deleted. <Link className="ms-link" to="/departments">Back to departments</Link></p>
                </div>
            </section>
        );
    }

    if (!dept) {
        return (
            <section className="ms-dept">
                <BackLink to="/departments" label="Departments" />
                {load?.error ? (
                    <Alert tone="danger" role="alert" className="ms-notice">
                        <span>Could not load this department: {load.error}</span>
                        <Button size="sm" onClick={reload}>Retry</Button>
                    </Alert>
                ) : (
                    <div className="ms-empty"><p>Loading department…</p></div>
                )}
            </section>
        );
    }

    const seal = sealForColor(dept.color);
    const prefetchProfile = () => prefetchPage("userProfile");
    const manager = members.find((m) => m.id === dept.managerId) ?? null;
    const perf = performance?.dept ?? null;
    const used = budget ? utilisation(budget.totals.spent, budget.totals.budget) : null;
    const budgetLines = (budget?.lines ?? []).filter((l) => l.amount > 0 || l.spent > 0 || l.committed > 0);

    return (
        <section className="ms-dept">
            <BackLink to="/departments" label="Departments" />

            {notice && (
                <Alert tone="ok" role="status" className="ms-notice">
                    <span>{notice}</span>
                    <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>
                </Alert>
            )}

            <header className="ms-cut ms-dept__hero" data-seal={seal.key}>
                <OfficialSeal className="ms-dept__seal" seal={seal.key} title={sealRingTitle(dept.name, seal)} />
                <div className="ms-dept__id">
                    <p className="ms-dept__eyebrow">Department · {seal.name} seal</p>
                    <h1 className="ms-dept__name">{dept.name}</h1>
                    <p className="ms-dept__meta">
                        <b>{dept.memberCount}</b> {dept.memberCount === 1 ? "member" : "members"}
                        {" · "}<b>{dept.activeMemberCount}</b> active
                        {" · "}
                        {dept.managerName ? <>Led by <b>{dept.managerName}</b></> : "No manager"}
                    </p>
                </div>
            </header>

            <div className="ms-dept__grid">
                <section {...reveal(0, "ms-panel ms-dept__members")} aria-labelledby="dept-members">
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id="dept-members">Members</h2>
                        {canManageMembers && (
                            <Button size="sm" icon={<UserPlus aria-hidden="true" />} onClick={() => { setMemberError(null); setAdding(true); }}>
                                Add member
                            </Button>
                        )}
                    </div>
                    {memberError && !removing && <Alert tone="danger" role="alert" className="ms-dept__error">{memberError}</Alert>}
                    {members.length === 0 ? (
                        <div className="ms-dept__empty">
                            <p>No one is in this department yet.</p>
                            {canManageMembers && <p>Use <b>Add member</b> to move people here.</p>}
                        </div>
                    ) : (
                        <ul className="ms-dept__list">
                            {members.map((m) => {
                                const role = primaryRole(m);
                                return (
                                    <li key={m.id} className="ms-dept__person">
                                        <Avatar name={m.fullName} size="sm" />
                                        <div className="ms-dept__who">
                                            <Link className="ms-dept__link" to={`/users/${m.id}`} onMouseEnter={prefetchProfile} onFocus={prefetchProfile}>
                                                {m.fullName || m.email}
                                            </Link>
                                            {m.id === dept.managerId && (
                                                <span className="ms-dept__lead"><Crown aria-hidden="true" />Manager</span>
                                            )}
                                            <span className="ms-dept__title">{m.title || m.email}</span>
                                        </div>
                                        <span className={`ms-role${role === "ADMIN" ? " ms-role--admin" : ""}`}>{role}</span>
                                        <StatusPill status={m.status} />
                                        {canManageMembers && (
                                            <Button
                                                size="sm"
                                                variant="ghost-danger"
                                                className="ms-dept__remove"
                                                icon={<UserMinus aria-hidden="true" />}
                                                onClick={() => { setMemberError(null); setRemoving(m); }}
                                            >
                                                <span className="ms-dept__remove-label">Remove</span>
                                                <span className="ms-visually-hidden"> {m.fullName || m.email}</span>
                                            </Button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                <div className="ms-dept__side">
                    <section {...reveal(1, "ms-panel")} aria-labelledby="dept-manager">
                        <div className="ms-panel__head"><h2 className="ms-panel__title" id="dept-manager">Manager</h2></div>
                        <div className="ms-dept__body">
                            {manager ? (
                                <div className="ms-dept__manager">
                                    <Avatar name={manager.fullName} />
                                    <div>
                                        <Link className="ms-dept__link" to={`/users/${manager.id}`} onMouseEnter={prefetchProfile}>{manager.fullName || manager.email}</Link>
                                        <p className="ms-dept__title">{manager.title || primaryRole(manager)}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="ms-dept__muted">{dept.managerName ? dept.managerName : "This department has no manager."}</p>
                            )}
                            {canAssignManager && (
                                <form
                                    className="ms-dept__assign"
                                    onSubmit={(e) => { e.preventDefault(); void saveManager(); }}
                                >
                                    <div className="ms-field">
                                        <label className="ms-field__label" htmlFor="dept-manager-pick">Choose the manager</label>
                                        <div className="ms-select">
                                            <select
                                                id="dept-manager-pick"
                                                className="ms-input"
                                                value={chosenManager}
                                                onChange={(e) => setManagerChoice(e.target.value)}
                                                aria-describedby="dept-manager-hint"
                                            >
                                                <option value="">No manager</option>
                                                {eligible.map((m) => (
                                                    <option key={m.id} value={m.id}>{`${m.fullName || m.email} (${primaryRole(m)})`}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <p className="ms-field__hint" id="dept-manager-hint">
                                            {eligible.length === 0
                                                ? "No one can be chosen yet: the manager must be an active member with the MANAGER or ADMIN role."
                                                : "Active members with the MANAGER or ADMIN role."}
                                        </p>
                                    </div>
                                    {managerError && <Alert tone="danger" role="alert">{managerError}</Alert>}
                                    <Button type="submit" size="sm" variant="primary" disabled={managerBusy || chosenManager === currentManager}>
                                        {managerBusy ? "Saving…" : "Save manager"}
                                    </Button>
                                </form>
                            )}
                        </div>
                    </section>

                    {canReadPerformance && (
                        <section {...reveal(2, "ms-panel")} aria-labelledby="dept-perf">
                            <div className="ms-panel__head">
                                <h2 className="ms-panel__title" id="dept-perf">Performance</h2>
                                {performance && <span className="ms-panel__meta">{performance.period}</span>}
                            </div>
                            <div className="ms-dept__body">
                                {!performance ? (
                                    <p className="ms-dept__muted">Loading…</p>
                                ) : !perf || perf.goalCount === 0 ? (
                                    <p className="ms-dept__muted">No goals for this quarter yet.</p>
                                ) : (
                                    <>
                                        <div className="ms-dept__score">
                                            <span className="ms-dept__big">{perf.score != null ? `${Math.round(perf.score)}%` : "—"}</span>
                                            <Sparkline trend={perf.trend} width={120} height={32} />
                                        </div>
                                        <p className="ms-dept__muted">
                                            {perf.score != null ? "Weighted attainment" : "No check-ins yet"} · {perf.goalsWithData} of {perf.goalCount}{" "}
                                            {perf.goalCount === 1 ? "goal has" : "goals have"} check-ins
                                        </p>
                                        <ul className="ms-dept__goals">
                                            {perf.goals.map((g) => (
                                                <li key={g.goalId}>
                                                    <span className="ms-dept__goal-name">{g.name}</span>
                                                    <span className="ms-dept__goal-value">{g.attainment != null ? `${Math.round(g.attainment)}%` : "No data"}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                                {goalsPage && (
                                    <Link className="ms-link ms-dept__more" to={`${goalsPage.path}?departmentId=${dept.id}`}>
                                        Open goals <ArrowRight aria-hidden="true" />
                                    </Link>
                                )}
                            </div>
                        </section>
                    )}

                    {canReadBudgets && (
                        <section {...reveal(3, "ms-panel")} aria-labelledby="dept-budget">
                            <div className="ms-panel__head">
                                <h2 className="ms-panel__title" id="dept-budget">Budget</h2>
                                {budget && <span className="ms-panel__meta">{quarterLabel(budget.year, budget.quarter)}</span>}
                            </div>
                            <div className="ms-dept__body">
                                {!budget ? (
                                    <p className="ms-dept__muted">Loading…</p>
                                ) : budget.totals.budget <= 0 && budget.totals.spent <= 0 && budget.totals.committed <= 0 ? (
                                    <p className="ms-dept__muted">No budget and no spending this quarter.</p>
                                ) : (
                                    <>
                                        <div className="ms-dept__score">
                                            <span className="ms-dept__big">{used != null ? `${used}%` : "—"}</span>
                                            <span className="ms-dept__muted">{used != null ? "of the budget spent" : "no budget set"}</span>
                                        </div>
                                        {used != null && <BudgetBar percent={used} className="ms-dept__bar" />}
                                        <dl className="ms-dept__money">
                                            <div><dt>Budget</dt><dd>{formatMoney(budget.totals.budget, budget.currency)}</dd></div>
                                            <div><dt>Spent</dt><dd>{formatMoney(budget.totals.spent, budget.currency)}</dd></div>
                                            <div><dt>Committed</dt><dd>{formatMoney(budget.totals.committed, budget.currency)}</dd></div>
                                            <div><dt>Remaining</dt><dd className={budget.totals.remaining < 0 ? "ms-dept__over" : undefined}>{formatMoney(budget.totals.remaining, budget.currency)}</dd></div>
                                        </dl>
                                        {budgetLines.length > 0 && (
                                            <ul className="ms-dept__goals">
                                                {budgetLines.map((l) => (
                                                    <li key={`${l.categoryId}`}>
                                                        <span className="ms-dept__goal-name">{l.categoryName || "Uncategorised"}</span>
                                                        <span className="ms-dept__goal-value">
                                                            {formatMoney(l.spent, budget.currency)} / {l.amount > 0 ? formatMoney(l.amount, budget.currency) : "no budget"}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </>
                                )}
                                {budgetsPage && (
                                    <Link className="ms-link ms-dept__more" to={`${budgetsPage.path}?departmentId=${dept.id}`}>
                                        Open budgets <ArrowRight aria-hidden="true" />
                                    </Link>
                                )}
                            </div>
                        </section>
                    )}
                </div>

                {canReadAudit && (
                    <section {...reveal(4, "ms-panel ms-dept__activity")} aria-labelledby="dept-activity">
                        <div className="ms-panel__head">
                            <h2 className="ms-panel__title" id="dept-activity">Activity</h2>
                            <span className="ms-panel__meta">About this department, newest first</span>
                        </div>
                        <ActivityTimeline key={`${dept.id}#${reloadToken}`} path={`/api/departments/${dept.id}/activity`} emptyText="No activity about this department yet." />
                    </section>
                )}
            </div>

            {removing && (
                <Dialog eyebrow="Members" title={`Remove ${removing.fullName || removing.email}?`} size="sm" tone="danger" onClose={() => { if (!removeBusy) setRemoving(null); }} busy={removeBusy}>
                    <DialogBody>
                        <p>They keep their account and role, without a department.{removing.id === dept.managerId ? " The department will have no manager." : ""}</p>
                        {memberError && <Alert tone="danger" role="alert">{memberError}</Alert>}
                    </DialogBody>
                    <DialogFooter>
                        <Button onClick={() => setRemoving(null)} disabled={removeBusy}>Keep</Button>
                        <Button variant="danger" onClick={confirmRemove} disabled={removeBusy}>{removeBusy ? "Removing…" : "Remove"}</Button>
                    </DialogFooter>
                </Dialog>
            )}

            {adding && (
                <AddMemberDialog
                    departmentId={dept.id}
                    departmentName={dept.name}
                    memberIds={memberIds}
                    onClose={() => setAdding(false)}
                    onAdded={(added) => {
                        setAdding(false);
                        setNotice(`${added.fullName || added.email} joined ${dept.name}.`);
                        reload();
                    }}
                />
            )}
        </section>
    );
}

/** Search for a user and move them into the department. */
function AddMemberDialog({ departmentId, departmentName, memberIds, onClose, onAdded }: {
    departmentId: number;
    departmentName: string;
    memberIds: ReadonlySet<number>;
    onClose: () => void;
    onAdded: (user: UserDto) => void;
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<{ q: string; users: UserDto[] } | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const q = query.trim();

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams({ sort: "name", page: "0", size: String(CANDIDATES + memberIds.size) });
            if (q) params.set("q", q);
            get<UserPage>(`/api/users/search?${params.toString()}`, { signal: controller.signal })
                .then((page) => setResults({ q, users: (page.items ?? []).filter((u) => !memberIds.has(u.id)).slice(0, CANDIDATES) }))
                .catch((err: unknown) => { if (!controller.signal.aborted) setError(messageOf(err)); });
        }, 250);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [q, memberIds]);

    async function add(candidate: UserDto) {
        setBusyId(candidate.id);
        setError(null);
        try {
            const added = await post<UserDto>(`/api/departments/${departmentId}/members/${candidate.id}`);
            onAdded(added ?? candidate);
        } catch (err) {
            setError(messageOf(err));
            setBusyId(null);
        }
    }

    const searching = results?.q !== q;

    return (
        <Dialog eyebrow="Members" title="Add a member" description={`Move someone into ${departmentName}.`} onClose={onClose} busy={busyId !== null}>
            <DialogBody>
                <div className="ms-search ms-dept__search">
                    <label className="ms-visually-hidden" htmlFor="add-member-search">Search people</label>
                    <Search aria-hidden="true" />
                    <input
                        id="add-member-search"
                        data-autofocus
                        className="ms-input"
                        type="search"
                        autoComplete="off"
                        placeholder="Search name, email or job title…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                {error && <Alert tone="danger" role="alert">{error}</Alert>}
                <ul className="ms-dept__candidates" aria-busy={searching}>
                    {results && results.users.length === 0 && !searching && (
                        <li className="ms-dept__muted">{q ? `No one outside ${departmentName} matches “${q}”.` : "Everyone is already in this department."}</li>
                    )}
                    {results?.users.map((u) => (
                        <li key={u.id} className="ms-dept__candidate">
                            <Avatar name={u.fullName} size="sm" />
                            <div className="ms-dept__who">
                                <span className="ms-dept__cand-name">{u.fullName || u.email}</span>
                                <span className="ms-dept__title">{u.departmentName ? `In ${u.departmentName}` : "No department"} · {primaryRole(u)}</span>
                            </div>
                            <Button size="sm" onClick={() => add(u)} disabled={busyId !== null}>
                                {busyId === u.id ? "Adding…" : "Add"}
                                <span className="ms-visually-hidden"> {u.fullName || u.email}</span>
                            </Button>
                        </li>
                    ))}
                </ul>
            </DialogBody>
            <DialogFooter>
                <Button onClick={onClose} disabled={busyId !== null}>Done</Button>
            </DialogFooter>
        </Dialog>
    );
}
