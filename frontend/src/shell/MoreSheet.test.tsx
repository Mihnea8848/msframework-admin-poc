import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import MoreSheet from "./MoreSheet";
import { PAGES, morePages } from "../routes/navigation";

const admin = { roles: ["ADMIN"], permissions: [...new Set(PAGES.flatMap((p) => (p.permission === null ? [] : typeof p.permission === "string" ? [p.permission] : [...p.permission])))] };

/** The sheet with its trigger, the way AppShell wires them. */
function Harness({ onLogout = () => {} }: { onLogout?: () => void }) {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    return (
        <>
            <button ref={trigger} type="button" onClick={() => setOpen(true)}>More</button>
            <MoreSheet
                open={open}
                onClose={() => setOpen(false)}
                pages={morePages(admin)}
                pathname="/database"
                badge="4"
                onLogout={onLogout}
                returnFocusRef={trigger}
            />
        </>
    );
}

function renderSheet(onLogout?: () => void) {
    render(<MemoryRouter><Harness onLogout={onLogout} /></MemoryRouter>);
    return screen.getByRole("button", { name: "More" });
}

// jsdom has no showModal(), so these run the fallback (open attribute plus its own focus trap).
// The dialog is found by tag: Testing Library treats a closed <dialog> as hidden.
const dialog = () => document.querySelector("dialog") as HTMLDialogElement;

describe("MoreSheet", () => {
    it("opens with focus inside and lists the other pages, grouped", async () => {
        const trigger = renderSheet();
        expect(dialog()).not.toHaveAttribute("open");

        await userEvent.click(trigger);
        expect(dialog()).toHaveAttribute("open");
        expect(dialog()).toHaveAccessibleName("More");
        expect(dialog()).toContainElement(document.activeElement as HTMLElement);

        const sheet = within(dialog());
        expect(sheet.getByRole("region", { name: "Operations" })).toBeInTheDocument();
        expect(sheet.getByRole("link", { name: "Database" })).toHaveAttribute("aria-current", "page");
        expect(sheet.getByRole("link", { name: "Activity, 4 unread" })).toBeInTheDocument();
        expect(sheet.queryByRole("link", { name: "Dashboard" })).toBeNull();
        expect(sheet.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    });

    it("closes with Escape and returns focus to the trigger", async () => {
        const trigger = renderSheet();
        await userEvent.click(trigger);
        await userEvent.keyboard("{Escape}");
        expect(dialog()).not.toHaveAttribute("open");
        expect(trigger).toHaveFocus();
    });

    it("closes on a backdrop click and with the close button", async () => {
        const trigger = renderSheet();
        await userEvent.click(trigger);
        fireEvent.click(dialog());
        expect(dialog()).not.toHaveAttribute("open");

        await userEvent.click(trigger);
        await userEvent.click(within(dialog()).getByRole("button", { name: "Close" }));
        expect(dialog()).not.toHaveAttribute("open");
        expect(trigger).toHaveFocus();
    });

    it("keeps Tab inside the sheet", async () => {
        const trigger = renderSheet();
        await userEvent.click(trigger);
        const logout = within(dialog()).getByRole("button", { name: "Log out" });
        logout.focus();
        await userEvent.tab();
        expect(within(dialog()).getByRole("button", { name: "Close" })).toHaveFocus();
        await userEvent.tab({ shift: true });
        expect(logout).toHaveFocus();
    });

    it("closes when a page is chosen, and logs out", async () => {
        const onLogout = vi.fn();
        const trigger = renderSheet(onLogout);
        await userEvent.click(trigger);
        await userEvent.click(within(dialog()).getByRole("link", { name: "Database" }));
        expect(dialog()).not.toHaveAttribute("open");

        await userEvent.click(trigger);
        await userEvent.click(within(dialog()).getByRole("button", { name: "Log out" }));
        expect(dialog()).not.toHaveAttribute("open");
        expect(onLogout).toHaveBeenCalledOnce();
    });
});
