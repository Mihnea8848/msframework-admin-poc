import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Dialog, { DialogBody } from "./Dialog";

describe("Dialog", () => {
    it("opens with the open attribute, focuses the first field and closes on Escape", () => {
        const onClose = vi.fn();
        render(
            <Dialog title="Edit user" onClose={onClose}>
                <DialogBody>
                    <label htmlFor="f">Name</label>
                    <input id="f" />
                </DialogBody>
            </Dialog>
        );
        const dialog = screen.getByRole("dialog", { name: "Edit user", hidden: true });
        expect(dialog).toHaveAttribute("open");
        expect(screen.getByLabelText("Name")).toHaveFocus();
        fireEvent.keyDown(dialog, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("ignores Escape and the close button while busy", () => {
        const onClose = vi.fn();
        render(<Dialog title="Delete user?" onClose={onClose} busy><p>Sure?</p></Dialog>);
        const dialog = screen.getByRole("dialog", { name: "Delete user?", hidden: true });
        fireEvent.keyDown(dialog, { key: "Escape" });
        fireEvent.click(screen.getByRole("button", { name: "Close", hidden: true }));
        expect(onClose).not.toHaveBeenCalled();
    });
});
