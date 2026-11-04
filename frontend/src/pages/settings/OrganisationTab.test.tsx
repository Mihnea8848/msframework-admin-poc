import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import type { Mock } from "vitest";
import AuthProvider from "../../auth/AuthProvider";
import type { CurrentUserDto } from "../../api/types";
import { routes } from "../../app/routes";

const member: CurrentUserDto = {
    id: 3, fullName: "Mara Member", email: "mara@mehstudios.net", phone: null, status: "Active",
    departmentId: 1, departmentName: "Development", roles: ["MEMBER"], permissions: ["DASHBOARD_READ"],
};
const admin: CurrentUserDto = { ...member, id: 1, email: "admin@test.com", roles: ["ADMIN"], permissions: ["ORG_SETTINGS_MANAGE"] };

const SETTINGS = {
    companyName: "Multimedia Entertainment Hub",
    registrationEnabled: true,
    passwordMinLength: 8,
    sessionTimeoutMinutes: 30,
    defaultTimezone: "Europe/Bucharest",
};

let fetchMock: Mock<typeof fetch>;

function backend(me: CurrentUserDto) {
    fetchMock = vi.fn<typeof fetch>(async (input, init) => {
        const url = String(input);
        if (url.startsWith("/api/auth/me")) return new Response(JSON.stringify(me));
        if (url === "/api/auth/csrf") return new Response(null, { status: 204 });
        if (url === "/api/org/settings" && init?.method === "PUT") {
            return new Response(JSON.stringify({ ...SETTINGS, ...JSON.parse(String(init.body)) }));
        }
        if (url === "/api/org/settings") return new Response(JSON.stringify(SETTINGS));
        if (url.startsWith("/api/audit/me")) return new Response(JSON.stringify({ items: [], nextCursor: null }));
        if (url.startsWith("/api/settings/")) return new Response("");
        return new Response("[]");
    });
    vi.stubGlobal("fetch", fetchMock);
}

function start() {
    const router = createMemoryRouter(routes, { initialEntries: ["/settings/organisation"] });
    render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
}

beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("Settings > Organisation", () => {
    it("is read only without ORG_SETTINGS_MANAGE", async () => {
        backend(member);
        start();
        expect(await screen.findByLabelText("Company name", {}, { timeout: 4000 })).toBeDisabled();
        expect(screen.getByRole("switch", { name: "Registration open" })).toBeDisabled();
        expect(screen.getByText("Read only")).toBeInTheDocument();
        expect(screen.getByText(/30 minutes without activity/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    });

    it("validates, then saves only what changed", async () => {
        backend(admin);
        start();
        const user = userEvent.setup();
        const length = await screen.findByLabelText("Minimum password length", {}, { timeout: 4000 });
        await user.clear(length);
        await user.type(length, "70");
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        expect(await screen.findByText("A whole number from 8 to 64.")).toBeInTheDocument();
        expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);

        await user.clear(length);
        await user.type(length, "12");
        await user.click(screen.getByRole("switch", { name: "Registration open" }));
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true));
        const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
        expect(JSON.parse(String(put?.[1]?.body))).toEqual({ registrationEnabled: false, passwordMinLength: 12 });
        expect(await screen.findByText("Organisation settings saved.")).toBeInTheDocument();
    });

    it("picks a timezone from the searchable list", async () => {
        backend(admin);
        start();
        const user = userEvent.setup();
        const tz = await screen.findByRole("combobox", { name: "Default timezone" }, { timeout: 4000 });
        await user.click(tz);
        await user.type(tz, "tokyo");
        await user.keyboard("{Enter}");
        expect(tz).toHaveValue("Asia/Tokyo");
        await user.click(screen.getByRole("button", { name: "Save changes" }));
        await waitFor(() => {
            const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
            expect(JSON.parse(String(put?.[1]?.body ?? "{}"))).toEqual({ defaultTimezone: "Asia/Tokyo" });
        });
    });
});
