/**
 * Wording for the 429 answers of the sign-in, register and password-reset endpoints. The
 * backend sends the wait in the Retry-After header (seconds); ApiError carries it as
 * `retryAfterSeconds`.
 */
import { ApiError } from "../api/client";

/** "45 seconds", "1 minute", "15 minutes", "2 hours". Partial minutes round up, like the backend. */
export function formatWait(seconds: number): string {
    const s = Math.max(1, Math.ceil(seconds));
    if (s < 60) return s === 1 ? "1 second" : `${s} seconds`;
    const minutes = Math.ceil(s / 60);
    if (minutes < 120) return minutes === 1 ? "1 minute" : `${minutes} minutes`;
    const hours = Math.ceil(minutes / 60);
    return `${hours} hours`;
}

/** "Try again in 15 minutes." */
export function formatRetryAfter(seconds: number): string {
    return `Try again in ${formatWait(seconds)}.`;
}

export type ThrottleKind = "locked" | "rate-limited";

export interface ThrottleNotice {
    kind: ThrottleKind;
    title: string;
    /** The server's own message, shown as-is. */
    message: string;
    /** "Try again in N minutes.", or null when the server sent no Retry-After. */
    retry: string | null;
}

/** A 429 as a notice for the form, or null for any other error. */
export function throttleNotice(err: unknown): ThrottleNotice | null {
    if (!(err instanceof ApiError) || err.status !== 429) return null;
    const locked = /locked/i.test(err.message);
    return {
        kind: locked ? "locked" : "rate-limited",
        title: locked ? "Account locked" : "Too many attempts",
        message: err.message,
        retry: err.retryAfterSeconds ? formatRetryAfter(err.retryAfterSeconds) : null,
    };
}

/** What went wrong with a sign-in: a plain error, a 429 notice, or "still waiting for approval". */
export type SignInProblem =
    | { kind: "error"; message: string }
    | { kind: "throttled"; notice: ThrottleNotice }
    | { kind: "pending"; message: string };

/** The access request is not approved yet (a 403 with AccessRequestService.PENDING_LOGIN_MESSAGE). */
const PENDING = /waiting for approval/i;

export function signInProblem(err: unknown): SignInProblem {
    const notice = throttleNotice(err);
    if (notice) return { kind: "throttled", notice };
    const message = (err instanceof Error && err.message) || "Sign-in failed. Please try again.";
    if (err instanceof ApiError && err.status === 403 && PENDING.test(message)) return { kind: "pending", message };
    return { kind: "error", message };
}
