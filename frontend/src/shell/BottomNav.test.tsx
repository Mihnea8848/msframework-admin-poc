import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import BottomNav from "./BottomNav";
import { PAGES, mobileTabs, morePages } from "../routes/navigation";

const admin = { roles: ["ADMIN"], permissions: [...new Set(PAGES.map((p) => p.permission).filter((p) => p !== null))] };

function renderNav(pathname: string, badge: string | null = null, onOpenMore = vi.fn()) {
    render(
        <MemoryRouter initialEntries={[pathname]}>
            <BottomNav
                tabs={mobileTabs(admin)}
                more={morePages(admin)}
                pathname={pathname}
                badge={badge}
                moreOpen={false}
                onOpenMore={onOpenMore}
            />
        </MemoryRouter>,
    );
    return { nav: screen.getByRole("navigation", { name: "Main" }), onOpenMore };
}

describe("BottomNav", () => {
    it("renders the four permitted tabs and a More button", () => {
        const { nav } = renderNav("/");
        const links = within(nav).getAllByRole("link");
        expect(links.map((a) => a.getAttribute("href"))).toEqual(["/", "/dashboard", "/users", "/departments"]);
        expect(links.map((a) => a.textContent)).toEqual(["Home", "Dashboard", "Users", "Departments"]);
        const more = within(nav).getByRole("button", { name: /More/ });
        expect(more).toHaveAttribute("aria-haspopup", "dialog");
        expect(more).toHaveAttribute("aria-expanded", "false");
    });

    it("marks the current tab", () => {
        const { nav } = renderNav("/users");
        expect(within(nav).getByRole("link", { name: "Users" })).toHaveAttribute("aria-current", "page");
        expect(within(nav).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    });

    it("marks More when the current page is in the sheet, and announces unread notifications", () => {
        const { nav } = renderNav("/notifications", "3");
        const more = within(nav).getByRole("button", { name: /More/ });
        expect(more).toHaveAttribute("data-current", "true");
        expect(more).toHaveAccessibleName("More, unread notifications");
    });

    it("opens the More sheet", async () => {
        const { nav, onOpenMore } = renderNav("/");
        await userEvent.click(within(nav).getByRole("button", { name: /More/ }));
        expect(onOpenMore).toHaveBeenCalledOnce();
    });
});
