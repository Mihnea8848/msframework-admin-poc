import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import OfficialSeal from "./OfficialSeal";
import { SEALS } from "./seals";

describe("OfficialSeal", () => {
    it("draws every seal, hidden from assistive tech, with its title and the company line", () => {
        const { container } = render(
            <>
                {SEALS.map((s) => <OfficialSeal key={s.key} seal={s.key} title={s.official} />)}
            </>,
        );
        const svgs = container.querySelectorAll("svg.ms-official-seal");
        expect(svgs).toHaveLength(SEALS.length);
        svgs.forEach((svg, i) => {
            const seal = SEALS[i];
            expect(svg).toHaveAttribute("aria-hidden", "true");
            expect(svg).toHaveAttribute("data-seal", seal?.key);
            expect(svg.textContent).toContain(seal?.official.toUpperCase());
            expect(svg.textContent).toContain("MEH STUDIOS INCORPORATED");
            // The emblem is drawn after the text: the seal is more than its rings.
            expect(svg.lastElementChild?.tagName.toLowerCase()).toBe("g");
        });
    });

    it("gives each seal its own ids, so several on one page do not share text paths", () => {
        const { container } = render(
            <>
                <OfficialSeal seal="development" title="Department of Development" />
                <OfficialSeal seal="development" title="Department of Development" />
            </>,
        );
        const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
        expect(new Set(ids).size).toBe(ids.length);
        const refs = [...container.querySelectorAll("textPath")].map((el) => el.getAttribute("href"));
        refs.forEach((ref) => expect(ids).toContain(ref?.slice(1)));
    });

    it("shrinks a long title to fit the ring", () => {
        const { container } = render(<OfficialSeal seal="engineering-innovation" title="Department of Engineering & Innovation" />);
        const title = container.querySelector(".ms-official-seal__title");
        expect(Number(title?.getAttribute("font-size"))).toBeLessThan(52);
    });
});
