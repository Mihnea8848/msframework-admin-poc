import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import type { Mock } from "vitest";
import AuthProvider from "../auth/AuthProvider";
import { setUnauthorizedHandler } from "../api/client";
import type { CurrentUserDto } from "../api/types";
import { routes } from "./routes";

const viewer: CurrentUserDto = {
    id: 7,
    fullName: "Vera Viewer",
    email: "vera@mehstudios.net",
    phone: null,
    status: "Active",
    departmentId: null,
    departmentName: null,
    roles: ["VIEWER"],
    permissions: ["DASHBOARD_READ", "DOCUMENTATION_READ"],
};

const auditor: CurrentUserDto = { ...viewer, id: 8, email: "aude@mehstudios.net", permissions: ["DASHBOARD_READ", "AUDIT_READ"] };

let fetchMock: Mock<typeof fetch>;

/** Stubs the backend: /api/auth/me answers with `me` (or 401), every other GET with []. */
function backend(me: CurrentUserDto | null) {
    fetchMock = vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.startsWith("/api/auth/me")) {
            return me ? new Response(JSON.stringify(me)) : new Response(JSON.stringify({ status: 401, message: "Not signed in" }), { status: 401 });
        }
        return new Response("[]");
    });
    vi.stubGlobal("fetch", fetchMock);
}

function start(path: string) {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
    return router;
}

async function settlesAt(router: ReturnType<typeof start>, pathname: string) {
    await waitFor(() => expect(router.state.location.pathname).toBe(pathname), { timeout: 4000 });
    await waitFor(() => expect(router.state.navigation.state).toBe("idle"));
}

beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    setUnauthorizedHandler(null);
});

describe("router guards", () => {
    it("sends a signed-out visitor of a shell page to /login and remembers where they were going", async () => {
        backend(null);
        const router = start("/users");
        await settlesAt(router, "/login");
        expect(router.state.location.state).toEqual({ from: "/users" });
        expect(document.querySelector("[data-shell]")).toBeNull();
    });

    it("sends a signed-in user without the page's permission home", async () => {
        backend(viewer);
        const router = start("/users");
        await settlesAt(router, "/");
        await waitFor(() => expect(document.querySelector("[data-shell]")).not.toBeNull());
    });

    it("lets a signed-in user open a page they may see, inside the shell", async () => {
        backend(viewer);
        const router = start("/docs");
        await settlesAt(router, "/docs");
        await waitFor(() => expect(document.querySelector("[data-shell]")).not.toBeNull());
    });

    it("sends a signed-in user away from /login and /register", async () => {
        backend(viewer);
        const router = start("/login");
        await settlesAt(router, "/");
        await act(() => router.navigate("/register"));
        await settlesAt(router, "/");
    });

    it("keeps /forgot-password open to signed-out visitors", async () => {
        backend(null);
        const router = start("/forgot-password");
        await settlesAt(router, "/forgot-password");
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(router.state.location.pathname).toBe("/forgot-password");
    });

    it("sends unknown paths home, which then asks a signed-out visitor to log in", async () => {
        backend(null);
        const router = start("/no-such-page");
        await settlesAt(router, "/login");
    });

    it("keeps the same shell mounted when navigating between pages", async () => {
        backend(viewer);
        const router = start("/");
        await waitFor(() => expect(document.querySelector(".ms-sidebar")).not.toBeNull());
        const sidebar = document.querySelector(".ms-sidebar");
        await act(() => router.navigate("/dashboard"));
        await settlesAt(router, "/dashboard");
        await act(() => router.navigate("/docs"));
        await settlesAt(router, "/docs");
        expect(document.querySelector(".ms-sidebar")).toBe(sidebar);
        expect(document.querySelector(".ms-sidebar [aria-current=page]")).toHaveAttribute("href", "/docs");
    });

    it("opens Settings on its first tab and keeps each tab at its own URL", async () => {
        backend(viewer);
        const router = start("/settings");
        await settlesAt(router, "/settings/account");
        await act(() => router.navigate("/settings/organisation"));
        await settlesAt(router, "/settings/organisation");
        await act(() => router.navigate("/settings/nope"));
        await settlesAt(router, "/settings/account");
    });

    it("moves between Settings tabs with the arrow keys", async () => {
        backend(viewer);
        const router = start("/settings/account");
        const account = await screen.findByRole("tab", { name: "Account" }, { timeout: 4000 });
        expect(account).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tab", { name: "Security" })).toHaveAttribute("tabindex", "-1");
        account.focus();
        await userEvent.keyboard("{ArrowRight}");
        await settlesAt(router, "/settings/security");
        expect(screen.getByRole("tab", { name: "Security" })).toHaveFocus();
        await userEvent.keyboard("{End}");
        await settlesAt(router, "/settings/organisation");
        await userEvent.keyboard("{ArrowRight}");
        await settlesAt(router, "/settings/account");
        expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Account");
    });

    it("opens Activity and Sessions for anyone signed in, and keeps the Audit log for AUDIT_READ", async () => {
        backend(viewer);
        const router = start("/activity");
        await settlesAt(router, "/activity");
        expect(await screen.findByRole("heading", { name: /Activity/ }, { timeout: 4000 })).toBeInTheDocument();
        await act(() => router.navigate("/sessions"));
        await settlesAt(router, "/sessions");
        expect(await screen.findByRole("heading", { name: "Your sessions" }, { timeout: 4000 })).toBeInTheDocument();
        await act(() => router.navigate("/audit"));
        await settlesAt(router, "/");
    });

    it("opens the Audit log with AUDIT_READ", async () => {
        backend(auditor);
        const router = start("/audit");
        await settlesAt(router, "/audit");
        expect(await screen.findByRole("heading", { name: /Audit log/ }, { timeout: 4000 })).toBeInTheDocument();
    });

    it("redirects the old paths to where their pages live now", async () => {
        backend(auditor);
        const router = start("/auth");
        await settlesAt(router, "/settings/account");
        await act(() => router.navigate("/appearance"));
        await settlesAt(router, "/settings/appearance");
        await act(() => router.navigate("/notifications"));
        await settlesAt(router, "/activity");
        await waitFor(() => expect(document.querySelector(".ms-sidebar [aria-current=page]")).toHaveAttribute("href", "/activity"));
    });
});

describe("business pages", () => {
    const member: CurrentUserDto = {
        ...viewer, id: 9, email: "kenji@mehstudios.net", roles: ["MEMBER"], departmentId: 2, departmentName: "Development",
        permissions: ["DASHBOARD_READ", "USER_READ", "DEPARTMENT_READ", "EXPENSE_SUBMIT", "GOALS_READ"],
    };
    const reportViewer: CurrentUserDto = { ...viewer, id: 10, permissions: ["DASHBOARD_READ", "REPORTS_READ", "GOALS_READ"] };

    it("lets a member open Goals", async () => {
        backend(member);
        await settlesAt(start("/goals"), "/goals");
    });

    it("lets a member open Expenses (EXPENSE_SUBMIT is one of its permissions)", async () => {
        backend(member);
        await settlesAt(start("/expenses"), "/expenses");
    });

    it.each(["/budgets", "/payments", "/reports"])("sends a member away from %s", async (path) => {
        backend(member);
        await settlesAt(start(path), "/");
    });

    it("lets a viewer read Reports", async () => {
        backend(reportViewer);
        await settlesAt(start("/reports"), "/reports");
    });

    it("sends a viewer away from Expenses", async () => {
        backend(reportViewer);
        await settlesAt(start("/expenses"), "/");
    });
});
