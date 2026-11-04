import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { hasRole, primaryRole, ROLES, STATUSES } from "../../auth/permissions";
import { post, put } from "../../api/client";
import type { DepartmentResponse, UserDto, UserStatus } from "../../api/types";
import { passwordProblem, validateEmail } from "../../utils/validators";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import Dialog, { DialogBody, DialogFooter } from "../../ui/Dialog";
import "../../ui/field.css";

/** The fields of a user the dialog edits (a UserDto or a UserDetailsDto). */
export interface EditableUser {
    id: number;
    fullName: string | null;
    email: string;
    phone: string | null;
    title?: string | null;
    roles: string[];
    status: UserStatus | null;
    departmentId: number | null;
}

interface UserForm {
    fullName: string;
    email: string;
    phone: string;
    title: string;
    role: string;
    status: UserStatus;
    departmentId: string;
    password: string;
}

const EMPTY_FORM: UserForm = {
    fullName: "",
    email: "",
    phone: "",
    title: "",
    role: "MEMBER",
    status: "Active",
    departmentId: "",
    password: "",
};

function formFor(member: EditableUser): UserForm {
    const role = primaryRole(member);
    return {
        fullName: member.fullName || "",
        email: member.email || "",
        phone: member.phone || "",
        title: member.title || "",
        role: role === "—" ? "MEMBER" : role,
        status: member.status || "Active",
        departmentId: member.departmentId != null ? String(member.departmentId) : "",
        password: "",
    };
}

type UserFormDialogProps = {
    mode: "create" | "edit";
    /** The user being edited (edit mode). */
    target?: EditableUser | null;
    departments: readonly DepartmentResponse[];
    onClose: () => void;
    /** Called after a successful save, with a notice for the page. */
    onSaved: (notice: string, saved: UserDto | null) => void;
};

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Add or edit a user: name, email, phone, job title, role, status, department and (when adding)
 * the initial password. Managers only get the MEMBER and VIEWER roles and their own department;
 * the backend enforces the same.
 */
export default function UserFormDialog({ mode, target = null, departments, onClose, onSaved }: UserFormDialogProps) {
    const { user, refresh } = useAuth();
    const isAdmin = hasRole(user, "ADMIN");
    const [form, setForm] = useState<UserForm>(() => (mode === "edit" && target ? formFor(target) : EMPTY_FORM));
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const roleOptions = isAdmin ? ROLES : ROLES.filter((r) => r !== "ADMIN" && r !== "MANAGER");
    const departmentOptions = isAdmin ? departments : departments.filter((d) => d.id === user?.departmentId);
    const editingSelf = mode === "edit" && target?.id === user?.id;

    const setField = (field: keyof UserForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [field]: e.target.value }));

    function close() {
        if (!busy) onClose();
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        if (!form.fullName.trim()) return setError("Full name is required.");
        if (!validateEmail(form.email).ok) return setError("Enter a valid email address.");
        if (mode === "create") {
            const problem = passwordProblem(form.password);
            if (problem) return setError(`Password: ${problem.toLowerCase()}.`);
        }

        const payload = {
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            title: form.title.trim(),
            role: form.role,
            status: form.status,
            departmentId: form.departmentId === "" ? null : Number(form.departmentId),
        };

        setBusy(true);
        try {
            if (mode === "create") {
                const created = await post<UserDto>("/api/users", { ...payload, password: form.password });
                onSaved(`Created ${created.fullName}. They can sign in with the password you set.`, created);
            } else if (target) {
                const saved = await put<UserDto>(`/api/users/${target.id}`, payload);
                if (target.id === user?.id) await refresh();
                onSaved(`Saved changes to ${payload.fullName}.`, saved);
            }
        } catch (err) {
            setError(messageOf(err));
            setBusy(false);
        }
    }

    return (
        <Dialog
            eyebrow="Users"
            title={mode === "create" ? "Add user" : "Edit user"}
            description={mode === "create" ? "Create an account and choose its role." : `Update ${target?.fullName || "this user"}'s account.`}
            onClose={close}
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
                    <div className="ms-dialog__grid">
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="u-title">Job title (optional)</label>
                            <input id="u-title" className="ms-input" value={form.title} onChange={setField("title")} maxLength={100} placeholder="Senior Producer" />
                        </div>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="u-phone">Phone (optional)</label>
                            <input id="u-phone" className="ms-input" value={form.phone} onChange={setField("phone")} placeholder="+40 7xx xxx xxx" />
                        </div>
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

                    {error && <Alert tone="danger" role="alert">{error}</Alert>}
                </DialogBody>
                <DialogFooter>
                    <Button onClick={close} disabled={busy}>Cancel</Button>
                    <Button type="submit" variant="primary" disabled={busy}>
                        {busy ? "Saving…" : mode === "create" ? "Create user" : "Save"}
                    </Button>
                </DialogFooter>
            </form>
        </Dialog>
    );
}
