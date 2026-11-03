import { useId } from "react";
import { LOGO_LOWER_PATH, LOGO_UPPER_PATH } from "./Logo";
import "./logo-art.css";

/*
 * The mark sits in a 694 x 1000 box; the view box adds a small margin so the grain and the
 * anti-aliased edges are never cut.
 */
const PAD = 24;
const W = 694;
const H = 1000;

/**
 * The large decorative logo behind the sign-in pages: each half of the mark fades to transparent
 * through a brand gradient, the whole mark fades out toward the left (where the form is), and a
 * fine grain clipped to the mark breaks the fade up like film grain.
 *
 * Purely decorative: hidden from assistive tech. Colours come from --logo-upper and --logo-lower,
 * the grain blend and strength from --grain-blend and --grain-strength. Size it with CSS.
 */
export default function LogoArt({ className }: { className?: string }) {
    // useId can contain characters that are awkward inside url(#...): keep letters, digits, - and _.
    const base = `la${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const ids = {
        upper: `${base}-upper`,
        lower: `${base}-lower`,
        fade: `${base}-fade`,
        fadeGradient: `${base}-fade-g`,
        clip: `${base}-clip`,
        grain: `${base}-grain`,
    };
    const url = (id: string) => `url(#${id})`;

    return (
        <svg
            className={className ? `ms-logo-art ${className}` : "ms-logo-art"}
            viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            focusable="false"
        >
            <defs>
                <linearGradient id={ids.upper} x1="0" y1="0" x2="0.35" y2="1">
                    <stop offset="0" className="ms-logo-art__stop-upper" stopOpacity="0.95" />
                    <stop offset="0.55" className="ms-logo-art__stop-upper" stopOpacity="0.5" />
                    <stop offset="1" className="ms-logo-art__stop-lower" stopOpacity="0.14" />
                </linearGradient>
                <linearGradient id={ids.lower} x1="0" y1="0.25" x2="0.2" y2="1">
                    <stop offset="0" className="ms-logo-art__stop-lower" stopOpacity="0.88" />
                    <stop offset="0.6" className="ms-logo-art__stop-lower" stopOpacity="0.38" />
                    <stop offset="1" className="ms-logo-art__stop-lower" stopOpacity="0.1" />
                </linearGradient>
                {/* An alpha mask: only the stop opacity matters, so no colour is needed. */}
                <linearGradient id={ids.fadeGradient} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2="0">
                    <stop offset="0" stopOpacity="0.05" />
                    <stop offset="0.3" stopOpacity="0.4" />
                    <stop offset="0.8" stopOpacity="1" />
                </linearGradient>
                <mask
                    id={ids.fade}
                    maskUnits="userSpaceOnUse"
                    x={-PAD}
                    y={-PAD}
                    width={W + PAD * 2}
                    height={H + PAD * 2}
                    style={{ maskType: "alpha" }}
                >
                    <rect x={-PAD} y={-PAD} width={W + PAD * 2} height={H + PAD * 2} fill={url(ids.fadeGradient)} />
                </mask>
                <clipPath id={ids.clip} clipPathUnits="userSpaceOnUse">
                    <path d={LOGO_UPPER_PATH} />
                    <path d={LOGO_LOWER_PATH} />
                </clipPath>
                <filter
                    id={ids.grain}
                    x="0"
                    y="0"
                    width={W}
                    height={H}
                    filterUnits="userSpaceOnUse"
                    colorInterpolationFilters="sRGB"
                >
                    <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="11" stitchTiles="stitch" />
                    <feColorMatrix type="saturate" values="0" />
                </filter>
            </defs>
            <g mask={url(ids.fade)}>
                <path fill={url(ids.upper)} d={LOGO_UPPER_PATH} />
                <path fill={url(ids.lower)} d={LOGO_LOWER_PATH} />
                <rect className="ms-logo-art__grain" width={W} height={H} clipPath={url(ids.clip)} filter={url(ids.grain)} />
            </g>
        </svg>
    );
}
