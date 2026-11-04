import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CircleHelp, LogOut, Monitor, RefreshCw, Search, Smartphone, Tablet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import { get } from "../api/client";
import {
    fetchMySessions, fetchUserSessions, revokeMyOtherSessions, revokeMySession, revokeUserSessions,
} from "../api/security";
import type { SessionDto } from "../api/security";
import type { UserDto } from "../api/types";
import { formatDateTime, relTime } from "../utils/format";
import { parseUserAgent } from "../utils/userAgent";
import type { DeviceKind } from "../utils/userAgent";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Dialog, { DialogBody, DialogFooter } from "../ui/Dialog";
import PageHeader from "../ui/PageHeader";
import { useReveal } from "../ui/useReveal";
import "../ui/field.css";
import "../ui/list.css";
import "../ui/surface.css";
import "./sessions.css";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

const DEVICE_ICONS: Record<DeviceKind, LucideIcon> = {
    desktop: Monitor,
    mobile: Smartphone,
    tablet: Tablet,
    unknown: CircleHelp,
};

type Confirm =
    | { kind: "current"; session: SessionDto }
    | { kind: "others"; count: number }
    | { kind: "user"; user: UserDto; count: number };

/** One session: the device and browser, the "This device" badge, where and when, and an action. */
function SessionRow({ session, index, reveal, action }: {
    session: SessionDto;
    index: number;
    reveal: ReturnType<typeof useReveal>;
    action?: ReactNode;
}) {
    const ua = parseUserAgent(session.userAgent);
    const Icon = DEVICE_ICONS[ua.device];
    return (
        <li {...reveal(index, `ms-session${session.current ? " ms-session--current" : ""}`)}>
            <span className="ms-session__icon" aria-hidden="true"><Icon /></span>
            <div className="ms-session__body">
                <p className="ms-session__top">
                    <span className="ms-session__device" title={session.userAgent ?? undefined}>{ua.label}</span>
                    {session.current && <span className="ms-tag ms-session__this">This device</span>}
                </p>
                <dl className="ms-session__facts">
                    <div><dt>IP</dt><dd>{session.ipAddress || "Unknown"}</dd></div>
                    <div><dt>Signed in</dt><dd><time dateTime={session.createdAt}>{formatDateTime(session.createdAt)}</time></dd></div>
                    <div>
                        <dt>Last active</dt>
                        <dd><time dateTime={session.lastActiveAt} title={formatDateTime(session.lastActiveAt)}>{relTime(session.lastActiveAt)}</time></dd>
                    </div>
                    <div><dt>Expires</dt><dd><time dateTime={session.expiresAt}>{formatDateTime(session.expiresAt)}</time></dd></div>
                </dl>
            </div>
            {action && <div className="ms-session__action">{action}</div>}
        </li>
    );
}

function SessionList({ sessions, onSignOut, busyId }: {
    sessions: SessionDto[];
    onSignOut?: (session: SessionDto) => void;
    busyId?: string | null;
}) {
    const reveal = useReveal(true);
    return (
        <ul className="ms-session-list">
            {sessions.map((s, i) => (
                <SessionRow
                    key={s.id}
                    session={s}
                    index={i}
                    reveal={reveal}
                    action={onSignOut && (
                        <Button size="sm" variant="ghost-danger" icon={<LogOut aria-hidden="true" />}
                            disabled={busyId === s.id} onClick={() => onSignOut(s)}
                            aria-label={`Sign out ${parseUserAgent(s.userAgent).label}${s.current ? " (this device)" : ""}`}>
                            Sign out
                        </Button>
                    )}
                />
            ))}
        </ul>
    );
}

/** Sessions by user (SESSIONS_MANAGE): find a user, see their sessions, sign them out everywhere. */
function UserSessions({ onConfirm, refreshKey }: { onConfirm: (c: Confirm) => void; refreshKey: number }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<UserDto[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [selected, setSelected] = useState<UserDto | null>(null);
    const [sessions, setSessions] = useState<SessionDto[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const q = query.trim();

    useEffect(() => {
        if (!q) return undefined;
        let alive = true;
        const timer = window.setTimeout(() => {
            setSearching(true);
            get<{ items: UserDto[] }>(`/api/users/search?q=${encodeURIComponent(q)}&size=8&sort=name`)
                .then((page) => { if (alive) { setResults(page?.items ?? []); setSearchError(null); } })
                .catch((err: unknown) => { if (alive) setSearchError(messageOf(err)); })
                .finally(() => { if (alive) setSearching(false); });
        }, 250);
        return () => {
            alive = false;
            window.clearTimeout(timer);
        };
    }, [q]);

    const selectedId = selected?.id ?? null;
    useEffect(() => {
        if (selectedId === null) return undefined;
        let alive = true;
        fetchUserSessions(selectedId)
            .then((list) => { if (alive) { setSessions(Array.isArray(list) ? list : []); setError(null); } })
            .catch((err: unknown) => { if (alive) setError(messageOf(err)); });
        return () => { alive = false; };
    }, [selectedId, refreshKey]);

    function pick(user: UserDto) {
        setSelected(user);
        setSessions(null);
        setQuery("");
        setResults([]);
    }

    return (
        <section className="ms-panel ms-sessions__panel" aria-labelledby="sessions-by-user">
            <div className="ms-panel__head">
                <h2 className="ms-panel__title" id="sessions-by-user">Sessions by user</h2>
                <span className="ms-panel__meta">Administrators</span>
            </div>
            <div className="ms-sessions__body">
                <div className="ms-sessions__picker">
                    <div className="ms-search">
                        <label className="ms-visually-hidden" htmlFor="session-user-search">Find a user</label>
                        <Search aria-hidden="true" />
                        <input
                            id="session-user-search"
                            className="ms-input"
                            type="search"
                            autoComplete="off"
                            placeholder="Find a user by name or email"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    {q && (
                        <div className="ms-sessions__results" aria-live="polite">
                            {searchError ? (
                                <Alert tone="danger">{searchError}</Alert>
                            ) : searching && results.length === 0 ? (
                                <p className="ms-sessions__hint">Searching…</p>
                            ) : results.length === 0 ? (
                                <p className="ms-sessions__hint">No users match “{q}”.</p>
                            ) : (
                                <ul className="ms-sessions__matches" aria-label="Matching users">
                                    {results.map((u) => (
                                        <li key={u.id}>
                                            <button type="button" className="ms-sessions__match" onClick={() => pick(u)}>
                                                <span className="ms-sessions__match-name">{u.fullName || u.email}</span>
                                                <span className="ms-sessions__match-email">{u.email}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                {!selected ? (
                    <p className="ms-sessions__hint">Pick a user to see where they are signed in.</p>
                ) : (
                    <div className="ms-sessions__selected">
                        <div className="ms-sessions__who">
                            <div className="ms-sessions__who-text">
                                <p className="ms-sessions__who-name">{selected.fullName || selected.email}</p>
                                <p className="ms-sessions__hint">
                                    {selected.email}
                                    {sessions ? ` · ${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}` : ""}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost-danger"
                                icon={<LogOut aria-hidden="true" />}
                                disabled={!sessions || sessions.length === 0}
                                onClick={() => onConfirm({ kind: "user", user: selected, count: sessions?.length ?? 0 })}
                            >
                                Sign out everywhere
                            </Button>
                        </div>
                        {error && <Alert tone="danger" role="alert">{error}</Alert>}
                        {!sessions && !error && <p className="ms-sessions__hint">Loading sessions…</p>}
                        {sessions && sessions.length === 0 && (
                            <p className="ms-sessions__hint">Not signed in anywhere right now.</p>
                        )}
                        {sessions && sessions.length > 0 && <SessionList sessions={sessions} />}
                    </div>
                )}
            </div>
        </section>
    );
}

/**
 * Sessions (/sessions, Security group, every signed-in user): where you are signed in, with
 * "Sign out" per session and "Sign out all other sessions". Signing out this device asks first
 * and then lands on Login. With SESSIONS_MANAGE it also shows "Sessions by user".
 */
export default function Sessions() {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const canManage = hasPermission(user, "SESSIONS_MANAGE");
    const [sessions, setSessions] = useState<SessionDto[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<Confirm | null>(null);
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [userRefresh, setUserRefresh] = useState(0);

    const load = useCallback(async () => {
        try {
            const list = await fetchMySessions();
            setSessions(Array.isArray(list) ? list : []);
            setError(null);
        } catch (err) {
            setError(messageOf(err));
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const others = (sessions ?? []).filter((s) => !s.current);

    function signedOutHere() {
        setUser(null);
        navigate("/login", { replace: true });
    }

    async function signOut(session: SessionDto) {
        if (session.current) {
            setConfirmError(null);
            setConfirm({ kind: "current", session });
            return;
        }
        setBusyId(session.id);
        setNotice(null);
        try {
            await revokeMySession(session.id);
            setNotice(`Signed out ${parseUserAgent(session.userAgent).label}.`);
        } catch (err) {
            setError(messageOf(err));
        } finally {
            setBusyId(null);
            await load();
        }
    }

    async function runConfirm() {
        if (!confirm) return;
        setConfirmBusy(true);
        setConfirmError(null);
        try {
            if (confirm.kind === "current") {
                await revokeMySession(confirm.session.id);
                signedOutHere();
                return;
            }
            if (confirm.kind === "others") {
                await revokeMyOtherSessions();
                setNotice(`Signed out ${confirm.count} other ${confirm.count === 1 ? "session" : "sessions"}.`);
                await load();
            } else {
                await revokeUserSessions(confirm.user.id);
                if (confirm.user.id === user?.id) {
                    signedOutHere();
                    return;
                }
                setNotice(`Signed ${confirm.user.fullName || confirm.user.email} out everywhere.`);
                setUserRefresh((n) => n + 1);
            }
            setConfirm(null);
        } catch (err) {
            setConfirmError(messageOf(err));
        } finally {
            setConfirmBusy(false);
        }
    }

    return (
        <section className="ms-sessions">
            <PageHeader
                eyebrow="Security"
                title="Sessions"
                count={sessions ? sessions.length : undefined}
                description="Where you are signed in. Sign out of any device you do not recognise."
                actions={<Button size="sm" icon={<RefreshCw aria-hidden="true" />} onClick={() => load()}>Refresh</Button>}
            />

            {notice && <Alert tone="ok" role="status" className="ms-notice">{notice}</Alert>}
            {error && <Alert tone="danger" role="alert" className="ms-notice">{error}</Alert>}

            <div className="ms-sessions__grid">
                <section className="ms-panel ms-sessions__panel" aria-labelledby="sessions-mine">
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id="sessions-mine">Your sessions</h2>
                        {sessions && (
                            <span className="ms-panel__meta">
                                {others.length === 0 ? "Only this device" : `This device and ${others.length} other${others.length === 1 ? "" : "s"}`}
                            </span>
                        )}
                    </div>
                    {sessions === null && !error ? (
                        <p className="ms-sessions__hint ms-sessions__body">Loading your sessions…</p>
                    ) : sessions && sessions.length > 0 ? (
                        <SessionList sessions={sessions} onSignOut={signOut} busyId={busyId} />
                    ) : sessions ? (
                        <p className="ms-sessions__hint ms-sessions__body">No sessions found.</p>
                    ) : null}
                    {sessions && (
                        <div className="ms-sessions__foot">
                            <p className="ms-sessions__hint">
                                {others.length === 0 ? "You are not signed in anywhere else." : "Lost a device, or signed in somewhere you should not have?"}
                            </p>
                            <Button
                                size="sm"
                                variant="ghost-danger"
                                icon={<LogOut aria-hidden="true" />}
                                disabled={others.length === 0}
                                onClick={() => { setConfirmError(null); setConfirm({ kind: "others", count: others.length }); }}
                            >
                                Sign out all other sessions
                            </Button>
                        </div>
                    )}
                </section>

                {canManage && <UserSessions onConfirm={(c) => { setConfirmError(null); setConfirm(c); }} refreshKey={userRefresh} />}
            </div>

            {confirm && (
                <Dialog
                    eyebrow="Sessions"
                    title={confirm.kind === "current" ? "Sign out of this device?"
                        : confirm.kind === "others" ? "Sign out all other sessions?"
                            : `Sign ${confirm.user.fullName || confirm.user.email} out everywhere?`}
                    tone="danger"
                    size="sm"
                    busy={confirmBusy}
                    onClose={() => setConfirm(null)}
                >
                    <DialogBody>
                        <p className="ms-sessions__confirm">
                            {confirm.kind === "current" && "This ends the session you are using now. You will go to the sign-in page and need your password to come back."}
                            {confirm.kind === "others" && `This signs you out on ${confirm.count} other ${confirm.count === 1 ? "device" : "devices"}. This device stays signed in.`}
                            {confirm.kind === "user" && (confirm.user.id === user?.id
                                ? "This is your own account: it ends every session, including this one, and you will need to sign in again."
                                : `This ends all ${confirm.count} of their ${confirm.count === 1 ? "session" : "sessions"} at once. They can sign in again with their password.`)}
                        </p>
                        {confirmError && <Alert tone="danger" role="alert">{confirmError}</Alert>}
                    </DialogBody>
                    <DialogFooter>
                        <Button onClick={() => setConfirm(null)} disabled={confirmBusy} data-autofocus>Cancel</Button>
                        <Button variant="danger" onClick={runConfirm} disabled={confirmBusy}>
                            {confirmBusy ? "Signing out…" : confirm.kind === "current" ? "Sign out" : confirm.kind === "others" ? "Sign out others" : "Sign out everywhere"}
                        </Button>
                    </DialogFooter>
                </Dialog>
            )}
        </section>
    );
}
