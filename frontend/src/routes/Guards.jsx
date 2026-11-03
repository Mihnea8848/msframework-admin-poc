import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";

function FullPageLoading() {
    return <div style={{ padding: 24, color: "var(--muted)" }}>Loading…</div>;
}

export function RequireAuth({ children }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <FullPageLoading />;
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

    return children;
}

export function RedirectIfAuthed({ children }) {
    const { user, loading } = useAuth();

    if (loading) return <FullPageLoading />;
    if (user) return <Navigate to="/" replace />;

    return children;
}

export function RequirePermission({ permission, children }) {
    const { user, loading } = useAuth();

    if (loading) return <FullPageLoading />;
    if (!user) return <Navigate to="/login" replace />;
    if (!hasPermission(user, permission)) return <Navigate to="/" replace />;

    return children;
}
