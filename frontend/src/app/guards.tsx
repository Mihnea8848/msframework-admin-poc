import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { hasAllPermissions, hasPermission } from "../auth/permissions";
import type { Permission } from "../api/types";
import "./guards.css";

/**
 * Shown only while the first /api/auth/me call is in flight. On a real page load the splash in
 * index.html covers it; it matters in tests and if the splash was already removed.
 */
function FullPageLoading() {
    return <div className="ms-loading" role="status">Loading…</div>;
}

type Children = { children: ReactNode };

/** Signed-in users only; everyone else goes to /login, which sends them back afterwards. */
export function RequireAuth({ children }: Children) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <FullPageLoading />;
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

    return children;
}

/** Login and register: a signed-in user is sent home instead. */
export function RedirectIfAuthed({ children }: Children) {
    const { user, loading } = useAuth();

    if (loading) return <FullPageLoading />;
    if (user) return <Navigate to="/" replace />;

    return children;
}

/**
 * A page that needs a permission: `permission` is one permission or a list meaning any of them,
 * `allOf` a list that must all be held. Without them the user is sent home.
 */
export function RequirePermission({ permission, allOf, children }: Children & {
    permission?: Permission | readonly Permission[] | null;
    allOf?: readonly Permission[];
}) {
    const { user, loading } = useAuth();

    if (loading) return <FullPageLoading />;
    if (!user) return <Navigate to="/login" replace />;
    if (!hasPermission(user, permission) || !hasAllPermissions(user, allOf)) return <Navigate to="/" replace />;

    return children;
}
