import { useState } from "react";
import type { FormEvent } from "react";
import { Apple, Chrome, Github } from "lucide-react";
import { post } from "../../api/client";
import { passwordProblem, validatePassword } from "../../utils/validators";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import Toggle from "../../ui/Toggle";
import "../../ui/field.css";
import "../../ui/surface.css";
import "./account.css";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

const ACCOUNTS = [
    { name: "GitHub", Icon: Github },
    { name: "Google", Icon: Chrome },
    { name: "Apple", Icon: Apple },
];

/** Settings > Security: change the password; two-factor and single sign-on are coming soon. */
export default function SecurityTab() {
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [pwMsg, setPwMsg] = useState<string | null>(null);
    const [pwError, setPwError] = useState<string | null>(null);
    const [pwBusy, setPwBusy] = useState(false);

    const pwResult = newPw ? validatePassword(newPw) : null;
    const pwStrength = pwResult ? Object.values(pwResult.checks).filter(Boolean).length : 0;
    const pwTotal = pwResult ? Object.keys(pwResult.checks).length : 1;

    async function handlePasswordChange(e: FormEvent<HTMLFormElement>) {
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
                        <p className="ms-account__sub">At least 8 characters, with a number and a symbol.</p>
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
                                    <span className="ms-account__strength-text">{passwordProblem(newPw) || "Meets all requirements"}</span>
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
