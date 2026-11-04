import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
    ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, TriangleAlert, X,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, hasRole, primaryRole, ROLES, STATUSES } from "../auth/permissions";
import { del, get, post } from "../api/client";
import type { DepartmentResponse, UserDto } from "../api/types";
import type { BulkAction, BulkUserResult, UserPage, UserSortField } from "../api/people";
import { prefetchPage } from "../app/pages";
import { formatDateTime, timeAgo } from "../utils/format";
import {
    USERS_PAGE_SIZE, hasUserFilters, nextSort, rangeLabel, readUserFilters, sortDirection, summariseBulk,
    updateUserFilters, userSearchPath, writeUserFilters,
} from "../utils/people";
import type { BulkSummary, UserFilters } from "../utils/people";
import Alert from "../ui/Alert";
import Avatar from "../ui/Avatar";
import Button from "../ui/Button";
import Dialog, { DialogBody, DialogFooter } from "../ui/Dialog";
import PageHeader from "../ui/PageHeader";
import StatusPill from "../ui/StatusPill";
import { useReveal } from "../ui/useReveal";
import { SealMini } from "../ui/seal/Seal";
import { sealForColor } from "../ui/seal/seals";
import UserFormDialog from "./users/UserFormDialog";
import "../ui/field.css";
import "../ui/list.css";
import "./user-management.css";

const SEARCH_DEBOUNCE_MS = 300;

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** A sortable column header: a button that flips the sort, with aria-sort on the cell. */
function SortHeader({ field, label, filters, onSort }: {
    field: UserSortField;
    label: string;
    filters: UserFilters;
    onSort: (field: UserSortField) => void;
}) {
    const direction = sortDirection(filters.sort, field);
    const Icon = direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ArrowUpDown;
    return (
        <th scope="col" aria-sort={direction}>
            <button type="button" className="ms-users__sort" onClick={() => onSort(field)}>
                {label}
                <Icon aria-hidden="true" />
            </button>
        </th>
    );
}

type BulkDialog = "deactivate" | "role" | "department" | null;
type RowDialog = { mode: "create" } | { mode: "edit"; member: UserDto } | { mode: "delete"; member: UserDto } | null;

export default function UserManagement() {
    const { user } = useAuth();

    const isAdmin = hasRole(user, "ADMIN");
    const isManager = !isAdmin && hasRole(user, "MANAGER");
    const canCreate = hasPermission(user, "USER_CREATE");
    const canUpdate = hasPermission(user, "USER_UPDATE");
    const canDelete = hasPermission(user, "USER_DELETE");

    // ---- Filters, in the URL --------------------------------------------------------------
    const [searchParams, setSearchParams] = useSearchParams();
    const filters = useMemo(() => readUserFilters(searchParams), [searchParams]);
    const [queryInput, setQueryInput] = useState(filters.q);
    const [syncedQuery, setSyncedQuery] = useState(filters.q);
    // The URL changed from outside (back button, a link): show its search text.
    if (filters.q !== syncedQuery) {
        setSyncedQuery(filters.q);
        if (filters.q !== queryInput.trim()) setQueryInput(filters.q);
    }

    const [selected, setSelected] = useState<Map<number, UserDto>>(() => new Map());

    const applyFilters = useCallback((change: Partial<UserFilters>, replace = false) => {
        const next = updateUserFilters(filters, change);
        if (Object.keys(change).some((k) => k !== "page")) setSelected(new Map());
        setSearchParams(writeUserFilters(next), { replace });
    }, [filters, setSearchParams]);

    useEffect(() => {
        const q = queryInput.trim();
        if (q === filters.q) return undefined;
        const timer = window.setTimeout(() => applyFilters({ q }, true), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [queryInput, filters.q, applyFilters]);

    // ---- Data -----------------------------------------------------------------------------
    const path = userSearchPath(filters);
    const [reloadToken, setReloadToken] = useState(0);
    const requestKey = `${path}#${reloadToken}`;
    const [result, setResult] = useState<{ key: string; page: UserPage | null; error: string | null } | null>(null);
    const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
    const loading = result?.key !== requestKey;
    const page = result?.page ?? null;
    const loadError = result?.key === requestKey ? result.error : null;
    const reveal = useReveal(page !== null);
    const reload = useCallback(() => setReloadToken((t) => t + 1), []);

    useEffect(() => {
        const controller = new AbortController();
        get<UserPage>(path, { signal: controller.signal })
            .then((data) => setResult({ key: requestKey, page: data, error: null }))
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                setResult((prev) => ({ key: requestKey, page: prev?.page ?? null, error: messageOf(err) }));
            });
        return () => controller.abort();
    }, [path, requestKey]);

    useEffect(() => {
        get<DepartmentResponse[]>("/api/departments")
            .then((data) => setDepartments(Array.isArray(data) ? data : []))
            .catch(() => setDepartments([]));
    }, [reloadToken]);

    const members = useMemo(() => page?.items ?? [], [page]);
    const total = page?.total ?? 0;
    const totalPages = Math.max(1, page?.totalPages ?? 1);
    const colorById = useMemo(() => new Map(departments.map((d) => [d.id, d.color])), [departments]);

    // A page past the end (rows were deleted, or a hand-edited URL): go to the last page.
    useEffect(() => {
        if (page && page.items.length === 0 && page.total > 0 && filters.page > 1) {
            applyFilters({ page: Math.max(1, page.totalPages) }, true);
        }
    }, [page, filters.page, applyFilters]);

    // ---- Permissions per row ----------------------------------------------------------------
    function canEditMember(member: UserDto) {
        if (!canUpdate) return false;
        if (isAdmin) return true;
        if (!isManager) return false;
        const memberIsPrivileged = hasRole(member, "ADMIN") || hasRole(member, "MANAGER");
        return !memberIsPrivileged && member.departmentId != null && member.departmentId === user?.departmentId;
    }

    function canDeleteMember(member: UserDto) {
        if (!canDelete || member.id === user?.id) return false;
        return isAdmin || !(hasRole(member, "ADMIN") || hasRole(member, "MANAGER"));
    }

    // ---- Selection and bulk actions ---------------------------------------------------------
    const canBulk = canUpdate;
    // Only people the user may change can be selected; the backend still checks each one.
    const selectable = members.filter((m) => canEditMember(m));
    const allOnPageSelected = selectable.length > 0 && selectable.every((m) => selected.has(m.id));
    const someOnPageSelected = selectable.some((m) => selected.has(m.id));

    function toggleOne(member: UserDto) {
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(member.id)) next.delete(member.id);
            else next.set(member.id, member);
            return next;
        });
    }

    function togglePage() {
        setSelected((prev) => {
            const next = new Map(prev);
            if (allOnPageSelected) selectable.forEach((m) => next.delete(m.id));
            else selectable.forEach((m) => next.set(m.id, m));
            return next;
        });
    }

    const [notice, setNotice] = useState<string | null>(null);
    const [bulkSummary, setBulkSummary] = useState<BulkSummary | null>(null);
    const [bulkDialog, setBulkDialog] = useState<BulkDialog>(null);
    const [bulkRole, setBulkRole] = useState("MEMBER");
    const [bulkDept, setBulkDept] = useState("");
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkError, setBulkError] = useState<string | null>(null);

    const bulkRoleOptions = isAdmin ? ROLES : ROLES.filter((r) => r !== "ADMIN" && r !== "MANAGER");
    const bulkDeptOptions = isAdmin ? departments : departments.filter((d) => d.id === user?.departmentId);

    function openBulk(kind: Exclude<BulkDialog, null>) {
        setBulkError(null);
        if (kind === "role") setBulkRole(bulkRoleOptions.includes("MEMBER") ? "MEMBER" : bulkRoleOptions[0] ?? "MEMBER");
        if (kind === "department") setBulkDept(bulkDeptOptions[0] ? String(bulkDeptOptions[0].id) : "");
        setBulkDialog(kind);
    }

    async function runBulk(action: BulkAction, verb: string, extra: { role?: string; departmentId?: number | null } = {}) {
        const ids = [...selected.keys()];
        if (ids.length === 0) return;
        const names = new Map([...selected.values()].map((m) => [m.id, m.fullName || m.email]));
        setBulkBusy(true);
        setBulkError(null);
        try {
            const res = await post<BulkUserResult>("/api/users/bulk", { action, ids, ...extra });
            setBulkSummary(summariseBulk(res, names, verb));
            setNotice(null);
            // Keep the users that failed selected, so the action can be retried after fixing them.
            const failed = new Set(res.results.filter((r) => !r.ok).map((r) => r.id));
            setSelected((prev) => new Map([...prev].filter(([id]) => failed.has(id))));
            setBulkDialog(null);
            reload();
        } catch (err) {
            if (bulkDialog) setBulkError(messageOf(err));
            else setBulkSummary({ succeeded: 0, failed: ids.length, failures: [], headline: messageOf(err), tone: "danger" });
        } finally {
            setBulkBusy(false);
        }
    }

    // ---- Add, edit, delete ------------------------------------------------------------------
    const [rowDialog, setRowDialog] = useState<RowDialog>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    function onSaved(message: string) {
        setRowDialog(null);
        setNotice(message);
        setBulkSummary(null);
        reload();
    }

    async function confirmDelete() {
        if (rowDialog?.mode !== "delete") return;
        const target = rowDialog.member;
        setDeleteBusy(true);
        setDeleteError(null);
        try {
            await del(`/api/users/${target.id}`);
            setSelected((prev) => {
                const next = new Map(prev);
                next.delete(target.id);
                return next;
            });
            onSaved(`Deleted ${target.fullName || target.email}.`);
        } catch (err) {
            setDeleteError(messageOf(err));
        } finally {
            setDeleteBusy(false);
        }
    }

    const showActions = canUpdate || canDelete;
    const filtered = hasUserFilters(filters);
    const selectFilter = (field: "role" | "status" | "departmentId") => (e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (field === "departmentId") applyFilters({ departmentId: value ? Number(value) : null });
        else applyFilters({ [field]: value } as Partial<UserFilters>);
    };
    const onSort = (field: UserSortField) => applyFilters({ sort: nextSort(filters.sort, field) });
    const prefetchProfile = () => prefetchPage("userProfile");

    return (
        <section className="ms-users">
            <PageHeader
                eyebrow="People"
                title="User management"
                count={page ? total : null}
                description="Find people, change their role or department, and open their profile."
                actions={canCreate && (
                    <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => setRowDialog({ mode: "create" })}>
                        Add user
                    </Button>
                )}
            />

            {loadError && (
                <Alert tone="danger" role="alert" className="ms-notice">
                    <span>Failed to load users: {loadError}</span>
                    <Button size="sm" onClick={reload}>Retry</Button>
                </Alert>
            )}
            {notice && (
                <Alert tone="ok" role="status" className="ms-notice">
                    <span>{notice}</span>
                    <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>
                </Alert>
            )}
            {bulkSummary && (
                <Alert tone={bulkSummary.tone} role="status" className="ms-notice ms-users__bulk-result">
                    <div>
                        <p className="ms-users__bulk-headline">{bulkSummary.headline}</p>
                        {bulkSummary.failures.length > 0 && (
                            <ul className="ms-users__failures">
                                {bulkSummary.failures.map((f) => (
                                    <li key={f.id}><strong>{f.name}</strong>: {f.message}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setBulkSummary(null)}>Dismiss</Button>
                </Alert>
            )}

            <div className="ms-toolbar ms-users__toolbar">
                <div className="ms-search">
                    <label className="ms-visually-hidden" htmlFor="user-search">Search users</label>
                    <Search aria-hidden="true" />
                    <input
                        id="user-search"
                        className="ms-input"
                        type="search"
                        placeholder="Search name, email or job title…"
                        autoComplete="off"
                        value={queryInput}
                        onChange={(e) => setQueryInput(e.target.value)}
                    />
                </div>
                <div className="ms-users__filters">
                    <div className="ms-select">
                        <label className="ms-visually-hidden" htmlFor="user-role">Role</label>
                        <select id="user-role" className="ms-input" value={filters.role} onChange={selectFilter("role")}>
                            <option value="">All roles</option>
                            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="ms-select">
                        <label className="ms-visually-hidden" htmlFor="user-status">Status</label>
                        <select id="user-status" className="ms-input" value={filters.status} onChange={selectFilter("status")}>
                            <option value="">All statuses</option>
                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="ms-select">
                        <label className="ms-visually-hidden" htmlFor="user-dept">Department</label>
                        <select id="user-dept" className="ms-input" value={filters.departmentId ?? ""} onChange={selectFilter("departmentId")}>
                            <option value="">All departments</option>
                            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    {filtered && (
                        <Button
                            size="sm"
                            variant="ghost"
                            icon={<X aria-hidden="true" />}
                            onClick={() => {
                                setQueryInput("");
                                applyFilters({ q: "", role: "", status: "", departmentId: null });
                            }}
                        >
                            Clear
                        </Button>
                    )}
                </div>
            </div>
            {page && (
                <p className="ms-result-count" aria-live="polite">
                    {rangeLabel(filters.page, USERS_PAGE_SIZE, members.length, total)}
                    {loading && " · updating…"}
                </p>
            )}

            {!page && loading ? (
                <div className="ms-empty"><p>Loading team…</p></div>
            ) : members.length === 0 ? (
                !loadError && (
                    <div className="ms-empty">
                        <p className="ms-empty__title">{filtered ? "No users match these filters." : "No users yet."}</p>
                        {filtered && <p>Try a different search, or clear the filters.</p>}
                    </div>
                )
            ) : (
                <div className="ms-table-wrap" aria-busy={loading}>
                    <table className={`ms-table ms-users__table${canBulk ? " ms-users__table--select" : ""}`}>
                        <thead>
                            <tr>
                                {canBulk && (
                                    <th scope="col" className="ms-users__check">
                                        <input
                                            type="checkbox"
                                            className="ms-users__checkbox"
                                            aria-label="Select all users on this page"
                                            checked={allOnPageSelected}
                                            disabled={selectable.length === 0}
                                            ref={(el) => { if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected; }}
                                            onChange={togglePage}
                                        />
                                    </th>
                                )}
                                <SortHeader field="name" label="Name" filters={filters} onSort={onSort} />
                                <th scope="col">Job title</th>
                                <th scope="col">Role</th>
                                <SortHeader field="status" label="Status" filters={filters} onSort={onSort} />
                                <SortHeader field="department" label="Department" filters={filters} onSort={onSort} />
                                <SortHeader field="lastLoginAt" label="Last sign-in" filters={filters} onSort={onSort} />
                                {showActions && <th scope="col"><span className="ms-visually-hidden">Actions</span></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {members.map((member, i) => {
                                const editable = canEditMember(member);
                                const deletable = canDeleteMember(member);
                                const status = member.status || "Active";
                                const role = primaryRole(member);
                                const name = member.fullName || "Unnamed user";
                                const seal = member.departmentId != null && colorById.has(member.departmentId)
                                    ? sealForColor(colorById.get(member.departmentId)).key
                                    : null;
                                const isSelected = selected.has(member.id);
                                return (
                                    <tr key={member.id} {...reveal(i, isSelected ? "ms-users__row--selected" : "")}>
                                        {canBulk && (
                                            <td className="ms-users__check">
                                                <input
                                                    type="checkbox"
                                                    className="ms-users__checkbox"
                                                    aria-label={`Select ${name}`}
                                                    checked={isSelected}
                                                    disabled={!editable}
                                                    title={editable ? undefined : "You cannot change this user"}
                                                    onChange={() => toggleOne(member)}
                                                />
                                            </td>
                                        )}
                                        <td className="ms-users__name">
                                            <div className="ms-users__person">
                                                <Avatar name={member.fullName} className="ms-users__avatar" />
                                                <span className="ms-users__pname">
                                                    <Link className="ms-users__link" to={`/users/${member.id}`} onMouseEnter={prefetchProfile} onFocus={prefetchProfile}>
                                                        {name}
                                                    </Link>
                                                    {member.id === user?.id && <span className="ms-users__you"> (you)</span>}
                                                </span>
                                                <span className="ms-users__email">{member.email}</span>
                                                <span className="ms-users__sub">{member.title || member.email}</span>
                                            </div>
                                        </td>
                                        <td className="ms-users__title">{member.title || <span className="ms-users__none">—</span>}</td>
                                        <td className="ms-users__role">
                                            <span className={`ms-role${role === "ADMIN" ? " ms-role--admin" : ""}`}>{role}</span>
                                        </td>
                                        <td className="ms-users__status"><StatusPill status={status} /></td>
                                        <td className="ms-users__dept">
                                            <span className={`ms-users__dept-chip${member.departmentName ? "" : " ms-users__dept-chip--none"}`}>
                                                <SealMini seal={member.departmentName ? seal : null} />
                                                <span>{member.departmentName || "None"}</span>
                                            </span>
                                        </td>
                                        <td className="ms-users__login">
                                            {member.lastLoginAt ? (
                                                <time dateTime={member.lastLoginAt} title={formatDateTime(member.lastLoginAt)}>
                                                    {timeAgo(member.lastLoginAt)}
                                                </time>
                                            ) : (
                                                <span className="ms-users__none">Never</span>
                                            )}
                                        </td>
                                        {showActions && (
                                            <td className="ms-table__actions ms-users__act">
                                                {editable && (
                                                    <Button size="sm" className="ms-users__btn" icon={<Pencil aria-hidden="true" />} onClick={() => setRowDialog({ mode: "edit", member })}>
                                                        <span className="ms-users__btn-label">Edit</span>
                                                        <span className="ms-visually-hidden"> {member.fullName}</span>
                                                    </Button>
                                                )}
                                                {deletable && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost-danger"
                                                        className="ms-users__btn"
                                                        icon={<Trash2 aria-hidden="true" />}
                                                        onClick={() => { setDeleteError(null); setRowDialog({ mode: "delete", member }); }}
                                                    >
                                                        <span className="ms-users__btn-label">Delete</span>
                                                        <span className="ms-visually-hidden"> {member.fullName}</span>
                                                    </Button>
                                                )}
                                                {!editable && !deletable && <span className="ms-users__locked">Locked</span>}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {page && totalPages > 1 && (
                <nav className="ms-users__pager" aria-label="Pages">
                    <Button
                        size="sm"
                        icon={<ChevronLeft aria-hidden="true" />}
                        disabled={filters.page <= 1}
                        onClick={() => applyFilters({ page: filters.page - 1 })}
                    >
                        Previous
                    </Button>
                    <span className="ms-users__page" aria-current="page">Page {filters.page} of {totalPages}</span>
                    <Button
                        size="sm"
                        disabled={filters.page >= totalPages}
                        onClick={() => applyFilters({ page: filters.page + 1 })}
                    >
                        Next
                        <ChevronRight aria-hidden="true" />
                    </Button>
                </nav>
            )}

            {canBulk && selected.size > 0 && (
                <div className="ms-users__bulkbar" role="region" aria-label="Bulk actions">
                    <p className="ms-users__bulk-count" aria-live="polite">
                        <strong>{selected.size}</strong> selected
                    </p>
                    <div className="ms-users__bulk-actions">
                        <Button size="sm" disabled={bulkBusy} onClick={() => runBulk("ACTIVATE", "Activated")}>Activate</Button>
                        <Button size="sm" disabled={bulkBusy} onClick={() => openBulk("deactivate")}>Deactivate</Button>
                        <Button size="sm" disabled={bulkBusy} onClick={() => openBulk("role")}>Change role</Button>
                        <Button size="sm" disabled={bulkBusy} onClick={() => openBulk("department")}>Move to department</Button>
                    </div>
                    <Button size="sm" variant="ghost" className="ms-users__bulk-clear" disabled={bulkBusy} onClick={() => setSelected(new Map())}>
                        Clear<span className="ms-visually-hidden"> selection</span>
                    </Button>
                </div>
            )}

            {bulkDialog === "deactivate" && (
                <Dialog eyebrow="Bulk change" title={`Deactivate ${selected.size === 1 ? "1 user" : `${selected.size} users`}?`} tone="danger" size="sm" onClose={() => setBulkDialog(null)} busy={bulkBusy}>
                    <DialogBody>
                        <div className="ms-confirm">
                            <span className="ms-confirm__icon" aria-hidden="true"><TriangleAlert /></span>
                            <p>They are signed out everywhere and cannot sign in until they are activated again. Their history is kept.</p>
                        </div>
                        {bulkError && <Alert tone="danger" role="alert">{bulkError}</Alert>}
                    </DialogBody>
                    <DialogFooter>
                        <Button onClick={() => setBulkDialog(null)} disabled={bulkBusy}>Cancel</Button>
                        <Button variant="danger" onClick={() => runBulk("DEACTIVATE", "Deactivated")} disabled={bulkBusy}>
                            {bulkBusy ? "Deactivating…" : "Deactivate"}
                        </Button>
                    </DialogFooter>
                </Dialog>
            )}

            {bulkDialog === "role" && (
                <Dialog eyebrow="Bulk change" title="Change role" description={`For ${selected.size === 1 ? "1 selected user" : `${selected.size} selected users`}.`} size="sm" onClose={() => setBulkDialog(null)} busy={bulkBusy}>
                    <form onSubmit={(e) => { e.preventDefault(); void runBulk("SET_ROLE", "Changed the role of", { role: bulkRole }); }}>
                        <DialogBody>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="bulk-role">New role</label>
                                <div className="ms-select">
                                    <select id="bulk-role" data-autofocus className="ms-input" value={bulkRole} onChange={(e) => setBulkRole(e.target.value)}>
                                        {bulkRoleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            </div>
                            {bulkError && <Alert tone="danger" role="alert">{bulkError}</Alert>}
                        </DialogBody>
                        <DialogFooter>
                            <Button onClick={() => setBulkDialog(null)} disabled={bulkBusy}>Cancel</Button>
                            <Button type="submit" variant="primary" disabled={bulkBusy}>{bulkBusy ? "Saving…" : "Change role"}</Button>
                        </DialogFooter>
                    </form>
                </Dialog>
            )}

            {bulkDialog === "department" && (
                <Dialog eyebrow="Bulk change" title="Move to department" description={`For ${selected.size === 1 ? "1 selected user" : `${selected.size} selected users`}.`} size="sm" onClose={() => setBulkDialog(null)} busy={bulkBusy}>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        void runBulk("SET_DEPARTMENT", "Moved", { departmentId: bulkDept === "" ? null : Number(bulkDept) });
                    }}
                    >
                        <DialogBody>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="bulk-dept">Department</label>
                                <div className="ms-select">
                                    <select id="bulk-dept" data-autofocus className="ms-input" value={bulkDept} onChange={(e) => setBulkDept(e.target.value)}>
                                        {isAdmin && <option value="">No department</option>}
                                        {bulkDeptOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            {bulkError && <Alert tone="danger" role="alert">{bulkError}</Alert>}
                        </DialogBody>
                        <DialogFooter>
                            <Button onClick={() => setBulkDialog(null)} disabled={bulkBusy}>Cancel</Button>
                            <Button type="submit" variant="primary" disabled={bulkBusy}>{bulkBusy ? "Moving…" : "Move"}</Button>
                        </DialogFooter>
                    </form>
                </Dialog>
            )}

            {(rowDialog?.mode === "create" || rowDialog?.mode === "edit") && (
                <UserFormDialog
                    mode={rowDialog.mode}
                    target={rowDialog.mode === "edit" ? rowDialog.member : null}
                    departments={departments}
                    onClose={() => setRowDialog(null)}
                    onSaved={onSaved}
                />
            )}

            {rowDialog?.mode === "delete" && (
                <Dialog eyebrow="Delete user" title="Delete user?" tone="danger" size="sm" onClose={() => setRowDialog(null)} busy={deleteBusy}>
                    <DialogBody>
                        <div className="ms-confirm">
                            <span className="ms-confirm__icon" aria-hidden="true"><TriangleAlert /></span>
                            <p>
                                <strong>{rowDialog.member.fullName}</strong> ({rowDialog.member.email}) will lose access
                                immediately. Their past activity stays in the audit log. This cannot be undone.
                            </p>
                        </div>
                        {deleteError && <Alert tone="danger" role="alert">{deleteError}</Alert>}
                    </DialogBody>
                    <DialogFooter>
                        <Button onClick={() => setRowDialog(null)} disabled={deleteBusy}>Keep user</Button>
                        <Button variant="danger" onClick={confirmDelete} disabled={deleteBusy}>
                            {deleteBusy ? "Deleting…" : "Delete"}
                        </Button>
                    </DialogFooter>
                </Dialog>
            )}
        </section>
    );
}
