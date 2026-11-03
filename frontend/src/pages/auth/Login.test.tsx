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
});
