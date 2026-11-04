import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import QuickActions from "./QuickActions";
import { PAGES } from "../routes/navigation";

const admin = { roles: ["ADMIN"], permissions: [...new Set(PAGES.map((p) => p.permission).filter((p) => p !== null))] };

vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: admin }) }));

function Location() {
    return <p data-testid="path">{useLocation().pathname}</p>;
}

/** The palette with a trigger, the way AppShell opens it. */
function Harness() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>Open palette</button>
            <QuickActions open={open} onClose={() => setOpen(false)} />
            <Location />
        </>
    );
}

function renderPalette() {
    render(<MemoryRouter initialEntries={["/"]}><Harness /></MemoryRouter>);
    return screen.getByRole("button", { name: "Open palette" });
}

// jsdom has no showModal(), so this runs the open-attribute fallback.
const dialog = () => document.querySelector("dialog");

describe("QuickActions", () => {
    it("renders nothing while closed", () => {
        renderPalette();
        expect(dialog()).toBeNull();
    });

    it("focuses the search box and lists every permitted page", async () => {
        await userEvent.click(renderPalette());
        expect(dialog()).toHaveAttribute("open");
        expect(dialog()).toHaveAccessibleName("Quick actions");
        const input = screen.getByRole("combobox", { name: "Search pages" });
        expect(input).toHaveFocus();
        expect(within(dialog() as HTMLElement).getAllByRole("option")).toHaveLength(PAGES.length);
        expect(screen.getByRole("option", { name: /Home/ })).toHaveAttribute("aria-selected", "true");
    });

    it("filters, moves with the arrow keys and opens the selection with Enter", async () => {
        await userEvent.click(renderPalette());
        await userEvent.keyboard("data");
        const options = screen.getAllByRole("option");
        expect(options.map((o) => o.textContent)).toEqual([
            "Database/database",
            "Import data/import",
            "Export data/export",
        ]);
        await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}");
        const input = screen.getByRole("combobox");
        expect(screen.getByRole("option", { name: /Import data/ })).toHaveAttribute("aria-selected", "true");
        expect(input.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option", { name: /Import data/ }).id);
        await userEvent.keyboard("{Enter}");
        expect(screen.getByTestId("path")).toHaveTextContent("/import");
        expect(dialog()).toBeNull();
    });

    it("says when nothing matches and clears the query", async () => {
        await userEvent.click(renderPalette());
        await userEvent.keyboard("zzz");
        expect(screen.getByText("No pages match “zzz”")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Clear" }));
        expect(screen.getByRole("combobox")).toHaveValue("");
        expect(screen.getAllByRole("option")).toHaveLength(PAGES.length);
    });

    it("closes with Escape and returns focus to the trigger", async () => {
        const trigger = renderPalette();
        await userEvent.click(trigger);
        await userEvent.keyboard("{Escape}");
        expect(dialog()).toBeNull();
        expect(trigger).toHaveFocus();
    });

    it("opens a page on click", async () => {
        await userEvent.click(renderPalette());
        await userEvent.click(screen.getByRole("option", { name: /Timezones/ }));
        expect(screen.getByTestId("path")).toHaveTextContent("/timezones");
    });
});
