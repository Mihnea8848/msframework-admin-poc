export async function fetchMe() {
    let res;
    try {
        res = await fetch("/api/auth/me", {
            method: "GET",
            credentials: "include",
        });
    } catch {
        throw new Error("Network error while calling /api/auth/me");
    }

    if (res.status === 401 || res.status === 403) return null;

    // Check if the response is empty before parsing
    const text = await res.text();
    if (!text) return null;

    if (!res.ok) {
        throw new Error(`fetchMe failed: ${res.status} ${text.slice(0, 120)}`);
    }

    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("JSON Parse Error on fetchMe:", e);
        return null;
    }
}

export async function login(email, password) {
    const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
    });

    if (!res.ok) {
        throw new Error("Login failed");
    }
    return await res.json();
}

export async function fetchUsers() {
    let res;
    try {
        res = await fetch("/api/users", {
            method: "GET",
            credentials: "include",
        });
    } catch {
        throw new Error("Network error while calling /api/users");
    }

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`fetchUsers failed: ${res.status} ${text.slice(0, 120)}`);
    }

    return await res.json();
}