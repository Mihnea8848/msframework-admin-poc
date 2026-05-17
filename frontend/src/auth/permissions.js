export function hasPermission(user, permission) {
    return user?.permissions?.includes(permission);
}

export function hasRole(user, roleName) {
    return user?.roles?.includes(roleName);
}