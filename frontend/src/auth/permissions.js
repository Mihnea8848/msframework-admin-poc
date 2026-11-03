export function hasPermission(user, permission) {
    if (!permission) return true;
    return Boolean(user?.permissions?.includes(permission));
}

export function hasRole(user, roleName) {
    return Boolean(user?.roles?.includes(roleName));
}

/** The single role shown for a user (users have exactly one role). */
export function primaryRole(user) {
    const roles = user?.roles || [];
    for (const name of ["ADMIN", "MANAGER", "MEMBER", "VIEWER"]) {
        if (roles.includes(name)) return name;
    }
    return roles[0] || "—";
}

export const ROLES = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"];
export const STATUSES = ["Active", "Inactive"];
