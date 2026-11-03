import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SiApple, SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";
import { TriangleAlert } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import AuthLayout from "./AuthLayout";

type LoginState = { notice?: string; from?: string } | null;

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();

    const { login, sessionExpired } = useAuth();
    const state = location.state as LoginState;
    const notice = state?.notice;
    const from = state?.from;

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (loading) return;

        setLoading(true);
        setError(null);

        try {
            await login(email.trim(), password);
            navigate(from && from !== "/login" ? from : "/", { replace: true });
        } catch (err) {
            setError((err instanceof Error && err.message) || "Sign-in failed. Please try again.");
            setLoading(false);
        }
    }

    return (
        <AuthLayout trace>
            <h1 className="ms-auth__title">Sign in</h1>
            <p className="ms-auth__lead">Use your studio account to manage users, departments and settings.</p>

            <form className="ms-auth__form" onSubmit={onSubmit}>
                {notice && !error && <Alert tone="ok" role="status">{notice}</Alert>}
                {sessionExpired && !notice && !error && (
                    <Alert tone="info" role="status">Your session ended. Please sign in again.</Alert>
                )}

                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="email">Email</label>
                    <input
                        id="email"
                        className="ms-input"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@mehstudios.net"
                        aria-invalid={error ? true : undefined}
                        required
                    />
                </div>

                <div className="ms-field">
                    <div className="ms-field__row">
                        <label className="ms-field__label" htmlFor="password">Password</label>
                        <Link className="ms-link" to="/forgot-password">Forgot password?</Link>
                    </div>
                    <input
                        id="password"
                        className="ms-input"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? "login-error" : undefined}
                        required
                    />
                    {error && (
                        <p className="ms-field__error" id="login-error" role="alert">
                            <TriangleAlert aria-hidden="true" />
                            <span>{error}</span>
                        </p>
                    )}
                </div>

                <Button type="submit" variant="primary" full disabled={loading}>
                    {loading ? "Signing in..." : "Sign in"}
                </Button>
            </form>

            <div className="ms-auth__or" aria-hidden="true">or</div>
            <div className="ms-auth__sso" title="Single sign-on is not available yet">
                <Button full disabled aria-label="Sign in with Apple (coming soon)" icon={<SiApple aria-hidden="true" />}>
                    Apple
                </Button>
                <Button full disabled aria-label="Sign in with Google (coming soon)" icon={<SiGoogle aria-hidden="true" />}>
                    Google
                </Button>
                <Button full disabled aria-label="Sign in with GitHub (coming soon)" icon={<SiGithub aria-hidden="true" />}>
                    GitHub
                </Button>
            </div>
            <p className="ms-auth__sso-note">
                <span className="ms-tag">Coming soon</span>
                <span>Single sign-on is coming soon.</span>
            </p>

            <p className="ms-auth__alt">
                Don’t have an account yet? <Link className="ms-link" to="/register">Sign up</Link>
            </p>
        </AuthLayout>
    );
}
