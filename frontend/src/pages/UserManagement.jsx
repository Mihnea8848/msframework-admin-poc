import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, hasRole, primaryRole, ROLES, STATUSES } from "../auth/permissions";
import { del, get, post, put } from "../api/client.js";
import { initialsOf } from "../utils/format.js";
import { passwordProblem, validateEmail } from "../utils/validators.js";
import Modal, { ModalActions } from "../ui/Modal.jsx";
import PageHeader from "../ui/PageHeader.jsx";

const EMPTY_FORM = {
    fullName: "",
    email: "",
    phone: "",
    role: "MEMBER",
    status: "Active",
    departmentId: "",
    password: "",
};

export default function UserManagement() {
    const { user, refresh } = useAuth();

    const isAdmin = hasRole(user, "ADMIN");
    const isManager = !isAdmin && hasRole(user, "MANAGER");
    const canCreate = hasPermission(user, "USER_CREATE");
    const canUpdate = hasPermission(user, "USER_UPDATE");
    const canDelete = hasPermission(user, "USER_DELETE");

    const [members, setMembers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [query, setQuery] = useState("");

    // mode: "create" | "edit" | "delete" | null
    const [mode, setMode] = useState(null);
    const [target, setTarget] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [usersData, departmentsData] = await Promise.all([
                get("/api/users"),
                get("/api/departments"),
            ]);
            setMembers(Array.isArray(usersData) ? usersData : []);
            setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
            setLoadError(null);
        } catch (err) {
            setLoadError(err.message);
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
                .filter(Boolean)
                .some((v) => v.toLowerCase().includes(q))
        );
    }, [members, query]);

    function canEditMember(member) {
        if (!canUpdate) return false;
        if (isAdmin) return true;
        if (!isManager) return false;
        const memberIsPrivileged = hasRole(member, "ADMIN") || hasRole(member, "MANAGER");
        return !memberIsPrivileged && member.departmentId != null && member.departmentId === user?.departmentId;
    }

    function canDeleteMember(member) {
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

    function openEdit(member) {
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

    function openDelete(member) {
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

    const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

    async function handleSubmit(e) {
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
                const created = await post("/api/users", { ...payload, password: form.password });
                setNotice(`Created ${created.fullName}. They can sign in with the password you set.`);
            } else {
                await put(`/api/users/${target.id}`, payload);
                setNotice(`Saved changes to ${payload.fullName}.`);
                if (target.id === user?.id) await refresh();
            }
            setMode(null);
            setTarget(null);
            await load();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function confirmDelete() {
        setBusy(true);
        setFormError(null);
        try {
            await del(`/api/users/${target.id}`);
            setNotice(`Deleted ${target.fullName || target.email}.`);
            setMode(null);
            setTarget(null);
            await load();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setBusy(false);
        }
    }

    const showActions = canUpdate || canDelete;

    return (
        <section className="workspace">
            <PageHeader
                breadcrumb="Ventures / User management"
                title="User management"
                count={members.length}
                actions={canCreate && (
                    <button type="button" className="auth-primary" style={{ padding: "0 22px", minWidth: 140 }} onClick={openCreate}>
                        <Plus size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                        Add user
                    </button>
                )}
            />

            {loadError && (
                <div className="inline-error page-banner" role="alert">
                    Failed to load users: {loadError}{" "}
                    <button type="button" className="btn-secondary btn-small" onClick={load}>Retry</button>
                </div>
            )}
            {notice && (
                <div className="inline-success page-banner" onClick={() => setNotice(null)} role="status">
                    {notice}
                </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, maxWidth: 360 }}>
                <Search size={15} style={{ color: "var(--muted)" }} />
                <input
                    className="form-input"
                    placeholder="Search name, email, role, department…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search users"
                />
            </div>

            <div className="workspace-panel">
                <div className="data-table-shell">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Full name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Department</th>
                                {showActions && <th style={{ width: 190, paddingLeft: 24 }}>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && members.length === 0 && (
                                <tr><td colSpan={showActions ? 6 : 5} className="empty-state">Loading team…</td></tr>
                            )}
                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={showActions ? 6 : 5} className="empty-state">
                                        {members.length === 0 ? "No users yet." : `No users match “${query}”.`}
                                    </td>
                                </tr>
                            )}
                            {filtered.map((member) => {
                                const editable = canEditMember(member);
                                const deletable = canDeleteMember(member);
                                const status = member.status || "Active";
                                return (
                                    <tr key={member.id}>
                                        <td>
                                            <div className="member-cell">
                                                <div className="avatar avatar-azure">{initialsOf(member.fullName, "U")}</div>
                                                <span>
                                                    {member.fullName || "Unnamed user"}
                                                    {member.id === user?.id && <span className="muted-note"> (you)</span>}
                                                </span>
                                            </div>
                                        </td>
                                        <td>{member.email}</td>
                                        <td>{primaryRole(member)}</td>
                                        <td>
                                            <span className={`status-pill ${status.toLowerCase()}`}>{status}</span>
                                        </td>
                                        <td>{member.departmentName || "None"}</td>
                                        {showActions && (
                                            <td style={{ paddingLeft: 24 }}>
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    {editable && (
                                                        <button type="button" onClick={() => openEdit(member)} className="btn-secondary btn-small" aria-label={`Edit ${member.fullName}`}>
                                                            <Pencil size={13} /> Edit
                                                        </button>
                                                    )}
                                                    {deletable && (
                                                        <button type="button" onClick={() => openDelete(member)} className="btn-danger btn-small" aria-label={`Delete ${member.fullName}`}>
                                                            <Trash2 size={13} /> Delete
                                                        </button>
                                                    )}
                                                    {!editable && !deletable && (
                                                        <span style={{ color: "var(--muted)", fontSize: 12 }}>Locked</span>
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

            {(mode === "create" || mode === "edit") && (
                <Modal
                    title={mode === "create" ? "Add user" : "Edit user"}
                    subtitle={mode === "create" ? "Create an account and choose its role." : `Update ${target?.fullName || "this user"}'s account.`}
                    onClose={closeModal}
                    busy={busy}
                >
                    <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: 0 }}>
                        <div className="auth-field">
                            <label className="auth-label" htmlFor="u-name">Full name</label>
                            <input id="u-name" autoFocus className="auth-input" value={form.fullName} onChange={setField("fullName")} required maxLength={100} />
                        </div>
                        <div className="auth-field">
                            <label className="auth-label" htmlFor="u-email">Email</label>
                            <input id="u-email" className="auth-input" type="email" value={form.email} onChange={setField("email")} required />
                        </div>
                        <div className="auth-field">
                            <label className="auth-label" htmlFor="u-phone">Phone (optional)</label>
                            <input id="u-phone" className="auth-input" value={form.phone} onChange={setField("phone")} placeholder="+40 7xx xxx xxx" />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div className="auth-field">
                                <label className="auth-label" htmlFor="u-role">Role</label>
                                <select id="u-role" className="auth-input" value={form.role} onChange={setField("role")}>
                                    {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="auth-field">
                                <label className="auth-label" htmlFor="u-status">Status</label>
                                <select
                                    id="u-status"
                                    className="auth-input"
                                    value={form.status}
                                    onChange={setField("status")}
                                    disabled={target?.id === user?.id}
                                    title={target?.id === user?.id ? "You cannot deactivate your own account" : undefined}
                                >
                                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="auth-field">
                            <label className="auth-label" htmlFor="u-dept">Department</label>
                            <select id="u-dept" className="auth-input" value={form.departmentId} onChange={setField("departmentId")}>
                                {isAdmin && <option value="">No department</option>}
                                {departmentOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        {mode === "create" && (
                            <div className="auth-field">
                                <label className="auth-label" htmlFor="u-pw">Initial password</label>
                                <input id="u-pw" className="auth-input" type="password" autoComplete="new-password" value={form.password} onChange={setField("password")} required />
                                <div className="muted-note" style={{ marginTop: 4 }}>8+ characters with a number and a symbol. Share it with the user securely.</div>
                            </div>
                        )}

                        {formError && <div className="inline-error" role="alert" style={{ marginTop: 12 }}>{formError}</div>}

                        <ModalActions>
                            <button type="button" onClick={closeModal} className="btn-secondary" disabled={busy}>Cancel</button>
                            <button type="submit" className="btn-primary" disabled={busy}>
                                {busy ? "Saving…" : mode === "create" ? "Create user" : "Save"}
                            </button>
                        </ModalActions>
                    </form>
                </Modal>
            )}

            {mode === "delete" && target && (
                <Modal title="Delete user?" onClose={closeModal} busy={busy} maxWidth={420}>
                    <p style={{ color: "var(--muted)", fontSize: 14 }}>
                        <strong style={{ color: "var(--text)" }}>{target.fullName}</strong> ({target.email}) will lose access
                        immediately. Their past activity stays in the audit log. This cannot be undone.
                    </p>
                    {formError && <div className="inline-error" role="alert">{formError}</div>}
                    <ModalActions>
                        <button type="button" onClick={closeModal} className="btn-secondary" disabled={busy}>Keep user</button>
                        <button type="button" onClick={confirmDelete} className="btn-danger" disabled={busy}>
                            {busy ? "Deleting…" : "Delete"}
                        </button>
                    </ModalActions>
                </Modal>
            )}
        </section>
    );
}
