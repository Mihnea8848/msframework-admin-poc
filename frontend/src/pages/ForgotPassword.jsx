import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/ms_logo.png";
import WavyBackground from "../ui/WavyBackground.jsx";
import { useAuth } from "../auth/AuthProvider";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const { forgotPassword } = useAuth();

    async function onSubmit(e) {
        e.preventDefault();
        if (loading) return;

        setLoading(true);
        setMessage(null);
        setError(null);

        try {
            await forgotPassword(email);

            setMessage("If an account exists with this email, a password reset link was sent.");
        } catch (err) {
            console.error(err);
            setError("Could not send password reset email. Please try again.");
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

                    <h1 className="auth-title">Forgot Password</h1>

                    <div className="auth-subtitle">
                        Enter your email and we’ll send you a reset link.
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
                            <label className="auth-label" htmlFor="email">
                                Email address
                            </label>
                            <input
                                id="email"
                                className="auth-input"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email address"
                                required
                            />
                        </div>

                        <button
                            className="auth-primary gradient-hover-btn"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Sending..." : "Send reset link"}
                        </button>

                        <div className="auth-subtitle">
                            Remember your password?{" "}
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