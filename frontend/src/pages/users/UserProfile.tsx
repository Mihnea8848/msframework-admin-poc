import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Copy, KeyRound, Mail, Pencil, Phone, Power, TriangleAlert } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { hasPermission, primaryRole } from "../../auth/permissions";
import { ApiError, get, post } from "../../api/client";
import type { DepartmentResponse } from "../../api/types";
import type { BulkUserResult, PasswordResetLinkDto, UserDetailsDto } from "../../api/people";
import { prefetchPage } from "../../app/pages";
import { formatDateTime, timeAgo } from "../../utils/format";
import { groupPermissions } from "../../utils/permissionGroups";
import ActivityTimeline from "../../ui/ActivityTimeline";
import Alert from "../../ui/Alert";
import Avatar from "../../ui/Avatar";
import BackLink from "../../ui/BackLink";
import Button from "../../ui/Button";
import Dialog, { DialogBody, DialogFooter } from "../../ui/Dialog";
import StatusPill from "../../ui/StatusPill";
import { useReveal } from "../../ui/useReveal";
import { SealMini } from "../../ui/seal/Seal";
import { sealForColor } from "../../ui/seal/seals";
import UserFormDialog from "./UserFormDialog";
import "../../ui/field.css";
import "../../ui/list.css";
import "../../ui/surface.css";
import "./user-profile.css";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** A date as "2 days ago", with the exact time in a tooltip; `empty` when there is none. */
function When({ value, empty }: { value: string | null | undefined; empty: string }) {
    if (!value) return <span className="ms-profile__muted">{empty}</span>;
    return <time dateTime={value} title={formatDateTime(value)}>{timeAgo(value)}</time>;
}

type Load = { key: string; user: UserDetailsDto | null; error: string | null; notFound: boolean };
type Dialogs = "edit" | "deactivate" | "reset" | null;

export default function UserProfile() {
    const { id: idParam } = useParams();
    const id = idParam && /^\d+$/.test(idParam) ? Number(idParam) : null;
    const { user: me } = useAuth();
    const canReadAudit = hasPermission(me, "AUDIT_READ");

    const [reloadToken, setReloadToken] = useState(0);
    const requestKey = `${id}#${reloadToken}`;
    const [load, setLoad] = useState<Load | null>(null);
    const reload = useCallback(() => setReloadToken((t) => t + 1), []);

    useEffect(() => {
        if (id === null) return undefined;
        const controller = new AbortController();
        get<UserDetailsDto>(`/api/users/${id}`, { signal: controller.signal })
            .then((data) => setLoad({ key: requestKey, user: data, error: null, notFound: false }))
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                const notFound = err instanceof ApiError && err.status === 404;
                setLoad((prev) => ({ key: requestKey, user: notFound ? null : prev?.user ?? null, error: messageOf(err), notFound }));
            });
        return () => controller.abort();
    }, [id, requestKey]);

    const person = load?.user && load.user.id === id ? load.user : null;
    const loading = id !== null && load?.key !== requestKey && !person;
    const reveal = useReveal(person !== null);

    const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
    const [dialog, setDialog] = useState<Dialogs>(null);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [resetLink, setResetLink] = useState<PasswordResetLinkDto | null>(null);
    const [copied, setCopied] = useState(false);

    const groups = useMemo(() => groupPermissions(person?.permissions ?? []), [person]);

    if (id === null || load?.notFound) {
        return (
            <section className="ms-profile">
                <BackLink to="/users" label="Users" />
                <div className="ms-empty">
                    <p className="ms-empty__title">This user does not exist.</p>
                    <p>They may have been deleted. <Link className="ms-link" to="/users">Back to users</Link></p>
                </div>
            </section>
        );
    }

    if (!person) {
        return (
            <section className="ms-profile">
                <BackLink to="/users" label="Users" />
                {load?.error && !loading ? (
                    <Alert tone="danger" role="alert" className="ms-notice">
                        <span>Could not load this user: {load.error}</span>
                        <Button size="sm" onClick={reload}>Retry</Button>
                    </Alert>
                ) : (
                    <div className="ms-empty"><p>Loading profile…</p></div>
                )}
            </section>
        );
    }

    const isSelf = person.id === me?.id;
    const role = primaryRole(person);
    const active = (person.status ?? "Active") === "Active";
    const seal = person.departmentId != null ? sealForColor(person.departmentColor).key : null;
    const name = person.fullName || person.email;
    const canEdit = person.canEdit;

    function openEdit() {
        setActionError(null);
        setDialog("edit");
        get<DepartmentResponse[]>("/api/departments")
            .then((data) => setDepartments(Array.isArray(data) ? data : []))
            .catch(() => setDepartments([]));
    }

    function closeDialog() {
        if (busy) return;
        setDialog(null);
        // The new link is in the activity feed now.
        if (resetLink) reload();
        setResetLink(null);
        setCopied(false);
        setActionError(null);
    }

    async function setStatus(next: "ACTIVATE" | "DEACTIVATE") {
        if (!person) return;
        setBusy(true);
        setActionError(null);
        try {
            const res = await post<BulkUserResult>("/api/users/bulk", { action: next, ids: [person.id] });
            const item = res.results.find((r) => r.id === person.id);
            if (item && !item.ok) {
                setActionError(item.error || "The change was not made.");
                return;
            }
            setDialog(null);
            setNotice(next === "ACTIVATE" ? `${name} is active again and can sign in.` : `${name} is deactivated and signed out everywhere.`);
            reload();
        } catch (err) {
            setActionError(messageOf(err));
        } finally {
            setBusy(false);
        }
    }

    async function createResetLink() {
        if (!person) return;
        setBusy(true);
        setActionError(null);
        try {
            setResetLink(await post<PasswordResetLinkDto>(`/api/users/${person.id}/password-reset`));
            setCopied(false);
        } catch (err) {
            setActionError(messageOf(err));
        } finally {
            setBusy(false);
        }
    }

    async function copyLink() {
        if (!resetLink) return;
        try {
            await navigator.clipboard.writeText(resetLink.link);
            setCopied(true);
        } catch {
            const field = document.getElementById("reset-link");
            if (field instanceof HTMLInputElement) field.select();
            setActionError("Copying is blocked in this browser. The link is selected: copy it with Ctrl+C.");
        }
    }

    const prefetchDepartment = () => prefetchPage("departmentDetail");
    const prefetchProfile = () => prefetchPage("userProfile");

    return (
        <section className="ms-profile">
            <BackLink to="/users" label="Users" />

            {notice && (
                <Alert tone="ok" role="status" className="ms-notice">
                    <span>{notice}</span>
                    <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>
                </Alert>
            )}
            {actionError && !dialog && (
                <Alert tone="danger" role="alert" className="ms-notice">
                    <span>{actionError}</span>
                    <Button size="sm" variant="ghost" onClick={() => setActionError(null)}>Dismiss</Button>
                </Alert>
            )}

            <header className="ms-cut ms-profile__hero">
                <Avatar name={person.fullName} size="lg" className="ms-profile__avatar" />
                <div className="ms-profile__id">
                    <p className="ms-profile__eyebrow">User profile</p>
                    <h1 className="ms-profile__name">
                        {name}
                        {isSelf && <span className="ms-profile__you"> (you)</span>}
                    </h1>
                    <p className="ms-profile__title">{person.title || <span className="ms-profile__muted">No job title</span>}</p>
                    <div className="ms-profile__tags">
                        <span className={`ms-role${role === "ADMIN" ? " ms-role--admin" : ""}`}>{role}</span>
                        <StatusPill status={person.status} />
                        {person.departmentId != null ? (
                            <Link
                                className="ms-profile__dept"
                                to={`/departments/${person.departmentId}`}
                                onMouseEnter={prefetchDepartment}
                                onFocus={prefetchDepartment}
                            >
                                <SealMini seal={seal} />
                                <span>{person.departmentName}</span>
                            </Link>
                        ) : (
                            <span className="ms-profile__dept ms-profile__dept--none"><SealMini seal={null} /><span>No department</span></span>
                        )}
                    </div>
                </div>
                {canEdit && (
                    <div className="ms-profile__actions">
                        <Button size="sm" icon={<Pencil aria-hidden="true" />} onClick={openEdit}>Edit</Button>
                        {!isSelf && (active ? (
                            <Button size="sm" icon={<Power aria-hidden="true" />} onClick={() => { setActionError(null); setDialog("deactivate"); }}>
                                Deactivate
                            </Button>
                        ) : (
                            <Button size="sm" icon={<Power aria-hidden="true" />} disabled={busy} onClick={() => setStatus("ACTIVATE")}>
                                Activate
                            </Button>
                        ))}
                        {active && (
                            <Button size="sm" icon={<KeyRound aria-hidden="true" />} onClick={() => { setActionError(null); setResetLink(null); setDialog("reset"); }}>
                                Create reset link
                            </Button>
                        )}
                    </div>
                )}
            </header>

            <div className="ms-profile__grid">
                <section {...reveal(0, "ms-panel ms-profile__panel")} aria-labelledby="profile-contact">
                    <div className="ms-panel__head"><h2 className="ms-panel__title" id="profile-contact">Contact</h2></div>
                    <dl className="ms-profile__facts">
                        <div>
                            <dt>Email</dt>
                            <dd><a className="ms-link ms-profile__contact" href={`mailto:${person.email}`}><Mail aria-hidden="true" />{person.email}</a></dd>
                        </div>
                        <div>
                            <dt>Phone</dt>
                            <dd>
                                {person.phone
                                    ? <a className="ms-link ms-profile__contact" href={`tel:${person.phone.replace(/\s+/g, "")}`}><Phone aria-hidden="true" />{person.phone}</a>
                                    : <span className="ms-profile__muted">Not given</span>}
                            </dd>
                        </div>
                    </dl>
                </section>

                <section {...reveal(1, "ms-panel ms-profile__panel")} aria-labelledby="profile-dept">
                    <div className="ms-panel__head"><h2 className="ms-panel__title" id="profile-dept">Department and manager</h2></div>
                    <dl className="ms-profile__facts">
                        <div>
                            <dt>Department</dt>
                            <dd>
                                {person.departmentId != null
                                    ? <Link className="ms-link" to={`/departments/${person.departmentId}`} onMouseEnter={prefetchDepartment}>{person.departmentName}</Link>
                                    : <span className="ms-profile__muted">None</span>}
                            </dd>
                        </div>
                        {person.departmentManagerId !== person.id && (
                            <div>
                                <dt>Manager</dt>
                                <dd>
                                    {person.departmentManagerId != null ? (
                                        <Link className="ms-link" to={`/users/${person.departmentManagerId}`} onMouseEnter={prefetchProfile}>
                                            {person.departmentManagerName}
                                        </Link>
                                    ) : (
                                        <span className="ms-profile__muted">{person.departmentId != null ? "The department has no manager" : "None"}</span>
                                    )}
                                </dd>
                            </div>
                        )}
                        {person.managerOf != null && (
                            <div>
                                <dt>Manages</dt>
                                <dd><Link className="ms-link" to={`/departments/${person.managerOf}`}>{person.managerOfName}</Link></dd>
                            </div>
                        )}
                    </dl>
                </section>

                <section {...reveal(2, "ms-panel ms-profile__panel")} aria-labelledby="profile-account">
                    <div className="ms-panel__head"><h2 className="ms-panel__title" id="profile-account">Account</h2></div>
                    <dl className="ms-profile__facts">
                        <div><dt>Created</dt><dd><When value={person.createdAt} empty="Unknown" /></dd></div>
                        <div><dt>Last sign-in</dt><dd><When value={person.lastLoginAt} empty="Never signed in" /></dd></div>
                        <div><dt>Password changed</dt><dd><When value={person.passwordChangedAt} empty="Not since the account was created" /></dd></div>
                    </dl>
                </section>

                <section {...reveal(3, "ms-panel ms-profile__panel ms-profile__panel--wide")} aria-labelledby="profile-access">
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id="profile-access">Access</h2>
                        <span className="ms-panel__meta">{role} · {person.permissions.length} permissions</span>
                    </div>
                    {groups.length === 0 ? (
                        <p className="ms-profile__empty">This role has no permissions.</p>
                    ) : (
                        <div className="ms-profile__perms">
                            {groups.map((g) => (
                                <div key={g.area} className="ms-profile__perm-group">
                                    <h3 className="ms-profile__perm-area">{g.area}</h3>
                                    <ul className="ms-profile__perm-list">
                                        {g.items.map((item) => (
                                            <li key={item.key}><Check aria-hidden="true" />{item.label}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {canReadAudit && (
                    <section {...reveal(4, "ms-panel ms-profile__panel ms-profile__panel--wide")} aria-labelledby="profile-activity">
                        <div className="ms-panel__head">
                            <h2 className="ms-panel__title" id="profile-activity">Activity</h2>
                            <span className="ms-panel__meta">About {isSelf ? "you" : "this user"}, newest first</span>
                        </div>
                        <ActivityTimeline key={`${person.id}#${reloadToken}`} path={`/api/users/${person.id}/activity`} emptyText="No activity about this user yet." />
                    </section>
                )}
            </div>

            {dialog === "edit" && (
                <UserFormDialog
                    mode="edit"
                    target={person}
                    departments={departments}
                    onClose={() => setDialog(null)}
                    onSaved={(message) => {
                        setDialog(null);
                        setNotice(message);
                        reload();
                    }}
                />
            )}

            {dialog === "deactivate" && (
                <Dialog eyebrow="Deactivate user" title={`Deactivate ${name}?`} tone="danger" size="sm" onClose={closeDialog} busy={busy}>
                    <DialogBody>
                        <div className="ms-confirm">
                            <span className="ms-confirm__icon" aria-hidden="true"><TriangleAlert /></span>
                            <p>They are signed out everywhere and cannot sign in until they are activated again. Their history is kept.</p>
                        </div>
                        {actionError && <Alert tone="danger" role="alert">{actionError}</Alert>}
                    </DialogBody>
                    <DialogFooter>
                        <Button onClick={closeDialog} disabled={busy}>Cancel</Button>
                        <Button variant="danger" onClick={() => setStatus("DEACTIVATE")} disabled={busy}>{busy ? "Deactivating…" : "Deactivate"}</Button>
                    </DialogFooter>
                </Dialog>
            )}

            {dialog === "reset" && (
                <Dialog
                    eyebrow="Password"
                    title={resetLink ? "Reset link ready" : "Create a reset link?"}
                    description={resetLink ? undefined : `A single-use link that lets ${name} choose a new password.`}
                    size="sm"
                    onClose={closeDialog}
                    busy={busy}
                >
                    <DialogBody>
                        {resetLink ? (
                            <>
                                <Alert tone="warn">
                                    Share it with {name} privately, for example in a direct message. Anyone with the link can set
                                    their password. It is shown only once.
                                </Alert>
                                <div className="ms-field">
                                    <label className="ms-field__label" htmlFor="reset-link">Reset link</label>
                                    <div className="ms-profile__copy">
                                        <input id="reset-link" className="ms-input" readOnly value={resetLink.link} onFocus={(e) => e.currentTarget.select()} />
                                        <Button data-autofocus icon={copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} onClick={copyLink}>
                                            {copied ? "Copied" : "Copy"}
                                        </Button>
                                    </div>
                                    <p className="ms-field__hint">
                                        Expires <time dateTime={resetLink.expiresAt}>{formatDateTime(resetLink.expiresAt)}</time>. It stops working once used.
                                    </p>
                                </div>
                                <p className="ms-visually-hidden" role="status">{copied ? "Link copied" : ""}</p>
                            </>
                        ) : (
                            <p className="ms-profile__lead">
                                Their current password keeps working until they use the link. Any earlier reset link for them
                                stops working. The link is valid for 30 minutes.
                            </p>
                        )}
                        {actionError && <Alert tone="danger" role="alert">{actionError}</Alert>}
                    </DialogBody>
                    <DialogFooter>
                        {resetLink ? (
                            <Button variant="primary" onClick={closeDialog}>Done</Button>
                        ) : (
                            <>
                                <Button onClick={closeDialog} disabled={busy}>Cancel</Button>
                                <Button variant="primary" onClick={createResetLink} disabled={busy}>{busy ? "Creating…" : "Create link"}</Button>
                            </>
                        )}
                    </DialogFooter>
                </Dialog>
            )}
        </section>
    );
}
