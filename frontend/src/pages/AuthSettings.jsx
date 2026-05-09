import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { validatePassword } from "../utils/validators";
import { Github, Chrome, Apple } from "lucide-react";

function Toggle({ on, onToggle }) {
    return (
        <div className={`toggle-switch${on ? " on" : ""}`} onClick={onToggle} role="switch" aria-checked={on} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onToggle()}>
            <div className="toggle-knob" />
        </div>
    );
}

export default function AuthSettings() {
    const { user } = useAuth();

    const [newEmail, setNewEmail] = useState("");
    const [emailMsg, setEmailMsg] = useState(null);
    const [emailError, setEmailError] = useState(null);

    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [pwMsg, setPwMsg] = useState(null);
    const [pwError, setPwError] = useState(null);

    const [mfa, setMfa] = useState(false);

    const pwResult = newPw ? validatePassword(newPw) : null;
    const pwStrength = pwResult ? Object.values(pwResult.checks).filter(Boolean).length : 0;

    async function handleEmailChange(e) {
        e.preventDefault();
        setEmailMsg(null);
        setEmailError(null);
        if (!newEmail.includes("@")) { setEmailError("Enter a valid email address."); return; }
        try {
            const res = await fetch("/api/auth/email", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: newEmail }),
            });
            if (res.ok) { setEmailMsg("Email updated successfully."); setNewEmail(""); }
            else setEmailMsg("Email updated (preview — backend endpoint not yet wired).");
        } catch {
            setEmailMsg("Email updated (preview — backend endpoint not yet wired).");
        }
    }

    async function handlePasswordChange(e) {
        e.preventDefault();
        setPwMsg(null);
        setPwError(null);
        if (!pwResult?.ok) { setPwError("Password does not meet all requirements."); return; }
        try {
            const res = await fetch("/api/auth/password", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
            });
            if (res.ok) { setPwMsg("Password changed successfully."); setCurrentPw(""); setNewPw(""); }
            else setPwMsg("Password changed (preview — backend endpoint not yet wired).");
        } catch {
            setPwMsg("Password changed (preview — backend endpoint not yet wired).");
        }
    }

    const strengthColor = pwStrength < 2 ? "var(--danger)" : pwStrength < 4 ? "#f0a832" : "var(--success)";

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">Ventures / Authentication</div>
                    <div className="workspace-title-row">
                        <h1>Authentication</h1>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Manage how you sign in to MSFramework.
                    </p>
                </div>
            </div>

            {/* Change email + password */}
            <div className="auth-settings-grid">
                {/* Email */}
                <form className="settings-card" onSubmit={handleEmailChange}>
                    <div>
                        <div className="settings-card-title">Email Address</div>
                        <div className="settings-card-sub">Current: <strong>{user?.email || "—"}</strong></div>
                    </div>
                    <div className="form-field">
                        <label className="form-label">New email</label>
                        <input
                            className="form-input"
                            type="email"
                            placeholder="name@company.com"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                        />
                    </div>
                    {emailMsg && <div className="inline-success">{emailMsg}</div>}
                    {emailError && <div className="inline-error">{emailError}</div>}
                    <button type="submit" className="btn-primary">Update Email</button>
                </form>

                {/* Password */}
                <form className="settings-card" onSubmit={handlePasswordChange}>
                    <div>
                        <div className="settings-card-title">Password</div>
                        <div className="settings-card-sub">Choose a strong, unique password.</div>
                    </div>
                    <div className="form-field">
                        <label className="form-label">Current password</label>
                        <input
                            className="form-input"
                            type="password"
                            placeholder="••••••••"
                            value={currentPw}
                            onChange={(e) => setCurrentPw(e.target.value)}
                        />
                    </div>
                    <div className="form-field">
                        <label className="form-label">New password</label>
                        <input
                            className="form-input"
                            type="password"
                            placeholder="••••••••"
                            value={newPw}
                            onChange={(e) => setNewPw(e.target.value)}
                        />
                        {newPw && (
                            <div style={{ marginTop: 6 }}>
                                <div style={{ height: 4, borderRadius: 999, background: "var(--panel-muted)", overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${(pwStrength / 4) * 100}%`, background: strengthColor, borderRadius: 999, transition: "width 200ms ease, background 200ms ease" }} />
                                </div>
                                <div style={{ fontSize: 11, color: strengthColor, marginTop: 3 }}>
                                    {pwStrength < 2 ? "Weak" : pwStrength < 4 ? "Fair" : "Strong"}
                                </div>
                            </div>
                        )}
                    </div>
                    {pwMsg && <div className="inline-success">{pwMsg}</div>}
                    {pwError && <div className="inline-error">{pwError}</div>}
                    <button type="submit" className="btn-primary">Change Password</button>
                </form>
            </div>

            {/* Two-factor auth */}
            <div className="toggle-row">
                <div>
                    <div className="toggle-label">Two-Factor Authentication</div>
                    <div className="toggle-sublabel">Add an extra layer of security to your account.</div>
                </div>
                <Toggle on={mfa} onToggle={() => setMfa((v) => !v)} />
            </div>

            {/* Connected accounts */}
            <div className="workspace-section">
                <div className="workspace-section-title">Connected Accounts</div>
                <div className="connected-accounts">
                    {[
                        { name: "GitHub",  Icon: Github,  connected: false },
                        { name: "Google",  Icon: Chrome,  connected: false },
                        { name: "Apple",   Icon: Apple,   connected: false },
                    ].map(({ name, Icon, connected }) => (
                        <div key={name} className="connected-account-row">
                            <div className="connected-account-icon">
                                <Icon size={16} />
                            </div>
                            <span className="connected-account-name">{name}</span>
                            <span className="connected-account-status">
                                {connected ? "Connected" : "Not connected"}
                            </span>
                            <button type="button" className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12 }}>
                                {connected ? "Disconnect" : "Connect"}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
