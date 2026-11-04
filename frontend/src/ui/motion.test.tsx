import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import CountUp from "./CountUp";
import { useReveal } from "./useReveal";

afterEach(() => {
    vi.useRealTimers();
    delete document.documentElement.dataset.motion;
});

describe("useReveal", () => {
    it("staggers items while the page first shows its data, capped at the ninth", () => {
        vi.useFakeTimers();
        const { result, rerender } = renderHook(({ ready }) => useReveal(ready), { initialProps: { ready: false } });
        expect(result.current(2, "ms-card")).toEqual({ className: "ms-card ms-reveal", style: { "--i": 2 } });
        expect(result.current(20).style).toEqual({ "--i": 8 });

        // Still on while loading, however long it takes.
        act(() => vi.advanceTimersByTime(5000));
        expect(result.current(0).className).toBe("ms-reveal");

        rerender({ ready: true });
        act(() => vi.advanceTimersByTime(700));
        expect(result.current(2, "ms-card")).toEqual({ className: "ms-card" });
    });
});

describe("CountUp", () => {
    it("counts up to the value on the first show, then shows new values directly", () => {
        let now = 0;
        const frames: FrameRequestCallback[] = [];
        vi.spyOn(performance, "now").mockImplementation(() => now);
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
        vi.stubGlobal("cancelAnimationFrame", () => {});
        const step = (ms: number) => {
            now += ms;
            const cb = frames.shift();
            act(() => cb?.(now));
        };

        const { rerender } = render(<CountUp value={40} className="n" />);
        const el = document.querySelector(".n");
        expect(el).toHaveTextContent("0");
        step(300);
        const mid = Number(el?.textContent);
        expect(mid).toBeGreaterThan(0);
        expect(mid).toBeLessThan(40);
        step(400);
        expect(el).toHaveTextContent("40");

        rerender(<CountUp value={41} className="n" />);
        expect(el).toHaveTextContent("41");
    });

    it("shows the value at once under reduced motion", () => {
        document.documentElement.dataset.motion = "reduced";
        render(<p data-testid="v"><CountUp value={12} /></p>);
        expect(screen.getByTestId("v")).toHaveTextContent("12");
    });
});
