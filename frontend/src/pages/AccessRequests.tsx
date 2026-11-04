import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Mail, Phone, X } from "lucide-react";
import { ROLES } from "../auth/permissions";
import { get, post } from "../api/client";
import type { DepartmentResponse } from "../api/types";
import type { AccessRequestDto, AccessRequestStatus } from "../api/people";
import { notifyAccessRequestsChanged } from "../shell/usePendingAccessRequests";
import { formatDateTime, timeAgo } from "../utils/format";
import Alert from "../ui/Alert";
import Avatar from "../ui/Avatar";
import Button from "../ui/Button";
import Dialog, { DialogBody, DialogFooter } from "../ui/Dialog";
import PageHeader from "../ui/PageHeader";
import { useReveal } from "../ui/useReveal";
import { SealMini } from "../ui/seal/Seal";
import { sealForColor } from "../ui/seal/seals";
import "../ui/field.css";
import "../ui/list.css";
import "../ui/surface.css";
import "./access-requests.css";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));
const NOTE_MAX = 500;

const TABS: readonly { status: AccessRequestStatus; label: string; empty: string }[] = [
    { status: "PENDING", label: "Pending", empty: "No one is waiting for access." },
    { status: "APPROVED", label: "Approved", empty: "No requests have been approved yet." },
    { status: "REJECTED", label: "Rejected", empty: "No requests have been rejected." },
];

function statusFrom(value: string | null): AccessRequestStatus {
    const upper = (value ?? "").toUpperCase();
    return TABS.some((t) => t.status === upper) ? (upper as AccessRequestStatus) : "PENDING";
}

function When({ value }: { value: string | null }) {
    if (!value) return null;
    return <time dateTime={value} title={formatDateTime(value)}>{timeAgo(value)}</time>;
}

type Decision = { kind: "approve" | "reject"; request: AccessRequestDto } | null;

export default function AccessRequests() {
    const [searchParams, setSearchParams] = useSearchParams();
    const status = statusFrom(searchParams.get("status"));
    const tab = TABS.find((t) => t.status === status) ?? TABS[0]!;

    const [reloadToken, setReloadToken] = useState(0);
    const requestKey = `${status}#${reloadToken}`;
    const [result, setResult] = useState<{ key: string; items: AccessRequestDto[] | null; error: string | null } | null>(null);
    const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
    const [notice, setNotice] = useState<string | null>(null);
    const reload = useCallback(() => setReloadToken((t) => t + 1), []);

    useEffect(() => {
        const controller = new AbortController();
        get<AccessRequestDto[]>(`/api/access-requests?status=${status}`, { signal: controller.signal })
            .then((data) => setResult({ key: requestKey, items: Array.isArray(data) ? data : [], error: null }))
            .catch((err: unknown) => {
                if (!controller.signal.aborted) setResult({ key: requestKey, items: null, error: messageOf(err) });
            });
        return () => controller.abort();
    }, [status, requestKey]);

    useEffect(() => {
        get<DepartmentResponse[]>("/api/departments")
            .then((data) => setDepartments(Array.isArray(data) ? data : []))
            .catch(() => setDepartments([]));
    }, []);

    const current = result?.key === requestKey ? result : null;
    const items = current?.items ?? null;
    const reveal = useReveal(items !== null);
    const colorById = new Map(departments.map((d) => [d.id, d.color]));

    // ---- Tabs (arrow keys move between them, like the Settings tabs) ----------------------
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
    function selectTab(next: AccessRequestStatus, focus = false) {
        setNotice(null);
        setSearchParams(next === "PENDING" ? {} : { status: next.toLowerCase() }, { replace: true });
        if (focus) tabRefs.current[TABS.findIndex((t) => t.status === next)]?.focus();
    }
    function onTabKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
        const last = TABS.length - 1;
        const target = e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
            : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
                : e.key === "Home" ? 0 : e.key === "End" ? last : null;
        if (target === null) return;
        e.preventDefault();
        const next = TABS[target];
        if (next) selectTab(next.status, true);
    }

    // ---- Decisions ------------------------------------------------------------------------
    const [decision, setDecision] = useState<Decision>(null);
    const [role, setRole] = useState("MEMBER");
    const [departmentId, setDepartmentId] = useState("");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function openApprove(request: AccessRequestDto) {
        setRole("MEMBER");
        setDepartmentId(request.departmentId != null ? String(request.departmentId) : "");
        setError(null);
        setDecision({ kind: "approve", request });
    }

    function openReject(request: AccessRequestDto) {
        setNote("");
        setError(null);
        setDecision({ kind: "reject", request });
    }

    function close() {
        if (!busy) setDecision(null);
    }

    async function decide() {
        if (!decision) return;
        const { kind, request } = decision;
        setBusy(true);
        setError(null);
        try {
            if (kind === "approve") {
                await post<AccessRequestDto>(`/api/access-requests/${request.id}/approve`, {
                    role,
                    departmentId: departmentId === "" ? null : Number(departmentId),
                });
                setNotice(`Approved ${request.fullName}. They can sign in now with the password they chose.`);
            } else {
                await post<AccessRequestDto>(`/api/access-requests/${request.id}/reject`, { note: note.trim() || null });
                setNotice(`Rejected the request from ${request.fullName}.`);
            }
            setDecision(null);
            reload();
            notifyAccessRequestsChanged();
        } catch (err) {
            setError(messageOf(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="ms-access">
            <PageHeader
                eyebrow="People"
                title="Access requests"
                count={status === "PENDING" && items ? items.length : null}
                description="People who asked for an account on the sign-in page. Approve them with a role and a department, or reject them."
            />

            {notice && (
                <Alert tone="ok" role="status" className="ms-notice">
                    <span>{notice}</span>
                    <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>
                </Alert>
            )}

            <div className="ms-access__tabs" role="tablist" aria-label="Request status">
                {TABS.map((t, i) => (
                    <button
                        key={t.status}
                        ref={(el) => { tabRefs.current[i] = el; }}
                        type="button"
                        role="tab"
                        id={`access-tab-${t.status}`}
                        aria-selected={t.status === status}
                        aria-controls="access-panel"
                        tabIndex={t.status === status ? 0 : -1}
                        className="ms-access__tab"
                        onClick={() => selectTab(t.status)}
                        onKeyDown={(e) => onTabKey(e, i)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div id="access-panel" role="tabpanel" aria-labelledby={`access-tab-${status}`} className="ms-access__panel">
                {current?.error ? (
                    <Alert tone="danger" role="alert" className="ms-notice">
                        <span>Could not load the requests: {current.error}</span>
                        <Button size="sm" onClick={reload}>Retry</Button>
                    </Alert>
                ) : !items ? (
                    <div className="ms-empty"><p>Loading requests…</p></div>
                ) : items.length === 0 ? (
                    <div className="ms-empty">
                        <p className="ms-empty__title">{tab.empty}</p>
                        {status === "PENDING" && <p>New requests appear here when someone uses <b>Request access</b> on the sign-in page.</p>}
                    </div>
                ) : (
                    <ul className="ms-access__list">
                        {items.map((r, i) => {
                            const seal = r.departmentId != null && colorById.has(r.departmentId) ? sealForColor(colorById.get(r.departmentId)).key : null;
                            return (
                                <li key={r.id} {...reveal(i, "ms-cut ms-access__item")}>
                                    <Avatar name={r.fullName} className="ms-access__avatar" />
                                    <div className="ms-access__who">
                                        <p className="ms-access__name">{r.fullName}</p>
                                        <p className="ms-access__contact">
                                            <a className="ms-link" href={`mailto:${r.email}`}><Mail aria-hidden="true" />{r.email}</a>
                                            {r.phone && <span><Phone aria-hidden="true" />{r.phone}</span>}
                                        </p>
                                    </div>
                                    <div className="ms-access__dept">
                                        <span className="ms-access__label">Asked to join</span>
                                        <span className="ms-access__dept-name">
                                            <SealMini seal={r.departmentName ? seal : null} />
                                            {r.departmentName || "No department"}
                                        </span>
                                    </div>
                                    <div className="ms-access__when">
                                        {r.status === "PENDING" ? (
                                            <>
                                                <span className="ms-access__label">Requested</span>
                                                <When value={r.createdAt} />
                                            </>
                                        ) : (
                                            <>
                                                <span className="ms-access__label">{r.status === "APPROVED" ? "Approved" : "Rejected"}</span>
                                                <span><When value={r.decidedAt} />{r.decidedBy && <> by {r.decidedBy}</>}</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="ms-access__actions">
                                        {r.status === "PENDING" && (
                                            <>
                                                <Button size="sm" variant="primary" icon={<Check aria-hidden="true" />} onClick={() => openApprove(r)}>
                                                    Approve<span className="ms-visually-hidden"> {r.fullName}</span>
                                                </Button>
                                                <Button size="sm" variant="ghost-danger" icon={<X aria-hidden="true" />} onClick={() => openReject(r)}>
                                                    Reject<span className="ms-visually-hidden"> {r.fullName}</span>
                                                </Button>
                                            </>
                                        )}
                                        {r.status === "APPROVED" && r.userId != null && (
                                            <Link className="ms-link" to={`/users/${r.userId}`}>Open profile</Link>
                                        )}
                                    </div>
                                    {r.status === "REJECTED" && r.note && (
                                        <p className="ms-access__note"><span className="ms-access__label">Note</span> {r.note}</p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {decision?.kind === "approve" && (
                <Dialog
                    eyebrow="Access request"
                    title={`Approve ${decision.request.fullName}?`}
                    description={`An account is created for ${decision.request.email} with the password they chose.`}
                    size="sm"
                    onClose={close}
                    busy={busy}
                >
                    <form onSubmit={(e) => { e.preventDefault(); void decide(); }}>
                        <DialogBody>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="approve-role">Role</label>
                                <div className="ms-select">
                                    <select id="approve-role" data-autofocus className="ms-input" value={role} onChange={(e) => setRole(e.target.value)}>
                                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="approve-dept">Department</label>
                                <div className="ms-select">
                                    <select id="approve-dept" className="ms-input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                                        <option value="">No department</option>
                                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                                {decision.request.departmentName && (
                                    <p className="ms-field__hint">They asked for {decision.request.departmentName}.</p>
                                )}
                            </div>
                            {error && <Alert tone="danger" role="alert">{error}</Alert>}
                        </DialogBody>
                        <DialogFooter>
                            <Button onClick={close} disabled={busy}>Cancel</Button>
                            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Approving…" : "Approve"}</Button>
                        </DialogFooter>
                    </form>
                </Dialog>
            )}

            {decision?.kind === "reject" && (
                <Dialog
                    eyebrow="Access request"
                    title={`Reject ${decision.request.fullName}?`}
                    description="No account is created."
                    size="sm"
                    tone="danger"
                    onClose={close}
                    busy={busy}
                >
                    <form onSubmit={(e) => { e.preventDefault(); void decide(); }}>
                        <DialogBody>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="reject-note">Note (optional)</label>
                                <textarea
                                    id="reject-note"
                                    data-autofocus
                                    className="ms-input ms-access__textarea"
                                    rows={3}
                                    maxLength={NOTE_MAX}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    aria-describedby="reject-note-hint"
                                />
                                <p className="ms-field__hint" id="reject-note-hint">
                                    Saved with the request and in the audit log; the person does not see it. {NOTE_MAX - note.length} characters left.
                                </p>
                            </div>
                            {error && <Alert tone="danger" role="alert">{error}</Alert>}
                        </DialogBody>
                        <DialogFooter>
                            <Button onClick={close} disabled={busy}>Cancel</Button>
                            <Button type="submit" variant="danger" disabled={busy}>{busy ? "Rejecting…" : "Reject"}</Button>
                        </DialogFooter>
                    </form>
                </Dialog>
            )}
        </section>
    );
}
