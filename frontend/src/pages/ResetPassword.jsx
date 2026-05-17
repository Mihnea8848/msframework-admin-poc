import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import logo from "../assets/ms_logo.png";
import WavyBackground from "../ui/WavyBackground.jsx";
import { useAuth } from "../auth/AuthProvider";

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const { resetPassword } = useAuth();

    async function onSubmit(e) {
        e.preventDefault();
        if (loading) return;

        setMessage(null);
        setError(null);

        if (!token) {
            setError("Invalid or missing reset token.");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 6 characters long.");
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
                navigate("/login");
            }, 1500);
        } catch (err) {
            console.error(err);
            setError("Could not reset password. The link may be invalid or expired.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-bg">
            <div className="auth-circuit">
                <WavyBackground colorA="#28beef" colorB="#2487cb" />

                <div className="auth-card">
                    <div className="auth-brand">
                        <img className="auth-logo" src={logo} alt="MSFramework" />
                    </div>

                    <h1 className="auth-title">Reset Password</h1>

                    <div className="auth-subtitle">
                        Choose a new password for your account.
                    </div>

                    <form className="auth-form" onSubmit={onSubmit}>
                        {message && (
                            <div className="login-success show">
                                {message}
                            </div>
                        )}

                        {error && (
                            <div className="login-error show">
                                {error}
                            </div>
                        )}

                        <div className="auth-field">
                            <label className="auth-label" htmlFor="password">
                                New password
                            </label>
                            <input
                                id="password"
                                className="auth-input"
                                type="password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="New password"
                                required
                            />
                        </div>

                        <div className="auth-field">
                            <label className="auth-label" htmlFor="confirmPassword">
                                Confirm password
                            </label>
                            <input
                                id="confirmPassword"
                                className="auth-input"
                                type="password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm password"
                                required
                            />
                        </div>

                        <button
                            className="auth-primary gradient-hover-btn"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Resetting..." : "Reset password"}
                        </button>

                        <div className="auth-subtitle">
                            <Link className="auth-link" to="/login">
                                Back to login
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}