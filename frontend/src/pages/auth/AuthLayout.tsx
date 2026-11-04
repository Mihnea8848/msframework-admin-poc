import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Shield } from "lucide-react";
import LogoArt from "../../ui/brand/LogoArt";
import { LOGO_LOWER_PATH, LOGO_UPPER_PATH } from "../../ui/brand/Logo";
import "../../ui/surface.css";
import "../../ui/field.css";
import "./auth-layout.css";

/** How long the logo trace on the first Login plays (matches --duration-trace). */
const TRACE_MS = 900;

/**
 * State shared by every auth page for the lifetime of the tab:
 * - authShown: an auth page has been shown before, so the next one is a navigation between
 *   auth pages and its panel content fades in;
 * - traced: the logo trace has played (it plays once, on the first Login).
 */
const session = { authShown: false, traced: false };

/**
 * The art lives in its own small React root, created once and moved between auth pages. The
 * router renders each auth page as a separate element, so a layout rendered by the pages would
 * remount the art on every navigation; this keeps the same DOM node (with its rasterised filters
 * and running animations) on screen instead.
 */
let artHost: HTMLDivElement | null = null;

function acquireArtHost(): HTMLDivElement {
    if (!artHost) {
        artHost = document.createElement("div");
        artHost.className = "ms-auth__art";
        artHost.setAttribute("aria-hidden", "true");
        createRoot(artHost).render(<LogoArt />);
    }
    return artHost;
}

function motionReduced(): boolean {
    return document.documentElement.dataset.motion === "reduced";
}

/** Holds the shared art while this layout is on screen. */
function ArtSlot() {
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const slot = ref.current;
        if (!slot) return;
        const host = acquireArtHost();
        slot.appendChild(host);
        return () => {
            if (host.parentNode === slot) slot.removeChild(host);
        };
    }, []);
    return <div ref={ref} className="ms-auth__art-slot" />;
}

/** The mark in the panel's brand block, with the stroke paths the trace animation draws. */
function BrandMark() {
    return (
        <svg className="ms-auth__mark" viewBox="0 0 694 1000" aria-hidden="true" focusable="false">
            <g className="ms-auth__mark-fill">
                <path className="ms-auth__mark-upper" d={LOGO_UPPER_PATH} />
                <path className="ms-auth__mark-lower" d={LOGO_LOWER_PATH} />
            </g>
            <g className="ms-auth__mark-trace">
                <path pathLength={1} d={LOGO_UPPER_PATH} />
                <path pathLength={1} d={LOGO_LOWER_PATH} />
            </g>
        </svg>
    );
}

type TracePhase = "idle" | "tracing" | "traced";

type AuthLayoutProps = {
    children: ReactNode;
    /** Play the logo trace if it has not played yet in this tab (Login only). */
    trace?: boolean;
};

/**
 * The split layout shared by Login, Register, Forgot password and Reset password: the form panel
 * on the left, the night-sky tile art on the right (hidden on phones), and the audit
 * notice under the panel.
 *
 * Between auth pages only the panel content moves (a fade and a 6px rise); the art stays put.
 */
export default function AuthLayout({ children, trace = false }: AuthLayoutProps) {
    const [enter] = useState(() => session.authShown);
    const [phase, setPhase] = useState<TracePhase>(() =>
        trace && !session.traced && !motionReduced() ? "tracing" : "idle",
    );

    useEffect(() => {
        session.authShown = true;
    }, []);

    useEffect(() => {
        if (phase !== "tracing") return;
        session.traced = true;
        const timer = window.setTimeout(() => setPhase("traced"), TRACE_MS);
        return () => window.clearTimeout(timer);
    }, [phase]);

    const panelClass = ["ms-auth__panel", "ms-cut"];
    if (phase !== "idle") panelClass.push(`ms-auth__panel--${phase}`);

    return (
        <div className="ms-auth">
            <main className="ms-auth__main">
                <div className={panelClass.join(" ")} data-testid="auth-panel">
                    <div className="ms-auth__brand">
                        <BrandMark />
                        <div className="ms-auth__brand-text">
                            <p className="ms-auth__word">MSFramework</p>
                            <p className="ms-auth__sub">Multimedia Entertainment Hub</p>
                        </div>
                    </div>
                    <div className={enter ? "ms-auth__content ms-auth__content--enter" : "ms-auth__content"}>
                        {children}
                    </div>
                </div>
                <p className="ms-auth__foot">
                    <Shield aria-hidden="true" />
                    <span>Protected system. Every sign-in is recorded in the audit log.</span>
                </p>
            </main>
            <ArtSlot />
        </div>
    );
}
