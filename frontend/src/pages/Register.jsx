import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/ms_logo.png";
import WavyBackground from "../ui/WavyBackground.jsx";
import {
    validateFullName,
    validateEmail,
    validatePhone,
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
                <div
                    className="req-bar-fill"
                    style={{ width: `${pct}%`, background: barColor }}
                />
            </div>

            <div className="req-list">
                {unmet.map((k, i) => (
                    <div
                        key={k}
                        className="req-item"
                        style={{ transitionDelay: `${i * 70}ms` }}
                    >
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
    const [deptError, setDeptError] = useState("");

    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    const [focusField, setFocusField] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        let alive = true;

        async function loadDepartments() {
            setDeptLoading(true);
            setDeptError("");

            try {
                const res = await fetch("/api/departments", {
                    credentials: "include"
                });

                const data = await res.json();
                if (alive) setDepartments(Array.isArray(data) ? data : []);
            } catch {
                if (alive) setDeptError("Failed to load departments.");
            } finally {
                if (alive) setDeptLoading(false);
            }
        }

        loadDepartments();
        return () => { alive = false; };
    }, []);

    const nameVal = useMemo(() => validateFullName(fullName), [fullName]);
    const phoneVal = useMemo(() => validatePhone(phone), [phone]);
    const passVal = useMemo(() => validatePassword(password), [password]);
    const emailVal = useMemo(() => validateEmail(email), [email]);
    const confirmOk = confirm.length > 0 && confirm === password;

    const canSubmit =
        nameVal.ok &&
        phoneVal.ok &&
        emailVal.ok &&
        departmentId &&
        passVal.ok &&
        confirmOk;

    async function onSubmit(e) {
        e.preventDefault();
        if (!canSubmit) return;

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    fullName,
                    phone,
                    email,
                    departmentId: parseInt(departmentId, 10),
                    password,
                }),
            });

            if (!res.ok) {
                const errorMessage = await res.text();
                alert(`Registration failed: ${errorMessage}`); // Temp. alert in case things go south
                return;
            }
            navigate("/login");

        } catch (err) {
            console.error("Network error:", err);
            alert("Unable to contact the server.");
        }
    }

    return (
        <div className="auth-bg">
            <div className="auth-circuit">
                <WavyBackground colorA="#28beef" colorB="#2487cb" />
                <div className="auth-card auth-card-wide">
                    <div className="auth-brand">
                        <img className="auth-logo" src={logo} alt="MSFramework" />
                    </div>

                    <h1 className="auth-title">Create Account</h1>
                    <div className="auth-subtitle">
                        Already have an account? <Link className="auth-link" to="/login">Sign in</Link>
                    </div>

                    <form className="auth-form" onSubmit={onSubmit} autoComplete="off">
                        <div className="auth-grid">
                            <div className="auth-field field-wrapper">
                                <label className="auth-label" htmlFor="fullName">Full name</label>
                                <input
                                    id="fullName"
                                    className="auth-input"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Name Surname"
                                    onFocus={() => setFocusField("fullName")}
                                    onBlur={() => setFocusField((f) => (f === "fullName" ? null : f))}
                                    required
                                />
                                <RequirementMeter
                                    show={focusField === "fullName" && !nameVal.ok}
                                    checks={nameVal.checks}
                                    labels={{
                                        nonEmpty: "Must not be empty",
                                        twoWords: "Must contain at least 2 words",
                                        capitalized: "Each word must start with a capital letter",
                                    }}
                                />
                            </div>

                            <div className="auth-field field-wrapper">
                                <label className="auth-label" htmlFor="phone">Telephone number</label>
                                <input
                                    id="phone"
                                    className="auth-input"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+40712345678"
                                    onFocus={() => setFocusField("phone")}
                                    onBlur={() => setFocusField((f) => (f === "phone" ? null : f))}
                                    required
                                />
                                <RequirementMeter
                                    show={focusField === "phone" && !phoneVal.ok}
                                    checks={phoneVal.checks}
                                    labels={{
                                        nonEmpty: "Must not be empty",
                                        formatOk: "May start with +, otherwise digits only",
                                        minDigits: "Must contain at least 7 digits",
                                    }}
                                />
                            </div>

                            <div className="auth-field field-wrapper">
                                <label className="auth-label" htmlFor="email">Email address</label>
                                <input
                                    id="email"
                                    className="auth-input"
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email address"
                                    onFocus={() => setFocusField("email")}
                                    onBlur={() => setFocusField((f) => (f === "email" ? null : f))}
                                    required
                                />
                                <RequirementMeter
                                    show={focusField === "email" && !emailVal.ok}
                                    checks={emailVal.checks}
                                    labels={{
                                        nonEmpty: "Must not be empty",
                                        formatOk: "Must be a valid email (example@domain.com)",
                                    }}
                                />
                            </div>

                            <div className="auth-field field-wrapper">
                                <label className="auth-label" htmlFor="dept">Department</label>
                                <select
                                    id="dept"
                                    className="auth-input auth-select"
                                    value={departmentId}
                                    onChange={(e) => setDepartmentId(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>
                                        {deptLoading ? "Loading departments..." : "Select a department"}
                                    </option>
                                    {departments.map((d) => (
                                        <option key={d.id ?? d.name} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                                {deptError ? <div className="auth-inline-error">{deptError}</div> : null}
                            </div>

                            <div className="auth-field field-wrapper">
                                <label className="auth-label" htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    className="auth-input"
                                    type="password"
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    onFocus={() => setFocusField("password")}
                                    onBlur={() => setFocusField((f) => (f === "password" ? null : f))}
                                    required
                                />
                                <RequirementMeter
                                    show={focusField === "password" && !passVal.ok}
                                    checks={passVal.checks}
                                    labels={{
                                        minLen: "At least 8 characters",
                                        hasNumber: "Must contain a number",
                                        hasSymbol: "Must contain a symbol",
                                    }}
                                />
                            </div>

                            <div className="auth-field field-wrapper">
                                <label className="auth-label" htmlFor="confirm">Confirm password</label>
                                <input
                                    id="confirm"
                                    className="auth-input"
                                    type="password"
                                    autoComplete="new-password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    placeholder="Confirm password"
                                    onFocus={() => setFocusField("confirm")}
                                    onBlur={() => setFocusField((f) => (f === "confirm" ? null : f))}
                                    required
                                />
                                <RequirementMeter
                                    show={focusField === "confirm" && !confirmOk}
                                    checks={{ matches: confirmOk }}
                                    labels={{ matches: "Passwords must match" }}
                                />
                            </div>
                        </div>

                        <button className="auth-primary" type="submit" disabled={!canSubmit}>
                            Create account
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}