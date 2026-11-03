/**
 * Single entry point for talking to the backend.
 *
 * - Always sends the session cookie.
 * - Parses JSON responses (empty bodies become null).
 * - Throws ApiError with the backend's human-readable message on failure.
 * - Reports 401s on authenticated calls to the AuthProvider, which sends the user to the login page.
 */

export class ApiError extends Error {
    constructor(status, message, data) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

let unauthorizedHandler = null;

/** Registered by AuthProvider. Called when an authenticated request gets a 401. */
export function setUnauthorizedHandler(handler) {
    unauthorizedHandler = handler;
}

function messageFor(status, data) {
    if (data && typeof data === "object" && typeof data.message === "string") return data.message;
    if (typeof data === "string" && data.trim() && !data.trim().startsWith("<")) return data.trim();
    if (status === 502 || status === 503 || status === 504) {
        return "The backend is not reachable. Is it running on port 8080?";
    }
    if (status === 500 && !data) return "The backend is not reachable or failed unexpectedly.";
    return `Request failed (${status})`;
}

/**
 * @param {string} path      e.g. "/api/users"
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {any}    [options.body]          serialized as JSON
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.authRedirect]  set false for login-type calls where 401 is a normal answer
 */
export async function api(path, { method = "GET", body, signal, authRedirect = true } = {}) {
    const init = { method, credentials: "include", signal, headers: {} };
    if (body !== undefined) {
        init.headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(path, init);
    } catch (err) {
        if (err?.name === "AbortError") throw err;
        throw new ApiError(0, "Unable to reach the server. Check that the backend is running.");
    }

    let text = "";
    try {
        text = await res.text();
    } catch (err) {
        if (err?.name === "AbortError") throw err;
        throw new ApiError(0, "The connection to the server was interrupted.");
    }
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!res.ok) {
        if (res.status === 401 && authRedirect && unauthorizedHandler) {
            unauthorizedHandler();
        }
        throw new ApiError(res.status, messageFor(res.status, data), data);
    }
    return data;
}

export const get = (path, options) => api(path, { ...options, method: "GET" });
export const post = (path, body, options) => api(path, { ...options, method: "POST", body });
export const put = (path, body, options) => api(path, { ...options, method: "PUT", body });
export const patch = (path, body, options) => api(path, { ...options, method: "PATCH", body });
export const del = (path, options) => api(path, { ...options, method: "DELETE" });
