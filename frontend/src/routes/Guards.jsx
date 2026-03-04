import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

export function RequireAuth({ children }) {
    const { me, loading } = useAuth();
    if (loading) return <div style={{ padding: 24, color: "var(--muted)" }}>Loading…</div>;
    if (!me) return <Navigate to="/login" replace />;
    return children;
}

export function RedirectIfAuthed({ children }) {
    const { me, loading } = useAuth();
    if (loading) return <div style={{ padding: 24, color: "var(--muted)" }}>Loading…</div>;
    if (me) return <Navigate to="/" replace />;
    return children;
}