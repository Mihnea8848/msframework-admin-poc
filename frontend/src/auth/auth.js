const API_BASE = "http://localhost:8080";

export async function fetchMe() {
    let res;
    try {
        res = await fetch(`${API_BASE}/api/auth/me`, {
            method: "GET",
            credentials: "include",
        });
    } catch {
        // Network/CORS failure
        throw new Error("Network/CORS error while calling /api/auth/me");
    }

    if (res.status === 401) return null;

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`fetchMe failed: ${res.status} ${text.slice(0, 120)}`);
    }

    return await res.json();
}