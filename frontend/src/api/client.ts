/**
 * Single entry point for talking to the backend.
 *
 * - Always sends the session cookie.
 * - Sends the CSRF token (the XSRF-TOKEN cookie, echoed in the X-XSRF-TOKEN header) on POST, PUT,
 *   PATCH and DELETE. Without the cookie it asks GET /api/auth/csrf for one first, and a 403 that
 *   blames the CSRF token is retried once with a fresh token.
 * - Marks polls with X-Background-Request: 1 (`background: true`), so they do not keep an idle
 *   session alive.
 * - Parses JSON responses (empty bodies become null).
 * - Throws ApiError with the backend's human-readable message on failure.
 * - Reports 401s on authenticated calls to the AuthProvider, which sends the user to the login page.
 */

export class ApiError extends Error {
    /** HTTP status, or 0 when the server could not be reached. */
    readonly status: number;
    /** The parsed response body (usually an ErrorResponse), if there was one. */
    readonly data: unknown;

    constructor(status: number, message: string, data?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiOptions {
    method?: HttpMethod;
    /** Serialized as JSON. */
    body?: unknown;
    signal?: AbortSignal;
    /** Set false for login-type calls where 401 is a normal answer. */
    authRedirect?: boolean;
    /**
     * Set true for requests the app makes on its own (polls, auto-refresh). The backend then does
     * not count them as activity, so an idle session still times out.
     */
    background?: boolean;
}

export const CSRF_COOKIE = "XSRF-TOKEN";
export const CSRF_HEADER = "X-XSRF-TOKEN";
export const BACKGROUND_HEADER = "X-Background-Request";

const UNSAFE_METHODS: ReadonlySet<HttpMethod> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** The value of a cookie readable by scripts, or null. */
function readCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    for (const part of document.cookie.split(";")) {
        const eq = part.indexOf("=");
        if (eq < 0) continue;
        if (part.slice(0, eq).trim() === name) {
            const value = part.slice(eq + 1).trim();
            try {
                return decodeURIComponent(value) || null;
            } catch {
                return value || null;
            }
        }
    }
    return null;
}

let csrfPriming: Promise<void> | null = null;

/** Asks the backend to set the XSRF-TOKEN cookie. Concurrent callers share one request. */
function primeCsrfToken(): Promise<void> {
    csrfPriming ??= fetch("/api/auth/csrf", { method: "GET", credentials: "include" })
        .then(() => undefined, () => undefined)
        .finally(() => {
            csrfPriming = null;
        });
    return csrfPriming;
}

function isCsrfRejection(status: number, data: unknown): boolean {
    return status === 403 && /csrf/i.test(messageFor(status, data));
}

/** Options for the method helpers, which set `method` (and `body`) themselves. */
export type RequestOptions = Omit<ApiOptions, "method" | "body">;

let unauthorizedHandler: (() => void) | null = null;

/** Registered by AuthProvider. Called when an authenticated request gets a 401. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
    unauthorizedHandler = handler;
}

function isAbortError(err: unknown): boolean {
    // DOMException is not an Error subclass in every runtime, so check the name only.
    return typeof err === "object" && err !== null && "name" in err && err.name === "AbortError";
}

function messageFor(status: number, data: unknown): string {
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
        return data.message;
    }
    if (typeof data === "string" && data.trim() && !data.trim().startsWith("<")) return data.trim();
    if (status === 502 || status === 503 || status === 504) {
        return "The backend is not reachable. Is it running on port 8080?";
    }
    if (status === 500 && !data) return "The backend is not reachable or failed unexpectedly.";
    return `Request failed (${status})`;
}

/**
 * Calls the backend and resolves with the parsed body. `T` is the expected response type;
 * it is not checked at run time, so pick it from `api/types.ts`.
 *
 * @param path e.g. "/api/users"
 */
export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
    return request<T>(path, options, false);
}

async function request<T>(
    path: string,
    { method = "GET", body, signal, authRedirect = true, background = false }: ApiOptions,
    isRetry: boolean,
): Promise<T> {
    const unsafe = UNSAFE_METHODS.has(method);
    const headers: Record<string, string> = {};
    const init: RequestInit = { method, credentials: "include", headers };
    if (signal) init.signal = signal;
    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
    }
    if (background) headers[BACKGROUND_HEADER] = "1";
    if (unsafe) {
        if (!readCookie(CSRF_COOKIE)) await primeCsrfToken();
        const token = readCookie(CSRF_COOKIE);
        if (token) headers[CSRF_HEADER] = token;
    }

    let res: Response;
    try {
        res = await fetch(path, init);
    } catch (err) {
        if (isAbortError(err)) throw err;
        throw new ApiError(0, "Unable to reach the server. Check that the backend is running.");
    }

    let text = "";
    try {
        text = await res.text();
    } catch (err) {
        if (isAbortError(err)) throw err;
        throw new ApiError(0, "The connection to the server was interrupted.");
    }
    let data: unknown = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!res.ok) {
        if (unsafe && !isRetry && isCsrfRejection(res.status, data)) {
            // The token was missing or stale (for example after signing in elsewhere): get a fresh one.
            await primeCsrfToken();
            return request<T>(path, { method, body, signal, authRedirect, background }, true);
        }
        if (res.status === 401 && authRedirect && unauthorizedHandler) {
            unauthorizedHandler();
        }
        throw new ApiError(res.status, messageFor(res.status, data), data);
    }
    return data as T;
}

export const get = <T = unknown>(path: string, options?: RequestOptions): Promise<T> =>
    api<T>(path, { ...options, method: "GET" });
export const post = <T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    api<T>(path, { ...options, method: "POST", body });
export const put = <T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    api<T>(path, { ...options, method: "PUT", body });
export const patch = <T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    api<T>(path, { ...options, method: "PATCH", body });
export const del = <T = unknown>(path: string, options?: RequestOptions): Promise<T> =>
    api<T>(path, { ...options, method: "DELETE" });
