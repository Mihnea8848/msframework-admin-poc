import { useCallback, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

export interface TipState {
    /** Centre of the anchor, in px from the frame's left edge. */
    x: number;
    /** Top of the anchor, in px from the frame's top edge. */
    y: number;
    content: ReactNode;
}

/**
 * The hover and focus tooltip of a chart. Put `frameRef` on a positioned element around the
 * chart, call `showFor(element, content)` from pointer and focus handlers, and render
 * `<ChartTip tip={tip} />` inside the frame. Tooltips only repeat what the chart's labels or its
 * hidden table already say, so they are aria-hidden.
 */
export function useChartTip<T extends HTMLElement = HTMLDivElement>(): {
    frameRef: RefObject<T | null>;
    tip: TipState | null;
    showFor: (anchor: Element, content: ReactNode) => void;
    showAt: (x: number, y: number, content: ReactNode) => void;
    hide: () => void;
} {
    const frameRef = useRef<T | null>(null);
    const [tip, setTip] = useState<TipState | null>(null);

    const showAt = useCallback((x: number, y: number, content: ReactNode) => setTip({ x, y, content }), []);

    const showFor = useCallback((anchor: Element, content: ReactNode) => {
        const frame = frameRef.current;
        if (!frame) return;
        const f = frame.getBoundingClientRect();
        const a = anchor.getBoundingClientRect();
        setTip({ x: a.left - f.left + a.width / 2, y: a.top - f.top, content });
    }, []);

    const hide = useCallback(() => setTip(null), []);

    return { frameRef, tip, showFor, showAt, hide };
}
