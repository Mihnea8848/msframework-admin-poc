import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";

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

export function RequirePermission({ permission, children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="workspace">
                <h1 style={{ padding: "40px" }}>Loading...</h1>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!hasPermission(user, permission)) {
        return <Navigate to="/" replace />;
    }

    return children;
}