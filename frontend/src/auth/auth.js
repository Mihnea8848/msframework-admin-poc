export async function fetchMe() {
    let res;
    try {
        res = await fetch("/api/auth/me", {
            method: "GET",
            credentials: "include",
        });
    } catch {
        // Network/CORS failure
        throw new Error("Network/CORS error while calling /api/auth/me");
    }

    if (res.status === 401 || res.status === 403) return null;

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`fetchMe failed: ${res.status} ${text.slice(0, 120)}`);
    }

    return await res.json();
}