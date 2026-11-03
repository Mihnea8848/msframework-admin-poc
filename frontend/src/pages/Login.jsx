import { useState } from "react";
import { SiGithub, SiGoogle, SiApple } from "@icons-pack/react-simple-icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "../ui/brand/Logo";
import { useAuth } from "../auth/AuthProvider";

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();

    const { login, sessionExpired } = useAuth();
    const notice = location.state?.notice;
    const from = location.state?.from;

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    async function onSubmit(e) {
        e.preventDefault();
        if (loading) return;

        setLoading(true);
        setError(null);

        try {
            await login(email.trim(), password);
            navigate(from && from !== "/login" ? from : "/", { replace: true });
        } catch (err) {
            setError(err.message || "Sign-in failed. Please try again.");
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

                    <h1 className="auth-title">Welcome Back</h1>

                    <div className="auth-subtitle">
                        Don’t have an account yet?{" "}
                        <Link className="auth-link" to="/register">
                            Sign up
                        </Link>
                    </div>

                    <form className="auth-form" onSubmit={onSubmit}>
                        {notice && !error && <div className="login-success">{notice}</div>}
                        {sessionExpired && !notice && !error && (
                            <div className="login-notice">Your session ended. Please sign in again.</div>
                        )}
                        {error && <div className="login-error show" role="alert">{error}</div>}

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

                        <div className="auth-field">
                            <label className="auth-label" htmlFor="password">
                                Password
                            </label>
                            <input
                                id="password"
                                className="auth-input"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                required
                            />

                            <div className="auth-forgot-row">
                                <Link className="auth-link auth-forgot-link" to="/forgot-password">
                                    Forgot password?
                                </Link>
                            </div>
                        </div>

                        <button
                            className="auth-primary"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Signing in..." : "Login"}
                        </button>

                        <div className="auth-divider">
                            <span>OR</span>
                        </div>

                        <div className="auth-social" title="Single sign-on is not available yet">
                            <button type="button" className="auth-social-btn" disabled aria-label="Sign in with Apple (coming soon)">
                                <SiApple size={16} />
                            </button>
                            <button type="button" className="auth-social-btn" disabled aria-label="Sign in with Google (coming soon)">
                                <SiGoogle size={16} />
                            </button>
                            <button type="button" className="auth-social-btn" disabled aria-label="Sign in with GitHub (coming soon)">
                                <SiGithub size={16} />
                            </button>
                        </div>
                        <div className="muted-note" style={{ textAlign: "center", marginTop: 8 }}>
                            Single sign-on is coming soon.
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}