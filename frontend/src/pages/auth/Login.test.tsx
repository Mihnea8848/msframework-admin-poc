import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AuthProvider from "../../auth/AuthProvider";
import Login from "./Login";

function json(status: number, body: unknown): Response {
    return new Response(body === null ? "" : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function renderLogin() {
    return render(
        <MemoryRouter initialEntries={["/login"]}>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<p>Home page</p>} />
                </Routes>
            </AuthProvider>
        </MemoryRouter>,
    );
}

describe("Login", () => {
    it("submits the trimmed email and the password, and shows the server's error", async () => {
        const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async (input) => {
            const url = String(input);
            if (url === "/api/auth/me") return json(200, null);
            if (url === "/api/auth/registration") return json(200, { open: true, passwordMinLength: 8 });
            if (url === "/api/auth/login") {
                return json(401, { status: 401, error: "Unauthorized", message: "Invalid email or password." });
            }
            throw new Error(`unexpected request ${url}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        const user = userEvent.setup();
        renderLogin();

        await user.type(screen.getByLabelText("Email"), "  admin@test.com ");
        await user.type(screen.getByLabelText("Password"), "wrong-password");
        await user.click(screen.getByRole("button", { name: "Sign in" }));

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Invalid email or password.");
        expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();

        const loginCall = fetchMock.mock.calls.find(([url]) => String(url) === "/api/auth/login");
        expect(loginCall).toBeDefined();
        const init = loginCall?.[1] as RequestInit | undefined;
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({ email: "admin@test.com", password: "wrong-password" });
    });

    it("goes to the home page after a successful sign-in", async () => {
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url === "/api/auth/me") return json(200, null);
            if (url === "/api/auth/registration") return json(200, { open: true, passwordMinLength: 8 });
            if (url === "/api/auth/login") {
                return json(200, { id: 1, fullName: "Admin", email: "admin@test.com", roles: ["ADMIN"], permissions: [] });
            }
            throw new Error(`unexpected request ${url}`);
        }));
        const user = userEvent.setup();
        renderLogin();

        await user.type(screen.getByLabelText("Email"), "admin@test.com");
        await user.type(screen.getByLabelText("Password"), "password123");
        await user.click(screen.getByRole("button", { name: "Sign in" }));

        expect(await screen.findByText("Home page")).toBeInTheDocument();
    });

    it("keeps single sign-on disabled and marked as coming soon", () => {
        vi.stubGlobal("fetch", vi.fn(async () => json(200, null)));
        renderLogin();
        for (const name of ["Apple", "Google", "GitHub"]) {
            expect(screen.getByRole("button", { name: `Sign in with ${name} (coming soon)` })).toBeDisabled();
        }
        expect(screen.getByText("Coming soon")).toBeInTheDocument();
    });

    it("offers Request access only while registration is open", async () => {
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
            String(input) === "/api/auth/registration" ? json(200, { open: false, passwordMinLength: 8 }) : json(200, null)));
        renderLogin();
        expect(await screen.findByText(/Ask an administrator to create your account/)).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Request access" })).toBeNull();
    });

    it("shows the link when registration is open", async () => {
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
            String(input) === "/api/auth/registration" ? json(200, { open: true, passwordMinLength: 8 }) : json(200, null)));
        renderLogin();
        expect(await screen.findByRole("link", { name: "Request access" })).toHaveAttribute("href", "/register");
    });

    it("explains a lockout with the wait from Retry-After", async () => {
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url === "/api/auth/login") {
                return new Response(JSON.stringify({
                    status: 429,
                    error: "Too Many Requests",
                    message: "Too many failed sign-in attempts. This account is locked for 15 minutes. Try again later or reset your password.",
                }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "900" } });
            }
            return json(200, url === "/api/auth/registration" ? { open: true, passwordMinLength: 8 } : null);
        }));
        const user = userEvent.setup();
        renderLogin();
        await user.type(screen.getByLabelText("Email"), "admin@test.com");
        await user.type(screen.getByLabelText("Password"), "wrong");
        await user.click(screen.getByRole("button", { name: "Sign in" }));

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Account locked");
        expect(alert).toHaveTextContent("This account is locked for 15 minutes");
        expect(alert).toHaveTextContent("Try again in 15 minutes.");
    });

    it("shows a request still waiting for approval as information", async () => {
        const message = "Your access request is still waiting for approval. You can sign in once an administrator approves it.";
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url === "/api/auth/login") return json(403, { status: 403, error: "Forbidden", message });
            return json(200, url === "/api/auth/registration" ? { open: true, passwordMinLength: 8 } : null);
        }));
        const user = userEvent.setup();
        renderLogin();
        await user.type(screen.getByLabelText("Email"), "new@mehstudios.net");
        await user.type(screen.getByLabelText("Password"), "Secret#123");
        await user.click(screen.getByRole("button", { name: "Sign in" }));

        expect(await screen.findByRole("status")).toHaveTextContent(message);
        expect(screen.queryByRole("alert")).toBeNull();
    });
});
