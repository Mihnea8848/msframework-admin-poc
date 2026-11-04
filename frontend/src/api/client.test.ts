import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { ApiError, api, del, get, patch, post, put, setUnauthorizedHandler } from "./client";
import type { ErrorResponse } from "./types";

let fetchMock: Mock<typeof fetch>;

function respond(body: string | null, status = 200): Response {
    return new Response(body, { status });
}

function json(value: unknown, status = 200): Response {
    return respond(JSON.stringify(value), status);
}

/** The `init` passed to the n-th fetch call. */
function initOf(call = 0): RequestInit {
    const init = fetchMock.mock.calls[call]?.[1];
    if (!init) throw new Error(`fetch call ${call} had no init`);
    return init;
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
    const err: unknown = await promise.then(
        () => {
            throw new Error("expected the request to fail");
        },
        (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    return err as ApiError;
}

function setCsrfCookie(value: string): void {
    document.cookie = `XSRF-TOKEN=${value}; path=/`;
}

function clearCsrfCookie(): void {
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
}

/** The URL of the n-th fetch call. */
function urlOf(call = 0): string {
    return String(fetchMock.mock.calls[call]?.[0]);
}

beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    setCsrfCookie("tok-1");
});

afterEach(() => {
    setUnauthorizedHandler(null);
    clearCsrfCookie();
});

describe("api", () => {
    it("parses a JSON body and sends the session cookie", async () => {
        fetchMock.mockResolvedValue(json([{ id: 1, name: "Sales" }]));

        const data = await get<{ id: number; name: string }[]>("/api/departments");

        expect(data).toEqual([{ id: 1, name: "Sales" }]);
        expect(fetchMock).toHaveBeenCalledWith("/api/departments", expect.objectContaining({
            method: "GET",
            credentials: "include",
        }));
        expect(initOf().body).toBeUndefined();
        expect(initOf().headers).toEqual({});
    });

    it("returns null for an empty body", async () => {
        fetchMock.mockResolvedValue(respond(null, 204));
        await expect(del("/api/users/1")).resolves.toBeNull();
    });

    it("returns plain text when the body is not JSON", async () => {
        fetchMock.mockResolvedValue(respond("pong"));
        await expect(api("/api/ping")).resolves.toBe("pong");
    });

    it.each([
        ["POST", post],
        ["PUT", put],
        ["PATCH", patch],
    ] as const)("%s serializes the body as JSON", async (method, call) => {
        fetchMock.mockResolvedValue(json({ ok: true }));

        await call("/api/x", { name: "Ștefan" });

        expect(initOf().method).toBe(method);
        expect(initOf().headers).toEqual({ "Content-Type": "application/json", "X-XSRF-TOKEN": "tok-1" });
        expect(initOf().body).toBe('{"name":"Ștefan"}');
    });

    it("passes the abort signal through", async () => {
        const controller = new AbortController();
        fetchMock.mockResolvedValue(json({}));
        await get("/api/x", { signal: controller.signal });
        expect(initOf().signal).toBe(controller.signal);
    });
});

describe("errors", () => {
    it("uses the message from an ErrorResponse body", async () => {
        const body: ErrorResponse = { status: 409, error: "Conflict", message: "That email is already registered." };
        fetchMock.mockResolvedValue(json(body, 409));

        const err = await rejection(post("/api/users", {}));

        expect(err.message).toBe("That email is already registered.");
        expect(err.status).toBe(409);
        expect(err.data).toEqual(body);
        expect(err.name).toBe("ApiError");
    });

    it("uses a plain-text body, but not an HTML error page", async () => {
        fetchMock.mockResolvedValueOnce(respond("  Bad thing happened  ", 400));
        expect((await rejection(get("/api/x"))).message).toBe("Bad thing happened");

        fetchMock.mockResolvedValueOnce(respond("<html>Bad Gateway</html>", 502));
        expect((await rejection(get("/api/x"))).message).toBe("The backend is not reachable. Is it running on port 8080?");
    });

    it("explains a 500 with no body and falls back to the status", async () => {
        fetchMock.mockResolvedValueOnce(respond(null, 500));
        expect((await rejection(get("/api/x"))).message).toBe("The backend is not reachable or failed unexpectedly.");

        fetchMock.mockResolvedValueOnce(json({ status: 418 }, 418));
        expect((await rejection(get("/api/x"))).message).toBe("Request failed (418)");
    });

    it("turns a network failure into ApiError status 0", async () => {
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

        const err = await rejection(get("/api/x"));

        expect(err.status).toBe(0);
        expect(err.message).toBe("Unable to reach the server. Check that the backend is running.");
    });

    it("turns an interrupted body read into ApiError status 0", async () => {
        const broken = {
            ok: true,
            status: 200,
            text: () => Promise.reject(new TypeError("terminated")),
        } as unknown as Response;
        fetchMock.mockResolvedValue(broken);

        const err = await rejection(get("/api/x"));

        expect(err.status).toBe(0);
        expect(err.message).toBe("The connection to the server was interrupted.");
    });

    it("rethrows aborts unchanged, from fetch and from the body read", async () => {
        const abort = new DOMException("The operation was aborted.", "AbortError");

        fetchMock.mockRejectedValueOnce(abort);
        await expect(get("/api/x")).rejects.toBe(abort);

        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.reject(abort) } as unknown as Response);
        await expect(get("/api/x")).rejects.toBe(abort);
    });
});

describe("401 handling", () => {
    it("calls the unauthorized handler on a 401 by default", async () => {
        const handler = vi.fn();
        setUnauthorizedHandler(handler);
        fetchMock.mockResolvedValue(json({ status: 401, error: "Unauthorized", message: "Please sign in." }, 401));

        const err = await rejection(get("/api/users"));

        expect(handler).toHaveBeenCalledOnce();
        expect(err.status).toBe(401);
        expect(err.message).toBe("Please sign in.");
    });

    it("does not call the handler when authRedirect is false", async () => {
        const handler = vi.fn();
        setUnauthorizedHandler(handler);
        fetchMock.mockResolvedValue(json({ message: "Invalid email or password." }, 401));

        const err = await rejection(post("/api/auth/login", {}, { authRedirect: false }));

        expect(handler).not.toHaveBeenCalled();
        expect(err.message).toBe("Invalid email or password.");
    });

    it("does not call the handler for other errors", async () => {
        const handler = vi.fn();
        setUnauthorizedHandler(handler);
        fetchMock.mockResolvedValue(json({ message: "No." }, 403));

        await rejection(get("/api/users"));

        expect(handler).not.toHaveBeenCalled();
    });

    it("does nothing when no handler is registered", async () => {
        fetchMock.mockResolvedValue(respond(null, 401));
        expect((await rejection(get("/api/users"))).status).toBe(401);
    });
});

describe("CSRF token", () => {
    const csrfError: ErrorResponse = {
        status: 403,
        error: "Forbidden",
        message: "Your security token (CSRF) is missing or out of date. Reload the page and try again.",
    };

    it("is sent on unsafe methods only", async () => {
        fetchMock.mockImplementation(() => Promise.resolve(respond(null, 204)));

        await get("/api/x");
        await del("/api/x/1");
        await patch("/api/x/1");

        expect(initOf(0).headers).toEqual({});
        expect(initOf(1).headers).toEqual({ "X-XSRF-TOKEN": "tok-1" });
        expect(initOf(2).headers).toEqual({ "X-XSRF-TOKEN": "tok-1" });
    });

    it("is fetched first when the cookie is missing", async () => {
        clearCsrfCookie();
        fetchMock.mockImplementation((input) => {
            if (String(input) === "/api/auth/csrf") {
                setCsrfCookie("fresh");
                return Promise.resolve(respond(null, 204));
            }
            return Promise.resolve(json({ ok: true }));
        });

        await post("/api/auth/login", { email: "a@b.c" });

        expect(urlOf(0)).toBe("/api/auth/csrf");
        expect(initOf(0)).toMatchObject({ method: "GET", credentials: "include" });
        expect(urlOf(1)).toBe("/api/auth/login");
        expect(initOf(1).headers).toEqual({ "Content-Type": "application/json", "X-XSRF-TOKEN": "fresh" });
    });

    it("is refreshed and the request retried once after a CSRF rejection", async () => {
        let calls = 0;
        fetchMock.mockImplementation((input) => {
            if (String(input) === "/api/auth/csrf") {
                setCsrfCookie("tok-2");
                return Promise.resolve(respond(null, 204));
            }
            calls += 1;
            return Promise.resolve(calls === 1 ? json(csrfError, 403) : json({ id: 7 }));
        });

        await expect(put("/api/x/7", { name: "n" })).resolves.toEqual({ id: 7 });

        expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(["/api/x/7", "/api/auth/csrf", "/api/x/7"]);
        expect(initOf(2).headers).toEqual({ "Content-Type": "application/json", "X-XSRF-TOKEN": "tok-2" });
        expect(initOf(2).body).toBe('{"name":"n"}');
    });

    it("is retried only once", async () => {
        fetchMock.mockImplementation((input) => Promise.resolve(
            String(input) === "/api/auth/csrf" ? respond(null, 204) : json(csrfError, 403),
        ));

        const err = await rejection(post("/api/x"));

        expect(err.status).toBe(403);
        expect(err.message).toBe(csrfError.message);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("does not retry other 403 answers", async () => {
        fetchMock.mockResolvedValue(json({ status: 403, error: "Forbidden", message: "Access denied" }, 403));

        await rejection(post("/api/x"));

        expect(fetchMock).toHaveBeenCalledOnce();
    });
});

describe("background requests", () => {
    it("are marked so they do not keep the session alive", async () => {
        fetchMock.mockImplementation(() => Promise.resolve(json([])));

        await get("/api/audit?limit=50", { background: true });
        await get("/api/audit?limit=50");

        expect(initOf(0).headers).toEqual({ "X-Background-Request": "1" });
        expect(initOf(1).headers).toEqual({});
    });
});
