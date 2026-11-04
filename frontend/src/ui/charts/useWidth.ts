import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * The rendered width of an element, kept up to date with a ResizeObserver, so an SVG chart can
 * draw in real pixels (round bar ends and dots stay round). `fallback` is used before the first
 * measurement and where ResizeObserver is missing (jsdom).
 */
export function useWidth<T extends HTMLElement>(fallback: number): [RefObject<T | null>, number] {
    const ref = useRef<T | null>(null);
    const [width, setWidth] = useState(fallback);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === "undefined") return undefined;
        const observer = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width;
            if (w && w > 0) setWidth(Math.floor(w));
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return [ref, width];
}
