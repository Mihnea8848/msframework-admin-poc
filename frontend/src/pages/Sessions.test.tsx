import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import type { Mock } from "vitest";
import AuthProvider from "../auth/AuthProvider";
import type { CurrentUserDto } from "../api/types";
import type { SessionDto } from "../api/security";
import { routes } from "../app/routes";

const CHROME_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

const member: CurrentUserDto = {
    id: 3,
    fullName: "Mara Member",
    email: "mara@mehstudios.net",
    phone: null,
    status: "Active",
    departmentId: 1,
    departmentName: "Development",
    roles: ["MEMBER"],
    permissions: ["DASHBOARD_READ", "USER_READ"],
};

const admin: CurrentUserDto = { ...member, id: 1, email: "admin@test.com", roles: ["ADMIN"], permissions: ["SESSIONS_MANAGE", "USER_READ"] };

const SESSIONS: SessionDto[] = [
    { id: "here", createdAt: "2026-11-04T08:00:00Z", lastActiveAt: "2026-11-04T09:00:00Z", expiresAt: "2026-11-04T09:30:00Z", ipAddress: "10.0.0.5", userAgent: CHROME_WINDOWS, current: true },
    { id: "phone", createdAt: "2026-11-03T08:00:00Z", lastActiveAt: "2026-11-03T18:00:00Z", expiresAt: "2026-11-03T18:30:00Z", ipAddress: "10.0.0.9", userAgent: SAFARI_IPHONE, current: false },
];

let fetchMock: Mock<typeof fetch>;
let signedIn: CurrentUserDto | null;

function backend(me: CurrentUserDto) {
    signedIn = me;
    fetchMock = vi.fn<typeof fetch>(async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.startsWith("/api/auth/me")) return new Response(signedIn ? JSON.stringify(signedIn) : "");
        if (url === "/api/auth/csrf") return new Response(null, { status: 204 });
        if (url === "/api/auth/registration") return new Response(JSON.stringify({ open: true, passwordMinLength: 8 }));
        if (url === "/api/sessions/me" && method === "GET") return new Response(JSON.stringify(SESSIONS));
        if (url === "/api/sessions/me/here" && method === "DELETE") {
            signedIn = null;
            return new Response(null, { status: 204 });
        }
        if (url.startsWith("/api/sessions") && method === "DELETE") return new Response(null, { status: 204 });
        if (url.startsWith("/api/users/search")) return new Response(JSON.stringify({ items: [{ ...member, createdAt: null }], total: 1 }));
        if (url.startsWith("/api/sessions?userId=")) return new Response(JSON.stringify([{ ...SESSIONS[1], current: false }]));
        if (url.startsWith("/api/audit/me")) return new Response(JSON.stringify({ items: [], nextCursor: null }));
        return new Response("[]");
    });
    vi.stubGlobal("fetch", fetchMock);
}

function start(path = "/sessions") {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
    return router;
}

const deletes = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE").map(([url]) => String(url));

beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("Sessions", () => {
    it("lists your sessions with the device, IP and a This device badge", async () => {
        backend(member);
        start();
        const list = await screen.findByRole("heading", { name: "Your sessions" }, { timeout: 4000 });
        expect(list).toBeInTheDocument();
        expect(await screen.findByText("Chrome on Windows")).toBeInTheDocument();
        expect(screen.getByText("Safari on iPhone")).toBeInTheDocument();
        expect(screen.getByText("This device")).toBeInTheDocument();
        expect(screen.getByText("10.0.0.9")).toBeInTheDocument();
        // A member does not get the admin panel.
        expect(screen.queryByRole("heading", { name: "Sessions by user" })).toBeNull();
    });

    it("signs out another session straight away", async () => {
        backend(member);
        start();
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: "Sign out Safari on iPhone" }, { timeout: 4000 }));
        await waitFor(() => expect(deletes()).toEqual(["/api/sessions/me/phone"]));
        expect(await screen.findByText("Signed out Safari on iPhone.")).toBeInTheDocument();
    });

    it("asks before signing out this device, then lands on the sign-in page", async () => {
        backend(member);
        const router = start();
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: "Sign out Chrome on Windows (this device)" }, { timeout: 4000 }));
        const dialog = await screen.findByRole("dialog", { name: "Sign out of this device?" });
        expect(deletes()).toEqual([]);
        await user.click(within(dialog).getByRole("button", { name: "Sign out" }));
        await waitFor(() => expect(router.state.location.pathname).toBe("/login"), { timeout: 4000 });
        expect(deletes()).toEqual(["/api/sessions/me/here"]);
    });

    it("signs out all other sessions after a confirmation", async () => {
        backend(member);
        start();
        const user = userEvent.setup();
        await user.click(await screen.findByRole("button", { name: "Sign out all other sessions" }, { timeout: 4000 }));
        const dialog = await screen.findByRole("dialog", { name: "Sign out all other sessions?" });
        await user.click(within(dialog).getByRole("button", { name: "Sign out others" }));
        await waitFor(() => expect(deletes()).toEqual(["/api/sessions/me/others"]));
    });

    it("lets an admin find a user and sign them out everywhere", async () => {
        backend(admin);
        start();
        const user = userEvent.setup();
        await user.type(await screen.findByLabelText("Find a user", {}, { timeout: 4000 }), "mara");
        await user.click(await screen.findByRole("button", { name: /Mara Member/ }));
        expect(await screen.findByText(/1 session/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Sign out everywhere" }));
        const dialog = await screen.findByRole("dialog", { name: "Sign Mara Member out everywhere?" });
        await user.click(within(dialog).getByRole("button", { name: "Sign out everywhere" }));
        await waitFor(() => expect(deletes()).toEqual(["/api/sessions/user/3"]));
        expect(await screen.findByText("Signed Mara Member out everywhere.")).toBeInTheDocument();
    });
});
