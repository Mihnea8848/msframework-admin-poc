import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import AuthLayout from "./AuthLayout";

// Two pages that use the layout the way the real auth pages do: each renders its own AuthLayout,
// and the router swaps them as separate elements.
function PageA() {
    return (
        <AuthLayout trace>
            <h1>Page A</h1>
            <Link to="/b">To B</Link>
        </AuthLayout>
    );
}

function PageB() {
    return (
        <AuthLayout>
            <h1>Page B</h1>
            <Link to="/a">To A</Link>
        </AuthLayout>
    );
}

function renderPages() {
    return render(
        <MemoryRouter initialEntries={["/a"]}>
            <Routes>
                <Route path="/a" element={<PageA />} />
                <Route path="/b" element={<PageB />} />
            </Routes>
        </MemoryRouter>,
    );
}

const artNodes = () => document.querySelectorAll(".ms-auth__art");

describe("AuthLayout", () => {
    it("renders the art once, hidden from assistive tech, with the audit notice", async () => {
        renderPages();
        expect(await screen.findByRole("heading", { name: "Page A" })).toBeInTheDocument();
        expect(artNodes()).toHaveLength(1);
        expect(document.querySelectorAll(".ms-logo-art")).toHaveLength(1);
        expect(artNodes()[0]).toHaveAttribute("aria-hidden", "true");
        expect(screen.getByText("Protected system. Every sign-in is recorded in the audit log.")).toBeInTheDocument();
        expect(screen.getByText("Multimedia Entertainment Hub")).toBeInTheDocument();
    });

    it("keeps the same art node across auth pages and animates only the panel content", async () => {
        const user = userEvent.setup();
        renderPages();
        await screen.findByRole("heading", { name: "Page A" });
        const art = artNodes()[0];
        expect(art).toBeDefined();

        await user.click(screen.getByRole("link", { name: "To B" }));
        expect(await screen.findByRole("heading", { name: "Page B" })).toBeInTheDocument();
        expect(artNodes()).toHaveLength(1);
        expect(artNodes()[0]).toBe(art);
        expect(art?.isConnected).toBe(true);

        // An auth page was shown before, so the new panel content enters with the fade and rise.
        const content = screen.getByRole("heading", { name: "Page B" }).parentElement;
        expect(content).toHaveClass("ms-auth__content", "ms-auth__content--enter");
        // The trace is for the first Login only; it does not replay.
        expect(screen.getByTestId("auth-panel")).not.toHaveClass("ms-auth__panel--tracing");

        await user.click(screen.getByRole("link", { name: "To A" }));
        expect(await screen.findByRole("heading", { name: "Page A" })).toBeInTheDocument();
        expect(artNodes()[0]).toBe(art);
        expect(screen.getByTestId("auth-panel")).not.toHaveClass("ms-auth__panel--tracing");
    });
});
