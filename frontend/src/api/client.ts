/**
 * Single entry point for talking to the backend.
 *
 * - Always sends the session cookie.
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
export async function api<T = unknown>(
    path: string,
    { method = "GET", body, signal, authRedirect = true }: ApiOptions = {},
): Promise<T> {
    const headers: Record<string, string> = {};
    const init: RequestInit = { method, credentials: "include", headers };
    if (signal) init.signal = signal;
    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
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
