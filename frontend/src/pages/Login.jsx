import { useState } from "react";
import { SiGithub, SiGoogle, SiApple } from "@icons-pack/react-simple-icons";
import { Link } from "react-router-dom";
import logo from "../assets/ms_logo.png";
import WavyBackground from "../ui/WavyBackground.jsx";

const API_BASE = "http://localhost:8080";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // error = { type: "auth" | "network", message: string }

    async function onSubmit(e) {
        e.preventDefault();
        if (loading) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email, password }),
            });

            if (res.status === 401) {
                setError({
                    type: "auth",
                    message: "Invalid email or password.",
                });
                return;
            }

            if (!res.ok) {
                setError({
                    type: "auth",
                    message: "Login failed. Please try again.",
                });
                return;
            }

            // success
            window.location.href = "/dashboard";
            // later we’ll use navigate() + refresh() from AuthContext

        } catch {
            setError({
                type: "network",
                message: "Unable to contact server. Please try again later.",
            });
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

                    <h1 className="auth-title">Welcome Back</h1>

                    <div className="auth-subtitle">
                        Don’t have an account yet?{" "}
                        <Link className="auth-link" to="/register">
                            Sign up
                        </Link>
                    </div>

                    <form className="auth-form" onSubmit={onSubmit}>
                        {error && (
                            <div className="login-error show">
                                {error.message}
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
                        </div>

                        <button
                            className="auth-primary gradient-hover-btn"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Signing in..." : "Login"}
                        </button>

                        <div className="auth-divider">
                            <span>OR</span>
                        </div>

                        <div className="auth-social">
                            <button type="button" className="auth-social-btn">
                                <SiApple size={16} />
                            </button>
                            <button type="button" className="auth-social-btn">
                                <SiGoogle size={16} />
                            </button>
                            <button type="button" className="auth-social-btn">
                                <SiGithub size={16} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}