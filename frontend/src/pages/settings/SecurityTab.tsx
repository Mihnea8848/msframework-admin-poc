import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, Chrome, Circle, Github, LogOut, MonitorSmartphone } from "lucide-react";
import Logo from "../../ui/brand/Logo";
import { post } from "../../api/client";
import { fetchMySessions, fetchRegistrationStatus, revokeMyOtherSessions } from "../../api/security";
import type { SessionDto } from "../../api/security";
import { DEFAULT_PASSWORD_MIN_LENGTH, passwordLabels, passwordProblem, validatePassword } from "../../utils/validators";
import type { PasswordRule } from "../../utils/validators";
import { parseUserAgent } from "../../utils/userAgent";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import Toggle from "../../ui/Toggle";
import "../../ui/field.css";
import "../../ui/surface.css";
import "./account.css";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

const ACCOUNTS = [
    { name: "MS:AUTH", Icon: Logo },
    { name: "Google", Icon: Chrome },
    { name: "GitHub", Icon: Github },
];

/** The rules listed under the new password (the byte limit only matters for very long ones). */
const LISTED_RULES: readonly PasswordRule[] = ["minLen", "hasNumber", "hasSymbol", "notCommon"];

/** Your sessions at a glance, with "Sign out other sessions" and a link to the Sessions page. */
function SessionsSummary() {
    const [sessions, setSessions] = useState<SessionDto[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => fetchMySessions()
        .then((list) => { setSessions(Array.isArray(list) ? list : []); setError(null); })
        .catch((err: unknown) => setError(messageOf(err))), []);

    useEffect(() => {
        load();
    }, [load]);

    const current = sessions?.find((s) => s.current);
    const others = (sessions ?? []).filter((s) => !s.current).length;

    async function signOutOthers() {
        setBusy(true);
        setNotice(null);
        try {
            await revokeMyOtherSessions();
            setNotice(`Signed out ${others} other ${others === 1 ? "session" : "sessions"}.`);
            await load();
        } catch (err) {
            setError(messageOf(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="ms-panel ms-account__section" aria-labelledby="account-sessions">
            <div className="ms-panel__head">
                <h2 className="ms-panel__title" id="account-sessions">Sessions</h2>
                <Link className="ms-link ms-account__head-link" to="/sessions">Manage sessions</Link>
            </div>
            <div className="ms-account__body">
                {error && <Alert tone="danger" role="alert">{error}</Alert>}
                {!error && sessions === null && <p className="ms-account__sub" role="status">Loading…</p>}
                {sessions && (
                    <div className="ms-account__sessions">
                        <span className="ms-account__account-icon" aria-hidden="true"><MonitorSmartphone /></span>
                        <div className="ms-account__row-text">
                            <p className="ms-account__count">
                                Signed in on {sessions.length} {sessions.length === 1 ? "device" : "devices"}
                            </p>
                            <p className="ms-account__sub">
                                {current ? `This device: ${parseUserAgent(current.userAgent).label}. ` : ""}
                                {others === 0 ? "No other sessions." : `${others} other ${others === 1 ? "session" : "sessions"}.`}
                            </p>
                        </div>
                    </div>
                )}
                {notice && <Alert tone="ok" role="status">{notice}</Alert>}
                <div className="ms-account__actions">
                    <Button size="sm" variant="ghost-danger" icon={<LogOut aria-hidden="true" />}
                        disabled={busy || others === 0} onClick={signOutOthers}>
                        {busy ? "Signing out…" : "Sign out other sessions"}
                    </Button>
                </div>
            </div>
        </section>
    );
}

/**
 * Settings > Security: change the password (checked against the organisation's minimum
 * length), your sessions at a glance; two-factor and single sign-on are coming soon.
 */
export default function SecurityTab() {
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [pwMsg, setPwMsg] = useState<string | null>(null);
    const [pwError, setPwError] = useState<string | null>(null);
    const [pwBusy, setPwBusy] = useState(false);
    const [minLength, setMinLength] = useState(DEFAULT_PASSWORD_MIN_LENGTH);

    useEffect(() => {
        let alive = true;
        fetchRegistrationStatus()
            .then((status) => { if (alive && status?.passwordMinLength) setMinLength(status.passwordMinLength); })
            .catch(() => {});
        return () => { alive = false; };
    }, []);

    const labels = passwordLabels(minLength);
    const pwResult = newPw ? validatePassword(newPw, minLength) : null;
    const pwStrength = pwResult ? Object.values(pwResult.checks).filter(Boolean).length : 0;
    const pwTotal = pwResult ? Object.keys(pwResult.checks).length : 1;

    async function handlePasswordChange(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setPwMsg(null);
        setPwError(null);
        if (!currentPw) { setPwError("Enter your current password."); return; }
        const problem = passwordProblem(newPw, minLength);
        if (problem) { setPwError(`New password: ${problem.toLowerCase()}.`); return; }
        if (newPw !== confirmPw) { setPwError("The new passwords do not match."); return; }

        setPwBusy(true);
        try {
            await post("/api/auth/password", { currentPassword: currentPw, newPassword: newPw });
            setPwMsg("Password changed successfully.");
            setCurrentPw("");
            setNewPw("");
            setConfirmPw("");
        } catch (err) {
            setPwError(messageOf(err));
        } finally {
            setPwBusy(false);
        }
    }

    const strengthTone = pwStrength / pwTotal < 0.5 ? "danger" : pwStrength < pwTotal ? "warn" : "ok";

    return (
        <div className="ms-account">
            <div className="ms-account__grid">
                <form className="ms-panel ms-account__card" onSubmit={handlePasswordChange} aria-labelledby="account-password">
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id="account-password">Password</h2>
                    </div>
                    <div className="ms-account__body">
                        <ul className="ms-account__rules" aria-label="Password rules">
                            {LISTED_RULES.map((rule) => {
                                const met = Boolean(pwResult?.checks[rule]);
                                return (
                                    <li key={rule} className={met ? "ms-account__rule ms-account__rule--met" : "ms-account__rule"}>
                                        {met ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
                                        <span>{labels[rule]}</span>
                                        {newPw && <span className="ms-visually-hidden">{met ? " (met)" : " (not met yet)"}</span>}
                                    </li>
                                );
                            })}
                        </ul>
                        <p className="ms-account__sub">Common passwords such as “Password123!” are refused, even when they meet the other rules.</p>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="current-pw">Current password</label>
                            <input id="current-pw" className="ms-input" type="password" autoComplete="current-password" placeholder="••••••••"
                                value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
                        </div>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="new-pw">New password</label>
                            <input id="new-pw" className="ms-input" type="password" autoComplete="new-password" placeholder="••••••••"
                                value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                            {newPw && (
                                <div className={`ms-account__strength ms-account__strength--${strengthTone}`}>
                                    <span className="ms-account__meter" aria-hidden="true">
                                        {Array.from({ length: pwTotal }, (_, i) => (
                                            <span key={i} className={i < pwStrength ? "ms-account__seg ms-account__seg--on" : "ms-account__seg"} />
                                        ))}
                                    </span>
                                    <span className="ms-account__strength-text">{passwordProblem(newPw, minLength) || "Meets all requirements"}</span>
                                </div>
                            )}
                        </div>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="confirm-pw">Confirm new password</label>
                            <input id="confirm-pw" className="ms-input" type="password" autoComplete="new-password" placeholder="••••••••"
                                value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                        </div>
                        {pwMsg && <Alert tone="ok" role="status">{pwMsg}</Alert>}
                        {pwError && <Alert tone="danger" role="alert">{pwError}</Alert>}
                        <div className="ms-account__actions">
                            <Button type="submit" variant="primary" disabled={pwBusy}>
                                {pwBusy ? "Changing…" : "Change Password"}
                            </Button>
                        </div>
                    </div>
                </form>

                <div className="ms-account__stack">
                    <SessionsSummary />

                    <section className="ms-panel ms-account__section" aria-labelledby="account-2fa">
                        <div className="ms-account__row">
                            <div className="ms-account__row-text">
                                <h2 className="ms-account__row-title" id="account-2fa">
                                    Two-Factor Authentication <span className="ms-tag">Coming soon</span>
                                </h2>
                                <p className="ms-account__sub">An extra verification step at sign-in. Not available yet.</p>
                            </div>
                            <Toggle on={false} disabled onToggle={() => {}} label="Two-factor authentication (not available yet)" />
                        </div>
                    </section>

                    <section className="ms-panel ms-account__section" aria-labelledby="account-connected">
                        <div className="ms-panel__head">
                            <h2 className="ms-panel__title" id="account-connected">
                                Connected Accounts <span className="ms-tag">Coming soon</span>
                            </h2>
                        </div>
                        <ul className="ms-account__accounts">
                            {ACCOUNTS.map(({ name, Icon }) => (
                                <li key={name} className="ms-account__account">
                                    <span className="ms-account__account-icon" aria-hidden="true"><Icon /></span>
                                    <span className="ms-account__account-name">{name}</span>
                                    <span className="ms-account__account-status">Not connected</span>
                                    <Button size="sm" disabled title="Single sign-on is not available yet">Connect</Button>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
}
