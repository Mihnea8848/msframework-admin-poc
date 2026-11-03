import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../ui/brand/Logo";
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
            await forgotPassword(email.trim());

            setMessage("If an active account exists for this email, a reset link valid for 30 minutes has been issued. (Development setup: the link is printed in the backend console.)");
        } catch (err) {
            setError(err.message || "Could not request a password reset. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-bg">
            <div className="auth-circuit">
                <div className="auth-card">
                    <div className="auth-brand">
                        <Logo className="auth-logo" />
                        <div>
                            <div className="auth-brand-name">MSFramework</div>
                            <div className="auth-brand-sub">Multimedia Entertainment Hub</div>
                        </div>
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
                                placeholder="name@mehstudios.net"
                                required
                            />
                        </div>

                        <button
                            className="auth-primary"
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