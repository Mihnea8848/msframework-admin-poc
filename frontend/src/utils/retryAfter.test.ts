import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import { formatRetryAfter, formatWait, signInProblem, throttleNotice } from "./retryAfter";

describe("formatWait", () => {
    it.each([
        [0, "1 second"],
        [1, "1 second"],
        [45, "45 seconds"],
        [59, "59 seconds"],
        [60, "1 minute"],
        [61, "2 minutes"],
        [900, "15 minutes"],
        [899.2, "15 minutes"],
        [7140, "119 minutes"],
        [7200, "2 hours"],
        [3 * 3600 + 1, "4 hours"],
    ])("%s s reads as %s", (seconds, text) => {
        expect(formatWait(seconds)).toBe(text);
    });
});

describe("formatRetryAfter", () => {
    it("is a sentence", () => {
        expect(formatRetryAfter(900)).toBe("Try again in 15 minutes.");
    });
});

describe("throttleNotice", () => {
    it("names an account lock and keeps the server's message", () => {
        const err = new ApiError(429, "Too many failed sign-in attempts. This account is locked for 15 minutes.", null, 900);
        expect(throttleNotice(err)).toEqual({
            kind: "locked",
            title: "Account locked",
            message: "Too many failed sign-in attempts. This account is locked for 15 minutes.",
            retry: "Try again in 15 minutes.",
        });
    });

    it("names a rate limit, and leaves out the wait when the server sent none", () => {
        const notice = throttleNotice(new ApiError(429, "Too many sign-in attempts. Please wait 40 seconds and try again."));
        expect(notice?.kind).toBe("rate-limited");
        expect(notice?.title).toBe("Too many attempts");
        expect(notice?.retry).toBeNull();
    });

    it("ignores every other error", () => {
        expect(throttleNotice(new ApiError(401, "Invalid email or password"))).toBeNull();
        expect(throttleNotice(new Error("boom"))).toBeNull();
        expect(throttleNotice(null)).toBeNull();
    });
});

describe("signInProblem", () => {
    it("treats a request still waiting for approval as information, not an error", () => {
        const message = "Your access request is still waiting for approval. You can sign in once an administrator approves it.";
        expect(signInProblem(new ApiError(403, message))).toEqual({ kind: "pending", message });
    });

    it("keeps other 403s (an inactive account) as errors", () => {
        const message = "This account is inactive. Contact an administrator.";
        expect(signInProblem(new ApiError(403, message))).toEqual({ kind: "error", message });
    });

    it("turns a 429 into a throttle notice", () => {
        const problem = signInProblem(new ApiError(429, "Too many sign-in attempts. Please wait 1 minute and try again.", null, 42));
        expect(problem.kind).toBe("throttled");
        expect(problem.kind === "throttled" && problem.notice.retry).toBe("Try again in 42 seconds.");
    });

    it("has a fallback message", () => {
        expect(signInProblem(undefined)).toEqual({ kind: "error", message: "Sign-in failed. Please try again." });
    });
});
