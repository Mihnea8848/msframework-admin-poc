/**
 * Wrapper for fetch that handles global 401 (Unauthorized) responses.
 * If the session expires, it sends the user back to login automatically.
 */
async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        credentials: "include",
    });

    if (res.status === 401) {
        // Clear local state and force redirect on session expiry
        window.location.href = "/login?expired=true";
        return null;
    }

    return res;
}

export async function fetchMe() {
    const res = await apiFetch("/api/auth/me");

    if (!res || !res.ok) return null;

    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

export async function login(email, password) {
    const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!res || !res.ok) {
        throw new Error("Login failed");
    }

    return await res.json();
}

export async function forgotPassword(email) {
    const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });

    if (!res || !res.ok) {
        throw new Error("Forgot password failed");
    }

    return true;
}

export async function resetPassword(token, newPassword) {
    const res = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            token,
            newPassword,
        }),
    });

    if (!res || !res.ok) {
        throw new Error("Reset password failed");
    }

    return true;
}

export async function fetchUsers() {
    const res = await apiFetch("/api/users");

    if (!res || !res.ok) return [];

    return await res.json();
}