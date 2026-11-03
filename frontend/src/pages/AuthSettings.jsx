import { useState } from "react";
import { Github, Chrome, Apple } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { primaryRole } from "../auth/permissions";
import { post } from "../api/client";
import { validateEmail, validatePassword, passwordProblem } from "../utils/validators";
import PageHeader from "../ui/PageHeader";
import Toggle from "../ui/Toggle.jsx";

export default function AuthSettings() {
    const { user, setUser } = useAuth();

    const [newEmail, setNewEmail] = useState("");
    const [emailPw, setEmailPw] = useState("");
    const [emailMsg, setEmailMsg] = useState(null);
    const [emailError, setEmailError] = useState(null);
    const [emailBusy, setEmailBusy] = useState(false);

    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [pwMsg, setPwMsg] = useState(null);
    const [pwError, setPwError] = useState(null);
    const [pwBusy, setPwBusy] = useState(false);

    const pwResult = newPw ? validatePassword(newPw) : null;
    const pwStrength = pwResult ? Object.values(pwResult.checks).filter(Boolean).length : 0;
    const pwTotal = pwResult ? Object.keys(pwResult.checks).length : 1;

    async function handleEmailChange(e) {
        e.preventDefault();
        setEmailMsg(null);
        setEmailError(null);
        if (!validateEmail(newEmail).ok) { setEmailError("Enter a valid email address."); return; }
        if (!emailPw) { setEmailError("Enter your current password to confirm."); return; }

        setEmailBusy(true);
        try {
            const updated = await post("/api/auth/email", { email: newEmail.trim(), currentPassword: emailPw });
            setUser(updated);
            setEmailMsg(`Email updated to ${updated.email}.`);
            setNewEmail("");
            setEmailPw("");
        } catch (err) {
            setEmailError(err.message);
        } finally {
            setEmailBusy(false);
        }
    }

    async function handlePasswordChange(e) {
        e.preventDefault();
        setPwMsg(null);
        setPwError(null);
        if (!currentPw) { setPwError("Enter your current password."); return; }
        const problem = passwordProblem(newPw);
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
            setPwError(err.message);
        } finally {
            setPwBusy(false);
        }
    }

    const strengthColor = pwStrength / pwTotal < 0.5 ? "var(--danger)" : pwStrength < pwTotal ? "var(--status-warn-fg)" : "var(--success)";

    return (
        <section className="workspace">
            <PageHeader
                breadcrumb="Ventures / Account & security"
                title="Account & security"
                subtitle={user ? `Signed in as ${user.fullName || user.email} · ${primaryRole(user)}${user.departmentName ? ` · ${user.departmentName}` : ""}` : null}
            />

            <div className="auth-settings-grid">
                <form className="settings-card" onSubmit={handleEmailChange}>
                    <div>
                        <div className="settings-card-title">Email Address</div>
                        <div className="settings-card-sub">Current: <strong>{user?.email || "—"}</strong></div>
                    </div>
                    <div className="form-field">
                        <label className="form-label" htmlFor="new-email">New email</label>
                        <input
                            id="new-email"
                            className="form-input"
                            type="email"
                            autoComplete="email"
                            placeholder="name@mehstudios.net"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                        />
                    </div>
                    <div className="form-field">
                        <label className="form-label" htmlFor="email-pw">Current password</label>
                        <input
                            id="email-pw"
                            className="form-input"
                            type="password"
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={emailPw}
                            onChange={(e) => setEmailPw(e.target.value)}
                        />
                    </div>
                    {emailMsg && <div className="inline-success">{emailMsg}</div>}
                    {emailError && <div className="inline-error" role="alert">{emailError}</div>}
                    <button type="submit" className="btn-primary" disabled={emailBusy}>
                        {emailBusy ? "Updating…" : "Update Email"}
                    </button>
                </form>

                <form className="settings-card" onSubmit={handlePasswordChange}>
                    <div>
                        <div className="settings-card-title">Password</div>
                        <div className="settings-card-sub">At least 8 characters, with a number and a symbol.</div>
                    </div>
                    <div className="form-field">
                        <label className="form-label" htmlFor="current-pw">Current password</label>
                        <input
                            id="current-pw"
                            className="form-input"
                            type="password"
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={currentPw}
                            onChange={(e) => setCurrentPw(e.target.value)}
                        />
                    </div>
                    <div className="form-field">
                        <label className="form-label" htmlFor="new-pw">New password</label>
                        <input
                            id="new-pw"
                            className="form-input"
                            type="password"
                            autoComplete="new-password"
                            placeholder="••••••••"
                            value={newPw}
                            onChange={(e) => setNewPw(e.target.value)}
                        />
                        {newPw && (
                            <div style={{ marginTop: 6 }}>
                                <div style={{ height: 4, borderRadius: 999, background: "var(--panel-muted)", overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${(pwStrength / pwTotal) * 100}%`, background: strengthColor, borderRadius: 999, transition: "width 200ms ease, background 200ms ease" }} />
                                </div>
                                <div style={{ fontSize: 11, color: strengthColor, marginTop: 3 }}>
                                    {passwordProblem(newPw) || "Meets all requirements"}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="form-field">
                        <label className="form-label" htmlFor="confirm-pw">Confirm new password</label>
                        <input
                            id="confirm-pw"
                            className="form-input"
                            type="password"
                            autoComplete="new-password"
                            placeholder="••••••••"
                            value={confirmPw}
                            onChange={(e) => setConfirmPw(e.target.value)}
                        />
                    </div>
                    {pwMsg && <div className="inline-success">{pwMsg}</div>}
                    {pwError && <div className="inline-error" role="alert">{pwError}</div>}
                    <button type="submit" className="btn-primary" disabled={pwBusy}>
                        {pwBusy ? "Changing…" : "Change Password"}
                    </button>
                </form>
            </div>

            <div className="toggle-row">
                <div>
                    <div className="toggle-label">
                        Two-Factor Authentication <span className="badge-soon">Coming soon</span>
                    </div>
                    <div className="toggle-sublabel">An extra verification step at sign-in. Not available yet.</div>
                </div>
                <Toggle on={false} disabled onToggle={() => {}} label="Two-factor authentication (not available yet)" />
            </div>

            <div className="workspace-section">
                <div className="workspace-section-title">
                    Connected Accounts <span className="badge-soon">Coming soon</span>
                </div>
                <div className="connected-accounts">
                    {[
                        { name: "GitHub", Icon: Github },
                        { name: "Google", Icon: Chrome },
                        { name: "Apple", Icon: Apple },
                    ].map((account) => {
                        const AccountIcon = account.Icon;
                        return (
                            <div key={account.name} className="connected-account-row">
                                <div className="connected-account-icon">
                                    <AccountIcon size={16} />
                                </div>
                                <span className="connected-account-name">{account.name}</span>
                                <span className="connected-account-status">Not connected</span>
                                <button type="button" className="btn-secondary btn-small" disabled title="Single sign-on is not available yet">
                                    Connect
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
