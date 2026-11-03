import { api, get, post } from "../api/client.js";

export async function fetchMe() {
    return await get("/api/auth/me", { authRedirect: false });
}

export async function login(email, password) {
    return await post("/api/auth/login", { email, password }, { authRedirect: false });
}

export async function logout() {
    return await post("/api/auth/logout", undefined, { authRedirect: false });
}

export async function forgotPassword(email) {
    await post("/api/auth/forgot-password", { email }, { authRedirect: false });
    return true;
}

export async function resetPassword(token, newPassword) {
    await post("/api/auth/reset-password", { token, newPassword }, { authRedirect: false });
    return true;
}

export async function fetchUsers() {
    const data = await api("/api/users");
    return Array.isArray(data) ? data : [];
}
