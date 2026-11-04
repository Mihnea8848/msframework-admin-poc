import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import "./motion.css";

/** How long the reveal stays on after the first data is shown: the stagger cap plus the duration. */
const REVEAL_WINDOW_MS = 700;

/** Items after this one come in together, with the last delay. */
const STAGGER_CAP = 8;

type RevealProps = { className: string; style?: CSSProperties };

/**
 * The staggered reveal of a page's cards or rows when it first shows its data. Spread
 * `reveal(i, className)` on each item: items fade in and rise 6px, 35ms apart, and from the
 * ninth on they come in together. After that window it returns the plain class, so refreshed or
 * added items appear without the animation.
 *
 * Pass `ready` once the first data is on screen. Instant under reduced motion (base/reset.css).
 */
export function useReveal(ready: boolean): (index: number, className?: string) => RevealProps {
    const [active, setActive] = useState(true);

    useEffect(() => {
        if (!ready || !active) return undefined;
        const timer = window.setTimeout(() => setActive(false), REVEAL_WINDOW_MS);
        return () => window.clearTimeout(timer);
    }, [ready, active]);

    return useCallback(
        (index: number, className = "") =>
            active
                ? {
                    className: className ? `${className} ms-reveal` : "ms-reveal",
                    style: { "--i": Math.min(index, STAGGER_CAP) } as CSSProperties,
                }
                : { className },
        [active],
    );
}
