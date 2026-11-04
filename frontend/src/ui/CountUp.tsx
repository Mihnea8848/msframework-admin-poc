import { useLayoutEffect, useRef } from "react";

const COUNT_MS = 600;

function motionReduced(): boolean {
    return document.documentElement.dataset.motion === "reduced";
}

/**
 * A number that counts up from zero the first time it is shown (600ms, easing out), then shows
 * later values directly. It writes its own text on each animation frame, so the page does not
 * re-render while it counts. Instant under reduced motion.
 */
export default function CountUp({ value, className }: { value: number; className?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const done = useRef(false);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const final = String(value);
        if (done.current || motionReduced() || value <= 0) {
            done.current = true;
            el.textContent = final;
            return undefined;
        }
        let frame = 0;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / COUNT_MS);
            el.textContent = String(Math.round(value * (1 - (1 - t) ** 3)));
            if (t < 1) frame = requestAnimationFrame(tick);
            else done.current = true;
        };
        el.textContent = "0";
        frame = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(frame);
            el.textContent = final;
        };
    }, [value]);

    // The text is written by the effect above, never by React, so the two never disagree.
    return <span ref={ref} className={className} />;
}
