import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/ms_logo.png";
import WavyBackground from "../ui/WavyBackground.jsx";
import {
    validateFullName,
    validateEmail,
    validatePassword
} from "../utils/validators.js";

function RequirementMeter({ show, checks, labels }) {
    const entries = Object.entries(checks);
    const total = entries.length;
    const passed = entries.filter(([, v]) => v).length;
    const pct = total === 0 ? 0 : Math.round((passed / total) * 100);
    const unmet = entries.filter(([, v]) => !v).map(([k]) => k);
    const hue = Math.round((pct / 100) * 105);
    const barColor = `hsl(${hue} 90% 55%)`;

    return (
        <div className={`req-shell ${show ? "show" : ""}`}>
            <div className="req-bar">
                <div className="req-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
            </div>
            <div className="req-list">
                {unmet.map((k, i) => (
                    <div key={k} className="req-item" style={{ transitionDelay: `${i * 70}ms` }}>
                        ⚠ {labels[k]}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Register() {
    const [departments, setDepartments] = useState([]);
    const [deptLoading, setDeptLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState("");
    const [focusField, setFocusField] = useState(null);
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        let alive = true;
        async function loadDepartments() {
            setDeptLoading(true);
            try {
                const res = await fetch("/api/departments");
                const data = await res.json();
                if (alive) setDepartments(Array.isArray(data) ? data : []);
            } catch {
                if (alive) setDepartments([]);
            } finally {
                if (alive) setDeptLoading(false);
            }
        }
        loadDepartments().catch(() => {});
        return () => { alive = false; };
    }, []);

    const nameVal = useMemo(() => validateFullName(fullName), [fullName]);
    const emailVal = useMemo(() => validateEmail(email), [email]);
    const passVal = useMemo(() => validatePassword(password), [password]);
    const confirmOk = confirm.length > 0 && confirm === password;

    const phoneVal = useMemo(() => {
        const v = phone.trim();
        const nonEmpty = v.length > 0;
        const formatOk = /^[\d\s+]*$/.test(v);
        const digitsOnly = v.replace(/\D/g, "");
        const minDigits = digitsOnly.length >= 7;
        return { ok: nonEmpty && formatOk && minDigits, checks: { nonEmpty, formatOk, minDigits } };
    }, [phone]);

    const canSubmit = nameVal.ok && phoneVal.ok && emailVal.ok && departmentId && passVal.ok && confirmOk;

    async function onSubmit(e) {
        e.preventDefault();
        if (!canSubmit || loading) return;
        setLoading(true);
        setServerError("");
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName,
                    phone: phone.replace(/\s/g, ""),
                    email,
                    departmentId: parseInt(departmentId, 10),
                    password,
                }),
            });
            if (!res.ok) {
                const msg = await res.text();
                setServerError(msg || "Registration failed.");
                return;
            }
            navigate("/login");
        } catch {
            setServerError("Unable to contact the server.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-bg" style={{ minHeight: "100vh", paddingBottom: "140px", overflowY: "auto" }}>
            <div className="auth-circuit">
                <WavyBackground colorA="#28beef" colorB="#2487cb" />
                <div className="auth-card auth-card-wide" style={{ marginBottom: 60 }}>
                    <div className="auth-brand">
                        <img className="auth-logo" src={String(logo)} alt="MSFramework" />
                    </div>
                    <h1 className="auth-title">Create Account</h1>
                    <div className="auth-subtitle">
                        Already have an account? <Link className="auth-link" to="/login">Sign in</Link>
                    </div>
                    <form className="auth-form" onSubmit={onSubmit} autoComplete="off">
                        {serverError && <div className="login-error show" style={{ marginBottom: 20 }}>{serverError}</div>}
                        <div className="auth-grid">
                            <div className="auth-field field-wrapper">
                                <label className="auth-label">Full name</label>
                                <input className="auth-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Name Surname" onFocus={() => setFocusField("fullName")} onBlur={() => setFocusField(null)} required />
                                <RequirementMeter show={focusField === "fullName" && !nameVal.ok} checks={nameVal.checks} labels={{ nonEmpty: "Must not be empty", twoWords: "First and last name required", capitalized: "Words must be capitalized" }} />
                            </div>
                            <div className="auth-field field-wrapper">
                                <label className="auth-label">Telephone number</label>
                                <input className="auth-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+40 7xx xxx xxx" onFocus={() => setFocusField("phone")} onBlur={() => setFocusField(null)} required />
                                <RequirementMeter show={focusField === "phone" && !phoneVal.ok} checks={phoneVal.checks} labels={{ nonEmpty: "Must not be empty", formatOk: "Use only + and digits", minDigits: "Minimum 7 digits" }} />
                            </div>
                            <div className="auth-field field-wrapper">
                                <label className="auth-label">Email address</label>
                                <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@company.com" onFocus={() => setFocusField("email")} onBlur={() => setFocusField(null)} required />
                                <RequirementMeter show={focusField === "email" && !emailVal.ok} checks={emailVal.checks} labels={{ nonEmpty: "Email is required", formatOk: "Invalid email format" }} />
                            </div>
                            <div className="auth-field field-wrapper">
                                <label className="auth-label">Department</label>
                                <select className="auth-input auth-select" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
                                    <option value="" disabled>{deptLoading ? "Loading..." : "Select department"}</option>
                                    {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                                </select>
                            </div>
                            <div className="auth-field field-wrapper">
                                <label className="auth-label">Password</label>
                                <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" onFocus={() => setFocusField("password")} onBlur={() => setFocusField(null)} required />
                                <RequirementMeter show={focusField === "password" && !passVal.ok} checks={passVal.checks} labels={{ minLen: "At least 8 characters", hasNumber: "Include a number", hasSymbol: "Include a symbol" }} />
                            </div>
                            <div className="auth-field field-wrapper">
                                <label className="auth-label">Confirm password</label>
                                <input className="auth-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" onFocus={() => setFocusField("confirm")} onBlur={() => setFocusField(null)} required />
                                <RequirementMeter show={focusField === "confirm" && !confirmOk} checks={{ matches: confirmOk }} labels={{ matches: "Passwords must match" }} />
                            </div>
                        </div>
                        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center" }}>
                            {!canSubmit && (fullName || email || phone) && (
                                <div style={{ background: "rgba(255,106,95,0.12)", color: "var(--danger)", padding: "14px 24px", borderRadius: "12px", fontSize: "14px", fontWeight: "700", marginBottom: "24px", textAlign: "center", width: "100%", border: "1px solid rgba(255,106,95,0.3)" }}>
                                    {!nameVal.ok ? "⚠️ Please provide your full name (Name Surname)" :
                                        !departmentId ? "⚠️ Please select a department" :
                                            !phoneVal.ok ? "⚠️ Please provide a valid phone number (min 7 digits)" :
                                                !confirmOk ? "⚠️ Passwords do not match" :
                                                    "⚠️ Please fix the errors highlighted above"}
                                </div>
                            )}
                            <button
                                className="auth-primary gradient-hover-btn"
                                type="submit"
                                disabled={!canSubmit || loading}
                                style={{
                                    width: "100%", padding: "20px", fontSize: "18px", fontWeight: "800", opacity: canSubmit ? 1 : 0.5,
                                    display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center"
                                }}
                            >
                                {loading ? "Creating Account..." : "Create Account"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}