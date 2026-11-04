import { useId } from "react";
import type { CSSProperties } from "react";
import { LOGO_LOWER_PATH, LOGO_UPPER_PATH } from "./Logo";
import "./logo-art.css";

type Point = readonly [number, number];

/** The vertices of a mark half. The paths only use M, L, H, V and Z, so this is all it needs. */
function vertices(d: string): Point[] {
    const points: Point[] = [];
    let x = 0;
    let y = 0;
    for (const [, cmd, args] of d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
        const n = (args ?? "").trim().split(/[\s,]+/).filter(Boolean).map(Number);
        if (cmd === "M" || cmd === "L") [x, y] = [n[0] ?? x, n[1] ?? y];
        else if (cmd === "H") x = n[0] ?? x;
        else if (cmd === "V") y = n[0] ?? y;
        else continue;
        points.push([x, y]);
    }
    // The paths close on their first point: drop the duplicate.
    const first = points[0];
    const last = points[points.length - 1];
    if (first && last && first[0] === last[0] && first[1] === last[1]) points.pop();
    return points;
}

/** How far the tiles are extruded, in mark units: back and up to the right, at the mark's 30 degrees. */
const DEPTH: Point = [74, -43];

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const quad = (a: Point, b: Point) =>
    `M${fmt(a[0])} ${fmt(a[1])}L${fmt(b[0])} ${fmt(b[1])}L${fmt(b[0] + DEPTH[0])} ${fmt(b[1] + DEPTH[1])}L${fmt(a[0] + DEPTH[0])} ${fmt(a[1] + DEPTH[1])}Z`;

/**
 * The side walls of the extruded mark, split into the walls that face up (lit) and the ones that
 * face right (in shade). Only walls that face the viewer are kept, farthest first.
 */
function extrusion(): { top: string; side: string } {
    const walls: { d: string; up: boolean; depth: number }[] = [];
    for (const path of [LOGO_UPPER_PATH, LOGO_LOWER_PATH]) {
        const pts = vertices(path);
        let area = 0;
        pts.forEach((p, i) => {
            const q = pts[(i + 1) % pts.length] as Point;
            area += p[0] * q[1] - q[0] * p[1];
        });
        pts.forEach((a, i) => {
            const b = pts[(i + 1) % pts.length] as Point;
            const ex = b[0] - a[0];
            const ey = b[1] - a[1];
            // The outward normal; the sign depends on the winding.
            const nx = area > 0 ? ey : -ey;
            const ny = area > 0 ? -ex : ex;
            if (nx * DEPTH[0] + ny * DEPTH[1] <= 0.5) return;
            const mx = (a[0] + b[0]) / 2;
            const my = (a[1] + b[1]) / 2;
            walls.push({ d: quad(a, b), up: -ny > Math.abs(nx) * 0.4, depth: mx * DEPTH[0] + my * DEPTH[1] });
        });
    }
    walls.sort((p, q) => q.depth - p.depth);
    return {
        top: walls.filter((w) => w.up).map((w) => w.d).join(""),
        side: walls.filter((w) => !w.up).map((w) => w.d).join(""),
    };
}

const WALLS = extrusion();

/** The cluster's view box. The mark is 694 x 1000 units; tiles are scaled down into it. */
const VIEW_W = 1600;
const VIEW_H = 1500;
const TILE_SCALE = 0.34;
const CORE_SCALE = 0.44;

/** Tile centres on a staggered honeycomb lattice around the core (820, 760), drawn back to front. */
const TILES: readonly { x: number; y: number; dim: number }[] = [
    { x: 1082, y: 202, dim: 0.7 },
    { x: 1344, y: 388, dim: 0.8 },
    { x: 820, y: 388, dim: 0.9 },
    { x: 1082, y: 574, dim: 1 },
    { x: 1344, y: 760, dim: 0.9 },
    { x: 558, y: 574, dim: 0.85 },
    { x: 1082, y: 946, dim: 1 },
    { x: 1344, y: 1132, dim: 0.75 },
    { x: 558, y: 946, dim: 0.9 },
    { x: 820, y: 1132, dim: 1 },
];
const CORE = { x: 820, y: 760 };

const place = (x: number, y: number, s: number) => `translate(${fmt(x - 347 * s)} ${fmt(y - 500 * s)}) scale(${s})`;

/** A small deterministic random generator, so the star field is the same on every load. */
function random(seed: number) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** The star tile (512 x 512 CSS px): sparse brighter stars over the fine dust. */
const STAR_TILE = 512;
const STARS = (() => {
    const rand = random(20260411);
    return Array.from({ length: 54 }, () => ({
        x: fmt(rand() * STAR_TILE),
        y: fmt(rand() * STAR_TILE),
        r: fmt(0.45 + rand() * rand() * 1.25),
        o: fmt(0.3 + rand() * 0.7),
    }));
})();

/** The few stars that twinkle, as percentages of the art area, with their own timing. */
const TWINKLES: readonly [number, number, number, number][] = [
    [14, 16, 4.8, 0.2],
    [31, 74, 6.2, 1.6],
    [46, 9, 5.4, 3.1],
    [58, 90, 7, 0.9],
    [67, 27, 5.8, 2.4],
    [79, 61, 4.4, 4],
    [90, 12, 6.6, 1.2],
    [95, 84, 5.2, 2.9],
    [38, 46, 7.4, 3.6],
];

/**
 * The art behind the sign-in pages: a night sky with a slowly drifting star field, and a cluster
 * of the mark as extruded tiles on a honeycomb lattice, with a white core whose glow pulses. A
 * veil in the page colour fades all of it out toward the form.
 *
 * Purely decorative (aria-hidden). Colours come from the --art-* tokens, per theme. Motion uses
 * transforms and opacity only, and none of it runs under reduced motion (logo-art.css).
 */
export default function LogoArt({ className }: { className?: string }) {
    // useId can contain characters that are awkward inside url(#...): keep letters, digits, - and _.
    const base = `la${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const ids = {
        tile: `${base}-tile`,
        core: `${base}-core`,
        face: `${base}-face`,
        coreFace: `${base}-core-face`,
        glow: `${base}-glow`,
        coreGlow: `${base}-core-glow`,
        stars: `${base}-stars`,
    };
    const url = (id: string) => `url(#${id})`;
    const href = (id: string) => `#${id}`;

    return (
        <div className={className ? `ms-logo-art ${className}` : "ms-logo-art"} aria-hidden="true">
            <div className="ms-logo-art__sky" />
            <div className="ms-logo-art__dust" />
            <svg className="ms-logo-art__stars" focusable="false">
                <defs>
                    <pattern id={ids.stars} width={STAR_TILE} height={STAR_TILE} patternUnits="userSpaceOnUse">
                        {STARS.map((s, i) => (
                            <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
                        ))}
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill={url(ids.stars)} />
            </svg>
            {TWINKLES.map(([x, y, d, delay]) => (
                <span
                    key={`${x}-${y}`}
                    className="ms-logo-art__twinkle"
                    style={{ "--x": `${x}%`, "--y": `${y}%`, "--d": `${d}s`, "--delay": `${delay}s` } as CSSProperties}
                />
            ))}

            <div className="ms-logo-art__cluster">
                <svg className="ms-logo-art__tiles" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" focusable="false">
                    <defs>
                        <linearGradient id={ids.face} x1="0" y1="0" x2="0.3" y2="1">
                            <stop offset="0" className="ms-logo-art__stop-face-hi" />
                            <stop offset="1" className="ms-logo-art__stop-face-lo" />
                        </linearGradient>
                        <filter id={ids.glow} x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur stdDeviation="22" />
                        </filter>
                        <filter id={ids.coreGlow} x="-40%" y="-40%" width="180%" height="180%">
                            <feGaussianBlur stdDeviation="34" />
                        </filter>
                        <g id={ids.tile}>
                            <g className="ms-logo-art__rim" filter={url(ids.glow)}>
                                <path d={LOGO_UPPER_PATH} />
                                <path d={LOGO_LOWER_PATH} />
                            </g>
                            <path className="ms-logo-art__wall-top" d={WALLS.top} />
                            <path className="ms-logo-art__wall-side" d={WALLS.side} />
                            <path className="ms-logo-art__face ms-logo-art__face--upper" fill={url(ids.face)} d={LOGO_UPPER_PATH} />
                            <path className="ms-logo-art__face ms-logo-art__face--lower" fill={url(ids.face)} d={LOGO_LOWER_PATH} />
                        </g>
                        <g id={ids.core}>
                            <path className="ms-logo-art__core-wall-top" d={WALLS.top} />
                            <path className="ms-logo-art__core-wall-side" d={WALLS.side} />
                            <path className="ms-logo-art__core-face" d={LOGO_UPPER_PATH} />
                            <path className="ms-logo-art__core-face" d={LOGO_LOWER_PATH} />
                        </g>
                    </defs>
                    {TILES.map((t) => (
                        <use key={`${t.x}-${t.y}`} href={href(ids.tile)} transform={place(t.x, t.y, TILE_SCALE)} opacity={t.dim} />
                    ))}
                    <use href={href(ids.core)} transform={place(CORE.x, CORE.y, CORE_SCALE)} />
                </svg>
                {/* The core's glow, behind the tiles in its own layer, so its pulse is an opacity change only. */}
                <svg className="ms-logo-art__pulse" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" focusable="false">
                    <g className="ms-logo-art__core-glow" filter={url(ids.coreGlow)} transform={place(CORE.x, CORE.y, CORE_SCALE)}>
                        <path d={LOGO_UPPER_PATH} />
                        <path d={LOGO_LOWER_PATH} />
                    </g>
                </svg>
            </div>

            <div className="ms-logo-art__veil" />
        </div>
    );
}
