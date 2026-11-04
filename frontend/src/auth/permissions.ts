import type { Permission, RoleName, UserStatus } from "../api/types";

/** The parts of a user that permission checks read. Accepts CurrentUserDto, UserDto or null. */
export interface UserLike {
    roles?: readonly string[] | null;
    permissions?: readonly string[] | null;
}

type MaybeUser = UserLike | null | undefined;

/**
 * True when the user has the permission. A list means any one of them (a page several
 * permissions may open, such as Expenses); null or undefined means no permission is needed.
 */
export function hasPermission(user: MaybeUser, permission: Permission | readonly Permission[] | null | undefined): boolean {
    if (!permission) return true;
    if (typeof permission !== "string") return permission.some((p) => Boolean(user?.permissions?.includes(p)));
    return Boolean(user?.permissions?.includes(permission));
}

/** Whether the user has every one of the permissions (a single one, a list, or none). */
export function hasAllPermissions(user: MaybeUser, permissions: Permission | readonly Permission[] | null | undefined): boolean {
    if (!permissions) return true;
    if (typeof permissions === "string") return hasPermission(user, permissions);
    return permissions.every((p) => hasPermission(user, p));
}

export function hasRole(user: MaybeUser, roleName: RoleName): boolean {
    return Boolean(user?.roles?.includes(roleName));
}

export const ROLES: readonly RoleName[] = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"];
export const STATUSES: readonly UserStatus[] = ["Active", "Inactive"];

/** The single role shown for a user (users have exactly one role). */
export function primaryRole(user: MaybeUser): string {
    const roles = user?.roles || [];
    for (const name of ROLES) {
        if (roles.includes(name)) return name;
    }
    return roles[0] || "—";
}
