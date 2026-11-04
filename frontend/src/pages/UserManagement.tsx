import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { CircleCheck, CircleMinus, Pencil, Plus, Search, Trash2, TriangleAlert } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, hasRole, primaryRole, ROLES, STATUSES } from "../auth/permissions";
import { del, get, post, put } from "../api/client";
import type { DepartmentResponse, UserDto, UserStatus } from "../api/types";
import { initialsOf } from "../utils/format";
import { passwordProblem, validateEmail } from "../utils/validators";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Dialog, { DialogBody, DialogFooter } from "../ui/Dialog";
import PageHeader from "../ui/PageHeader";
import { useReveal } from "../ui/useReveal";
import { SealMini } from "../ui/seal/Seal";
import { sealForColor } from "../ui/seal/seals";
import "../ui/field.css";
import "../ui/list.css";
import "./user-management.css";

type Mode = "create" | "edit" | "delete" | null;

interface UserForm {
    fullName: string;
    email: string;
    phone: string;
    role: string;
    status: UserStatus;
    departmentId: string;
    password: string;
}

const EMPTY_FORM: UserForm = {
    fullName: "",
    email: "",
    phone: "",
    role: "MEMBER",
    status: "Active",
    departmentId: "",
    password: "",
};

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

function StatusPill({ status }: { status: string }) {
    const active = status === "Active";
    const Icon = active ? CircleCheck : CircleMinus;
    return (
        <span className={`ms-status ms-status--${active ? "ok" : "neutral"}`}>
            <Icon aria-hidden="true" />
            {status}
        </span>
    );
}

export default function UserManagement() {
    const { user, refresh } = useAuth();

    const isAdmin = hasRole(user, "ADMIN");
    const isManager = !isAdmin && hasRole(user, "MANAGER");
    const canCreate = hasPermission(user, "USER_CREATE");
    const canUpdate = hasPermission(user, "USER_UPDATE");
    const canDelete = hasPermission(user, "USER_DELETE");

    const [members, setMembers] = useState<UserDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const reveal = useReveal(!loading);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [query, setQuery] = useState("");

    const [mode, setMode] = useState<Mode>(null);
    const [target, setTarget] = useState<UserDto | null>(null);
    const [form, setForm] = useState<UserForm>(EMPTY_FORM);
    const [formError, setFormError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [usersData, departmentsData] = await Promise.all([
                get<UserDto[]>("/api/users"),
                get<DepartmentResponse[]>("/api/departments"),
            ]);
            setMembers(Array.isArray(usersData) ? usersData : []);
            setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
            setLoadError(null);
        } catch (err) {
            setLoadError(messageOf(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return members;
        return members.filter((m) =>
            [m.fullName, m.email, m.departmentName, primaryRole(m), m.status]
                .filter((v): v is string => Boolean(v))
                .some((v) => v.toLowerCase().includes(q))
        );
    }, [members, query]);

    const colorById = useMemo(() => new Map(departments.map((d) => [d.id, d.color])), [departments]);

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

    const roleOptions = isAdmin ? ROLES : ROLES.filter((r) => r !== "ADMIN" && r !== "MANAGER");
    const departmentOptions = isAdmin
        ? departments
        : departments.filter((d) => d.id === user?.departmentId);

    function openCreate() {
        setForm(EMPTY_FORM);
        setFormError(null);
        setTarget(null);
        setMode("create");
    }

    function openEdit(member: UserDto) {
        setForm({
            fullName: member.fullName || "",
            email: member.email || "",
            phone: member.phone || "",
            role: primaryRole(member) === "—" ? "MEMBER" : primaryRole(member),
            status: member.status || "Active",
            departmentId: member.departmentId != null ? String(member.departmentId) : "",
            password: "",
        });
        setFormError(null);
        setTarget(member);
        setMode("edit");
    }

    function openDelete(member: UserDto) {
        setFormError(null);
        setTarget(member);
        setMode("delete");
    }

    function closeModal() {
        if (busy) return;
        setMode(null);
        setTarget(null);
        setFormError(null);
    }

    const setField = (field: keyof UserForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [field]: e.target.value }));

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setFormError(null);

        if (!form.fullName.trim()) return setFormError("Full name is required.");
        if (!validateEmail(form.email).ok) return setFormError("Enter a valid email address.");
        if (mode === "create") {
            const problem = passwordProblem(form.password);
            if (problem) return setFormError(`Password: ${problem.toLowerCase()}.`);
        }

        const payload = {
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            role: form.role,
            status: form.status,
            departmentId: form.departmentId === "" ? null : Number(form.departmentId),
        };

        setBusy(true);
        try {
            if (mode === "create") {
                const created = await post<UserDto>("/api/users", { ...payload, password: form.password });
                setNotice(`Created ${created.fullName}. They can sign in with the password you set.`);
            } else if (target) {
                await put(`/api/users/${target.id}`, payload);
                setNotice(`Saved changes to ${payload.fullName}.`);
                if (target.id === user?.id) await refresh();
            }
            setMode(null);
            setTarget(null);
            await load();
        } catch (err) {
            setFormError(messageOf(err));
        } finally {
            setBusy(false);
        }
    }

    async function confirmDelete() {
        if (!target) return;
        setBusy(true);
        setFormError(null);
        try {
            await del(`/api/users/${target.id}`);
            setNotice(`Deleted ${target.fullName || target.email}.`);
            setMode(null);
            setTarget(null);
            await load();
        } catch (err) {
            setFormError(messageOf(err));
        } finally {
            setBusy(false);
        }
    }

    const showActions = canUpdate || canDelete;
    const editingSelf = target?.id === user?.id;

    return (
        <section className="ms-users">
            <PageHeader
                eyebrow="People"
                title="User management"
                count={members.length}
                description="Manage who can sign in, their role and their department."
                actions={canCreate && (
                    <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={openCreate}>
                        Add user
                    </Button>
                )}
            />

            {loadError && (
                <Alert tone="danger" role="alert" className="ms-notice">
                    <span>Failed to load users: {loadError}</span>
                    <Button size="sm" onClick={load}>Retry</Button>
                </Alert>
            )}
            {notice && (
                <Alert tone="ok" role="status" className="ms-notice">
                    <span>{notice}</span>
                    <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>
                </Alert>
            )}

            <div className="ms-toolbar">
                <div className="ms-search">
                    <label className="ms-visually-hidden" htmlFor="user-search">Search users</label>
                    <Search aria-hidden="true" />
                    <input
                        id="user-search"
                        className="ms-input"
                        type="search"
                        placeholder="Search name, email, role, department…"
                        autoComplete="off"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
            </div>
            {!loading && members.length > 0 && (
                <p className="ms-result-count" aria-live="polite">
                    Showing {filtered.length} of {members.length} {members.length === 1 ? "user" : "users"}
                </p>
            )}

            {loading && members.length === 0 ? (
                <div className="ms-empty"><p>Loading team…</p></div>
            ) : filtered.length === 0 ? (
                <div className="ms-empty">
                    <p className="ms-empty__title">{members.length === 0 ? "No users yet." : `No users match “${query}”.`}</p>
                </div>
            ) : (
                <div className="ms-table-wrap">
                    <table className="ms-table ms-users__table">
                        <thead>
                            <tr>
                                <th scope="col">Full name</th>
                                <th scope="col">Email</th>
                                <th scope="col">Role</th>
                                <th scope="col">Status</th>
                                <th scope="col">Department</th>
                                {showActions && <th scope="col"><span className="ms-visually-hidden">Actions</span></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((member, i) => {
                                const editable = canEditMember(member);
                                const deletable = canDeleteMember(member);
                                const status = member.status || "Active";
                                const role = primaryRole(member);
                                const name = member.fullName || "Unnamed user";
                                const seal = member.departmentId != null && colorById.has(member.departmentId)
                                    ? sealForColor(colorById.get(member.departmentId)).key
                                    : null;
                                return (
                                    <tr key={member.id} {...reveal(i)}>
                                        <td className="ms-users__name">
                                            <span className="ms-users__avatar" aria-hidden="true">{initialsOf(member.fullName, "U")}</span>
                                            <span className="ms-users__pname">
                                                {name}
                                                {member.id === user?.id && <span className="ms-users__you"> (you)</span>}
                                            </span>
                                        </td>
                                        <td className="ms-users__email">{member.email}</td>
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
                                        {showActions && (
                                            <td className="ms-table__actions ms-users__act">
                                                {editable && (
                                                    <Button size="sm" className="ms-users__btn" icon={<Pencil aria-hidden="true" />} onClick={() => openEdit(member)}>
                                                        <span className="ms-users__btn-label">Edit</span>
                                                        <span className="ms-visually-hidden"> {member.fullName}</span>
                                                    </Button>
                                                )}
                                                {deletable && (
                                                    <Button size="sm" variant="ghost-danger" className="ms-users__btn" icon={<Trash2 aria-hidden="true" />} onClick={() => openDelete(member)}>
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

            {(mode === "create" || mode === "edit") && (
                <Dialog
                    eyebrow="Users"
                    title={mode === "create" ? "Add user" : "Edit user"}
                    description={mode === "create" ? "Create an account and choose its role." : `Update ${target?.fullName || "this user"}'s account.`}
                    onClose={closeModal}
                    busy={busy}
                >
                    <form onSubmit={handleSubmit}>
                        <DialogBody>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="u-name">Full name</label>
                                <input id="u-name" data-autofocus className="ms-input" value={form.fullName} onChange={setField("fullName")} required maxLength={100} />
                            </div>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="u-email">Email</label>
                                <input id="u-email" className="ms-input" type="email" value={form.email} onChange={setField("email")} required />
                            </div>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="u-phone">Phone (optional)</label>
                                <input id="u-phone" className="ms-input" value={form.phone} onChange={setField("phone")} placeholder="+40 7xx xxx xxx" />
                            </div>
                            <div className="ms-dialog__grid">
                                <div className="ms-field">
                                    <label className="ms-field__label" htmlFor="u-role">Role</label>
                                    <div className="ms-select">
                                        <select id="u-role" className="ms-input" value={form.role} onChange={setField("role")}>
                                            {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="ms-field">
                                    <label className="ms-field__label" htmlFor="u-status">Status</label>
                                    <div className="ms-select">
                                        <select
                                            id="u-status"
                                            className="ms-input"
                                            value={form.status}
                                            onChange={setField("status")}
                                            disabled={editingSelf}
                                            title={editingSelf ? "You cannot deactivate your own account" : undefined}
                                        >
                                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="u-dept">Department</label>
                                <div className="ms-select">
                                    <select id="u-dept" className="ms-input" value={form.departmentId} onChange={setField("departmentId")}>
                                        {isAdmin && <option value="">No department</option>}
                                        {departmentOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            {mode === "create" && (
                                <div className="ms-field">
                                    <label className="ms-field__label" htmlFor="u-pw">Initial password</label>
                                    <input id="u-pw" className="ms-input" type="password" autoComplete="new-password" value={form.password} onChange={setField("password")} required aria-describedby="u-pw-hint" />
                                    <p className="ms-field__hint" id="u-pw-hint">8+ characters with a number and a symbol. Share it with the user securely.</p>
                                </div>
                            )}

                            {formError && <Alert tone="danger" role="alert">{formError}</Alert>}
                        </DialogBody>
                        <DialogFooter>
                            <Button onClick={closeModal} disabled={busy}>Cancel</Button>
                            <Button type="submit" variant="primary" disabled={busy}>
                                {busy ? "Saving…" : mode === "create" ? "Create user" : "Save"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Dialog>
            )}

            {mode === "delete" && target && (
                <Dialog eyebrow="Delete user" title="Delete user?" tone="danger" size="sm" onClose={closeModal} busy={busy}>
                    <DialogBody>
                        <div className="ms-confirm">
                            <span className="ms-confirm__icon" aria-hidden="true"><TriangleAlert /></span>
                            <p>
                                <strong>{target.fullName}</strong> ({target.email}) will lose access
                                immediately. Their past activity stays in the audit log. This cannot be undone.
                            </p>
                        </div>
                        {formError && <Alert tone="danger" role="alert">{formError}</Alert>}
                    </DialogBody>
                    <DialogFooter>
                        <Button onClick={closeModal} disabled={busy}>Keep user</Button>
                        <Button variant="danger" onClick={confirmDelete} disabled={busy}>
                            {busy ? "Deleting…" : "Delete"}
                        </Button>
                    </DialogFooter>
                </Dialog>
            )}
        </section>
    );
}
