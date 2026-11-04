import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { get, post } from "../../api/client";
import type { DepartmentResponse } from "../../api/types";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import {
    validateFullName,
    validateEmail,
    validatePassword,
    PASSWORD_LABELS,
    validatePhone,
} from "../../utils/validators";
import AuthLayout from "./AuthLayout";
import "./register.css";

type FieldKey = "fullName" | "phone" | "email" | "password" | "confirm";

type MeterProps<K extends string> = {
    id: string;
    show: boolean;
    checks: Record<K, boolean>;
    labels: Record<K, string>;
};

/** The live checklist under a field: a progress bar and the rules that are not met yet. */
function RequirementMeter<K extends string>({ id, show, checks, labels }: MeterProps<K>) {
    const entries = Object.entries(checks) as [K, boolean][];
    const passed = entries.filter(([, ok]) => ok).length;
    const pct = entries.length === 0 ? 0 : Math.round((passed / entries.length) * 100);
    const level = pct >= 100 ? "ok" : pct >= 50 ? "warn" : "danger";
    const unmet = entries.filter(([, ok]) => !ok).map(([key]) => key);

    return (
        <div className="ms-auth-meter" id={id} hidden={!show}>
            <div className="ms-auth-meter__bar" aria-hidden="true">
                <div className={`ms-auth-meter__fill ms-auth-meter__fill--${level}`} style={{ width: `${pct}%` }} />
            </div>
            <ul className="ms-auth-meter__list">
                {unmet.map((key) => (
                    <li key={key} className="ms-field__error">
                        <TriangleAlert aria-hidden="true" />
                        <span>{labels[key]}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function Register() {
    const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
    const [deptLoading, setDeptLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState("");
    const [focusField, setFocusField] = useState<FieldKey | null>(null);
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
                const data = await get<DepartmentResponse[]>("/api/departments", { authRedirect: false });
                if (alive) setDepartments(Array.isArray(data) ? data : []);
            } catch (err) {
                if (alive) {
                    setDepartments([]);
                    setServerError(`Could not load departments: ${err instanceof Error ? err.message : String(err)}`);
                }
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

    const phoneVal = useMemo(() => validatePhone(phone), [phone]);

    const canSubmit = nameVal.ok && phoneVal.ok && emailVal.ok && departmentId && passVal.ok && confirmOk;

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!canSubmit || loading) return;
        setLoading(true);
        setServerError("");
        try {
            const res = await post<{ message?: string }>("/api/auth/register", {
                fullName: fullName.trim(),
                phone: phone.replace(/\s/g, ""),
                email: email.trim(),
                departmentId: Number(departmentId),
                password,
            }, { authRedirect: false });
            const notice = res?.message || "Your request was sent. An administrator will review it.";
            navigate("/login", { state: { notice } });
        } catch (err) {
            setServerError((err instanceof Error && err.message) || "Registration failed.");
        } finally {
            setLoading(false);
        }
    }

    const focusProps = (key: FieldKey) => ({
        onFocus: () => setFocusField(key),
        onBlur: () => setFocusField(null),
    });

    const showName = focusField === "fullName" && !nameVal.ok;
    const showPhone = focusField === "phone" && !phoneVal.ok;
    const showEmail = focusField === "email" && !emailVal.ok;
    const showPassword = focusField === "password" && !passVal.ok;
    const showConfirm = focusField === "confirm" && !confirmOk;

    const summary = !nameVal.ok ? "Please provide your full name (Name Surname)" :
        !phoneVal.ok ? "Please provide a valid phone number (min 7 digits)" :
            !emailVal.ok ? "Please provide a valid email address" :
                !departmentId ? "Please select a department" :
                    !passVal.ok ? (passVal.checks.notCommon ? "Password needs 8+ characters, a number and a symbol" : "That password is too common; choose another") :
                        !confirmOk ? "Passwords do not match" :
                            "Please fix the errors highlighted above";

    return (
        <AuthLayout>
            <h1 className="ms-auth__title">Request access</h1>
            <p className="ms-auth__lead">
                An administrator reviews every request before you can sign in. Already have an account? <Link className="ms-link" to="/login">Sign in</Link>
            </p>

            <form className="ms-auth__form" onSubmit={onSubmit} autoComplete="off">
                {serverError && <Alert tone="danger" role="alert">{serverError}</Alert>}

                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="reg-name">Full name</label>
                    <input
                        id="reg-name"
                        className="ms-input"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Name Surname"
                        aria-describedby="reg-name-rules"
                        {...focusProps("fullName")}
                        required
                    />
                    <RequirementMeter
                        id="reg-name-rules"
                        show={showName}
                        checks={nameVal.checks}
                        labels={{ nonEmpty: "Must not be empty", twoWords: "First and last name required", capitalized: "Each name must start with a capital letter", maxLen: "At most 100 characters" }}
                    />
                </div>

                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="reg-phone">Telephone number</label>
                    <input
                        id="reg-phone"
                        className="ms-input"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+40 7xx xxx xxx"
                        aria-describedby="reg-phone-rules"
                        {...focusProps("phone")}
                        required
                    />
                    <RequirementMeter
                        id="reg-phone-rules"
                        show={showPhone}
                        checks={phoneVal.checks}
                        labels={{ nonEmpty: "Must not be empty", formatOk: "Use digits, spaces, + ( ) or -", minDigits: "Minimum 7 digits" }}
                    />
                </div>

                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="reg-email">Email address</label>
                    <input
                        id="reg-email"
                        className="ms-input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@mehstudios.net"
                        aria-describedby="reg-email-rules"
                        {...focusProps("email")}
                        required
                    />
                    <RequirementMeter
                        id="reg-email-rules"
                        show={showEmail}
                        checks={emailVal.checks}
                        labels={{ nonEmpty: "Email is required", formatOk: "Invalid email format" }}
                    />
                </div>

                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="reg-department">Department</label>
                    <div className="ms-select">
                        <select
                            id="reg-department"
                            className="ms-input"
                            value={departmentId}
                            onChange={(e) => setDepartmentId(e.target.value)}
                            required
                        >
                            <option value="" disabled>{deptLoading ? "Loading..." : "Select department"}</option>
                            {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                        </select>
                    </div>
                </div>

                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="reg-password">Password</label>
                    <input
                        id="reg-password"
                        className="ms-input"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        aria-describedby="reg-password-rules"
                        {...focusProps("password")}
                        required
                    />
                    <RequirementMeter
                        id="reg-password-rules"
                        show={showPassword}
                        checks={passVal.checks}
                        labels={PASSWORD_LABELS}
                    />
                </div>

                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="reg-confirm">Confirm password</label>
                    <input
                        id="reg-confirm"
                        className="ms-input"
                        type="password"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="••••••••"
                        aria-describedby="reg-confirm-rules"
                        {...focusProps("confirm")}
                        required
                    />
                    <RequirementMeter
                        id="reg-confirm-rules"
                        show={showConfirm}
                        checks={{ matches: confirmOk }}
                        labels={{ matches: "Passwords must match" }}
                    />
                </div>

                {!canSubmit && (fullName || email || phone) && (
                    <Alert tone="danger">{summary}</Alert>
                )}

                <Button type="submit" variant="primary" full disabled={!canSubmit || loading}>
                    {loading ? "Sending request..." : "Send request"}
                </Button>
            </form>
        </AuthLayout>
    );
}
