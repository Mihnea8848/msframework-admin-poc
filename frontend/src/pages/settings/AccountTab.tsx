import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { primaryRole } from "../../auth/permissions";
import { post } from "../../api/client";
import type { CurrentUserDto } from "../../api/types";
import { validateEmail } from "../../utils/validators";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import "../../ui/field.css";
import "../../ui/surface.css";
import "./account.css";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Settings > Account: who you are, and changing your email address. */
export default function AccountTab() {
    const { user, setUser } = useAuth();

    const [newEmail, setNewEmail] = useState("");
    const [emailPw, setEmailPw] = useState("");
    const [emailMsg, setEmailMsg] = useState<string | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [emailBusy, setEmailBusy] = useState(false);

    async function handleEmailChange(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setEmailMsg(null);
        setEmailError(null);
        if (!validateEmail(newEmail).ok) { setEmailError("Enter a valid email address."); return; }
        if (!emailPw) { setEmailError("Enter your current password to confirm."); return; }

        setEmailBusy(true);
        try {
            const updated = await post<CurrentUserDto>("/api/auth/email", { email: newEmail.trim(), currentPassword: emailPw });
            setUser(updated);
            setEmailMsg(`Email updated to ${updated.email}.`);
            setNewEmail("");
            setEmailPw("");
        } catch (err) {
            setEmailError(messageOf(err));
        } finally {
            setEmailBusy(false);
        }
    }

    return (
        <div className="ms-account">
            <div className="ms-account__grid">
                <section className="ms-panel ms-account__card" aria-labelledby="account-profile">
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id="account-profile">Profile</h2>
                    </div>
                    <div className="ms-account__body">
                        <dl className="ms-account__facts">
                            <dt>Name</dt>
                            <dd>{user?.fullName || "—"}</dd>
                            <dt>Email</dt>
                            <dd>{user?.email || "—"}</dd>
                            <dt>Role</dt>
                            <dd>{user ? primaryRole(user) : "—"}</dd>
                            <dt>Department</dt>
                            <dd>{user?.departmentName || "None"}</dd>
                            <dt>Phone</dt>
                            <dd>{user?.phone || "—"}</dd>
                        </dl>
                        <p className="ms-account__sub">Your name, role and department are managed by an administrator.</p>
                    </div>
                </section>

                <form className="ms-panel ms-account__card" onSubmit={handleEmailChange} aria-labelledby="account-email">
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id="account-email">Email Address</h2>
                    </div>
                    <div className="ms-account__body">
                        <p className="ms-account__sub">Current: <strong>{user?.email || "—"}</strong></p>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="new-email">New email</label>
                            <input id="new-email" className="ms-input" type="email" autoComplete="email" placeholder="name@mehstudios.net"
                                value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                        </div>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="email-pw">Current password</label>
                            <input id="email-pw" className="ms-input" type="password" autoComplete="current-password" placeholder="••••••••"
                                value={emailPw} onChange={(e) => setEmailPw(e.target.value)} />
                        </div>
                        {emailMsg && <Alert tone="ok" role="status">{emailMsg}</Alert>}
                        {emailError && <Alert tone="danger" role="alert">{emailError}</Alert>}
                        <div className="ms-account__actions">
                            <Button type="submit" variant="primary" disabled={emailBusy}>
                                {emailBusy ? "Updating…" : "Update Email"}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
