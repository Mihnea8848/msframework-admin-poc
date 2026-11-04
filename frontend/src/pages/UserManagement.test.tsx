import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import type { Mock } from "vitest";
import AuthProvider from "../auth/AuthProvider";
import type { CurrentUserDto, UserDto } from "../api/types";
import type { UserPage } from "../api/people";
import UserManagement from "./UserManagement";

const admin: CurrentUserDto = {
    id: 1, fullName: "Ada Admin", email: "ada@mehstudios.net", phone: null, status: "Active",
    departmentId: null, departmentName: null, roles: ["ADMIN"],
    permissions: ["USER_READ", "USER_CREATE", "USER_UPDATE", "USER_DELETE", "DEPARTMENT_READ"],
};

const person = (id: number, fullName: string): UserDto => ({
    id, fullName, email: `${fullName.split(" ")[0]!.toLowerCase()}@mehstudios.net`, phone: null, status: "Active",
    departmentId: null, departmentName: null, roles: ["MEMBER"], createdAt: null, title: "Producer", lastLoginAt: null,
});

let fetchMock: Mock<typeof fetch>;
let bulkBody: unknown = null;

function backend() {
    document.cookie = "XSRF-TOKEN=test";
    fetchMock = vi.fn<typeof fetch>(async (input, init) => {
        const url = String(input);
        if (url.startsWith("/api/auth/me")) return new Response(JSON.stringify(admin));
        if (url.startsWith("/api/users/search")) {
            const page: UserPage = { items: [person(2, "Ana Pop"), person(3, "Ion Ene")], page: 0, size: 25, total: 2, totalPages: 1 };
            return new Response(JSON.stringify(page));
        }
        if (url.startsWith("/api/users/bulk")) {
            bulkBody = JSON.parse(String(init?.body));
            return new Response(JSON.stringify({
                succeeded: 1, failed: 1,
                results: [
                    { id: 2, ok: true, error: null, user: null },
                    { id: 3, ok: false, error: "At least one active admin must remain", user: null },
                ],
            }));
        }
        return new Response("[]");
    });
    vi.stubGlobal("fetch", fetchMock);
}

function start(path: string) {
    const router = createMemoryRouter([{ path: "/users", element: <UserManagement /> }], { initialEntries: [path] });
    render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
    return router;
}

const searchCalls = () => fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith("/api/users/search"));

describe("UserManagement", () => {
    it("reads the filters from the URL and writes changes back to it", async () => {
        backend();
        const router = start("/users?role=MEMBER&page=2");
        await screen.findByRole("link", { name: "Ana Pop" });
        expect(searchCalls()[0]).toContain("role=MEMBER");
        expect(searchCalls()[0]).toContain("page=1");

        await userEvent.selectOptions(screen.getByLabelText("Status"), "Inactive");
        await waitFor(() => expect(router.state.location.search).toBe("?role=MEMBER&status=Inactive"));
        await waitFor(() => expect(searchCalls().at(-1)).toContain("status=Inactive&sort=name&page=0"));
    });

    it("debounces the search box into the URL", async () => {
        backend();
        const router = start("/users");
        await screen.findByRole("link", { name: "Ana Pop" });
        await userEvent.type(screen.getByLabelText("Search users"), "ana");
        await waitFor(() => expect(router.state.location.search).toBe("?q=ana"), { timeout: 2000 });
        expect(searchCalls().filter((u) => u.includes("q=a&") || u.includes("q=an&"))).toHaveLength(0);
    });

    it("runs a bulk action on the selection and lists each failure", async () => {
        backend();
        start("/users");
        await screen.findByRole("link", { name: "Ana Pop" });
        await userEvent.click(screen.getByLabelText("Select all users on this page"));
        expect(screen.getByRole("region", { name: "Bulk actions" })).toHaveTextContent("2 selected");

        await userEvent.click(screen.getByRole("button", { name: "Activate" }));
        await screen.findByText("Activated 1 user; 1 could not be changed.");
        expect(bulkBody).toEqual({ action: "ACTIVATE", ids: [2, 3] });
        expect(screen.getByText(/At least one active admin must remain/)).toBeInTheDocument();
        // The user that failed stays selected, so the action can be retried.
        expect(screen.getByRole("region", { name: "Bulk actions" })).toHaveTextContent("1 selected");
    });
});
