import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function RequireAuth({ children }) {
    const { user, loading } = useAuth();

    if (loading) return <div style={{ padding: 24, color: "var(--muted)" }}>Loading…</div>;
    if (!user) return <Navigate to="/login" replace />;

    return children;
}

export function RedirectIfAuthed({ children }) {
    const { user, loading } = useAuth();

    if (loading) return <div style={{ padding: 24, color: "var(--muted)" }}>Loading…</div>;

    if (user) return <Navigate to="/" replace />;

    return children;
}