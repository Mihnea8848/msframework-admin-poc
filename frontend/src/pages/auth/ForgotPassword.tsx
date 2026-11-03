import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import AuthLayout from "./AuthLayout";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { forgotPassword } = useAuth();

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (loading) return;

        setLoading(true);
        setMessage(null);
        setError(null);

        try {
            await forgotPassword(email.trim());

            setMessage("If an active account exists for this email, a reset link valid for 30 minutes has been issued. (Development setup: the link is printed in the backend console.)");
        } catch (err) {
            setError((err instanceof Error && err.message) || "Could not request a password reset. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthLayout>
            <h1 className="ms-auth__title">Forgot password</h1>
            <p className="ms-auth__lead">Enter your email and we’ll send you a reset link.</p>

            <form className="ms-auth__form" onSubmit={onSubmit}>
                {message && <Alert tone="ok" role="status">{message}</Alert>}
                {error && <Alert tone="danger" role="alert">{error}</Alert>}

                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="email">Email address</label>
                    <input
                        id="email"
                        className="ms-input"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@mehstudios.net"
                        required
                    />
                </div>

                <Button type="submit" variant="primary" full disabled={loading}>
                    {loading ? "Sending..." : "Send reset link"}
                </Button>
            </form>

            <p className="ms-auth__alt">
                Remember your password? <Link className="ms-link" to="/login">Back to login</Link>
            </p>
        </AuthLayout>
    );
}
