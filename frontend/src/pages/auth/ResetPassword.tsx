import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import { passwordProblem } from "../../utils/validators";
import AuthLayout from "./AuthLayout";

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { resetPassword } = useAuth();

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (loading) return;

        setMessage(null);
        setError(null);

        if (!token) {
            setError("Invalid or missing reset token.");
            return;
        }

        const problem = passwordProblem(password);
        if (problem) {
            setError(`Password requirement not met: ${problem.toLowerCase()}.`);
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        try {
            await resetPassword(token, password);

            setMessage("Password reset successfully. Redirecting to login...");

            setTimeout(() => {
                navigate("/login", { replace: true, state: { notice: "Password updated. Sign in with your new password." } });
            }, 1500);
        } catch (err) {
            setError((err instanceof Error && err.message) || "Could not reset password. The link may be invalid or expired.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthLayout>
            <h1 className="ms-auth__title">Reset password</h1>
            <p className="ms-auth__lead">
                Choose a new password for your account (8+ characters, with a number and a symbol).
            </p>

            <form className="ms-auth__form" onSubmit={onSubmit}>
                {!token && (
                    <Alert tone="danger">
                        This page needs the link from your reset email.{" "}
                        <Link to="/forgot-password">Request a new link</Link>
                    </Alert>
                )}
                {message && <Alert tone="ok" role="status">{message}</Alert>}
                {error && <Alert tone="danger" role="alert">{error}</Alert>}

                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="password">New password</label>
                    <input
                        id="password"
                        className="ms-input"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="New password"
                        required
                    />
                </div>

                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="confirmPassword">Confirm password</label>
                    <input
                        id="confirmPassword"
                        className="ms-input"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        required
                    />
                </div>

                <Button type="submit" variant="primary" full disabled={loading || !token || Boolean(message)}>
                    {loading ? "Resetting..." : "Reset password"}
                </Button>
            </form>

            <p className="ms-auth__alt">
                <Link className="ms-link" to="/login">Back to login</Link>
            </p>
        </AuthLayout>
    );
}
