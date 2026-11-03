import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PageHeader from "./PageHeader";

describe("PageHeader", () => {
    it("renders eyebrow, title, description, actions and the stripe", () => {
        render(
            <PageHeader
                eyebrow="General"
                title="Dashboard"
                description="Is everything working?"
                actions={<button type="button">Refresh status</button>}
            />,
        );
        expect(screen.getByText("General")).toHaveClass("ms-page-header__eyebrow");
        expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
        expect(screen.getByText("Is everything working?")).toHaveClass("ms-page-header__desc");
        expect(screen.getByRole("button", { name: "Refresh status" })).toBeInTheDocument();
        expect(screen.getByTestId("page-header-stripe")).toHaveAttribute("aria-hidden", "true");
    });

    it("keeps the older props working: breadcrumb, subtitle and count", () => {
        render(<PageHeader breadcrumb="Ventures / User management" title="User management" count={12} subtitle="All accounts." />);
        expect(screen.getByText("Ventures")).toHaveClass("ms-page-header__eyebrow");
        expect(screen.queryByText("Ventures / User management")).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("User management, 12");
        expect(screen.getByText("All accounts.")).toBeInTheDocument();
    });

    it("prefers eyebrow and description over breadcrumb and subtitle", () => {
        render(<PageHeader eyebrow="General" breadcrumb="Ventures / X" title="X" description="New" subtitle="Old" />);
        expect(screen.getByText("General")).toBeInTheDocument();
        expect(screen.queryByText("Ventures")).not.toBeInTheDocument();
        expect(screen.getByText("New")).toBeInTheDocument();
        expect(screen.queryByText("Old")).not.toBeInTheDocument();
    });

    it("renders nothing for empty optional props and can hide the stripe", () => {
        const { container } = render(<PageHeader title="Timezones" subtitle={null} count={null} actions={false} stripe={false} />);
        expect(container.querySelector(".ms-page-header__eyebrow")).toBeNull();
        expect(container.querySelector(".ms-page-header__desc")).toBeNull();
        expect(container.querySelector(".ms-page-header__count")).toBeNull();
        expect(container.querySelector(".ms-page-header__actions")).toBeNull();
        expect(screen.queryByTestId("page-header-stripe")).toBeNull();
    });

    it("shows a count of 0", () => {
        render(<PageHeader title="Departments" count={0} />);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Departments, 0");
    });
});
