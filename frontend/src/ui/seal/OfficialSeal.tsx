import { useId } from "react";
import type { ReactNode } from "react";
import type { SealKey } from "./seals";
import "./official-seal.css";

/*
 * The official department seal, redrawn from the MEH Studios brand artwork (a 1200 x 1200 box,
 * centre 600,600): a dark disc with rivets, the title along the top, a grey gear ring inside a
 * thin seal-coloured ring, the emblem in the centre, two stars, two vents, and "MEH Studios
 * Incorporated" along the bottom in the seal colour.
 */

const C = 600;
const rad = (deg: number) => (deg * Math.PI) / 180;
const n = (v: number) => Math.round(v * 10) / 10;
const at = (deg: number, r: number) => `${n(C + r * Math.cos(rad(deg)))} ${n(C + r * Math.sin(rad(deg)))}`;

/** The gear: 32 radial teeth (root 344, tip 360) around a 296 hole. */
const GEAR = (() => {
    const parts: string[] = [];
    for (let k = 0; k < 32; k++) {
        const a = k * 11.25;
        parts.push(at(a - 2.25, 344), at(a - 2.25, 360), at(a + 2.25, 360), at(a + 2.25, 344));
    }
    return `M${parts.join("L")}ZM896 600A296 296 0 1 0 304 600A296 296 0 1 0 896 600Z`;
})();

const RIVETS = Array.from({ length: 12 }, (_, k) => {
    const a = rad(15 + k * 30);
    return { x: n(C + 568.2 * Math.cos(a)), y: n(C + 568.2 * Math.sin(a)) };
});

const STAR = "M100 565L107.9 589.2H133.3L112.7 604.1L120.6 628.3L100 613.4L79.4 628.3L87.3 604.1L66.7 589.2H92.1Z";
const VENT_LINES = [0, 12, 24, 36, 48, 60];

/** The top title runs from about 8 to 4 o'clock; long titles get smaller letters. */
const TITLE_ARC = `M${at(150, 496)}A496 496 0 1 1 ${at(30, 496)}`;
const FOOT_ARC = `M${at(165, 537)}A537 537 0 0 0 ${at(15, 537)}`;
const TITLE_MAX = 1360;

// ---- Emblems ---------------------------------------------------------------------------

const F = "ms-official-seal__fill";
const L = "ms-official-seal__line";
const DIM = "ms-official-seal__dim";
const CUT = "ms-official-seal__cut";
const GROOVE = "ms-official-seal__groove";

function Administration() {
    const cols = [462.8, 575.5, 688.2];
    return (
        <g>
            <g className={`${F} ms-official-seal__edge`} strokeWidth="2.4">
                <path d="M423.6 472.8L600 394.4L776.4 472.8V492.4H423.6Z" />
                <rect x="433.4" y="502.2" width="333.2" height="19.6" />
                {cols.map((x) => (
                    <g key={x}>
                        <rect x={n(x - 9.8)} y="526.7" width="68.6" height="14.7" />
                        <rect x={x} y="541.4" width="49" height="147" />
                        <rect x={n(x - 9.8)} y="693.3" width="68.6" height="14.7" />
                    </g>
                ))}
                <rect x="423.6" y="712.9" width="352.8" height="14.7" />
                <rect x="413.8" y="727.6" width="372.4" height="14.7" />
                <rect x="404" y="742.3" width="392" height="19.6" />
            </g>
            <path className={`${CUT} ms-official-seal__edge`} strokeWidth="2.4" d="M551 443.4L600 418.9L649 443.4L639.2 463H560.8Z" />
            <path className={GROOVE} strokeWidth="1.5" d={cols.map((x) => `M${n(x + 14.7)} 541.4V688.4M${n(x + 34.3)} 541.4V688.4`).join("")} />
        </g>
    );
}

function Development() {
    const pins = [503.8, 542.3, 580.8, 619.3, 657.8, 696.3];
    return (
        <g>
            <g className={F}>
                {pins.map((p) => (
                    <g key={p}>
                        <rect x={n(p - 6)} y="410" width="12" height="70" />
                        <rect x={n(p - 6)} y="720" width="12" height="70" />
                        <rect x="410" y={n(p - 6)} width="70" height="12" />
                        <rect x="720" y={n(p - 6)} width="70" height="12" />
                    </g>
                ))}
                <rect x="470" y="470" width="260" height="260" rx="16" />
            </g>
            <rect className={CUT} x="513" y="513" width="174" height="174" />
            <path className={GROOVE} strokeWidth="3" d="M540 600H660M600 540V660" />
            <g className={F}>
                <rect x="530" y="530" width="16" height="16" />
                <rect x="654" y="530" width="16" height="16" />
                <rect x="530" y="654" width="16" height="16" />
                <rect x="654" y="654" width="16" height="16" />
                <circle cx="600" cy="600" r="22" />
            </g>
        </g>
    );
}

function QualityControl() {
    const ticks = [0, 90, 180, 270].map((a) => `M${at(a, 204)}L${at(a, 256)}`).join("");
    const diagonals = [45, 135, 225, 315].map((a) => `M${at(a, 170)}L${at(a, 198)}`).join("");
    return (
        <g>
            <g className={`${L} ${DIM}`}>
                <circle cx="600" cy="600" r="184" strokeWidth="12" />
                <circle cx="600" cy="600" r="93" strokeWidth="10" />
                <path d={diagonals} strokeWidth="5" />
            </g>
            <g className={L}>
                <circle cx="600" cy="600" r="230" strokeWidth="8" />
                <circle cx="600" cy="600" r="139" strokeWidth="8" />
                <path d={ticks} strokeWidth="7" />
                <path d="M550 606L587 641L648 570" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            </g>
        </g>
    );
}

/** The orbit around the globe: a tilted ellipse, its front half drawn as a band with an arrow. */
const ORBIT = (() => {
    const tilt = rad(14);
    const point = (t: number): [number, number] => {
        const x = 238 * Math.cos(rad(t));
        const y = 64 * Math.sin(rad(t));
        return [C + x * Math.cos(tilt) - y * Math.sin(tilt), 592 + x * Math.sin(tilt) + y * Math.cos(tilt)];
    };
    const arc = (from: number, to: number) => {
        const pts: string[] = [];
        for (let t = from; from > to ? t >= to : t <= to; t += from > to ? -5 : 5) {
            const [x, y] = point(t);
            pts.push(`${n(x)} ${n(y)}`);
        }
        return `M${pts.join("L")}`;
    };
    // The arrowhead at t = 98, pointing along the direction of travel (decreasing t).
    const [tx, ty] = point(92);
    const [bx, by] = point(112);
    const dx = tx - bx;
    const dy = ty - by;
    const len = Math.hypot(dx, dy);
    const nx = (-dy / len) * 30;
    const ny = (dx / len) * 30;
    const head = `M${n(tx)} ${n(ty)}L${n(bx + nx)} ${n(by + ny)}L${n(bx - nx)} ${n(by - ny)}Z`;
    return { before: arc(205, 110), after: arc(78, -28), head };
})();

function ExternalAffairs({ clip }: { clip: string }) {
    const globe = (
        <>
            <circle cx="600" cy="600" r="172" />
            <ellipse cx="600" cy="600" rx="78" ry="172" />
            <path d="M600 428V772M428 600H772M441 538H759M441 662H759" />
        </>
    );
    return (
        <g>
            <g className={`${L} ${DIM}`} strokeWidth="15">{globe}</g>
            <g className={L} strokeWidth="15" clipPath={`url(#${clip})`}>{globe}</g>
            <g className="ms-official-seal__orbit-gap" strokeWidth="44" strokeLinecap="round">
                <path d={ORBIT.before} />
                <path d={ORBIT.after} />
            </g>
            <g className="ms-official-seal__orbit" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round">
                <path d={ORBIT.before} />
                <path d={ORBIT.after} />
            </g>
            <path className="ms-official-seal__orbit-head" d={ORBIT.head} />
        </g>
    );
}

function HumanResources() {
    return (
        <g className={F}>
            <path d="M396 755V640A60.5 66 0 0 1 517 640V755Z" />
            <path d="M684 755V640A60.5 66 0 0 1 805 640V755Z" />
            <circle cx="461" cy="529" r="43" />
            <circle cx="739" cy="529" r="43" />
            <path className="ms-official-seal__outline" strokeWidth="14" paintOrder="stroke"
                d="M504 806V669A95.5 100 0 0 1 695 669V796Q695 806 685 806H514Q504 806 504 796Z" />
            <circle cx="600" cy="500" r="50" />
        </g>
    );
}

function EthicsRegulations() {
    const pan = (x: number) => (
        <g key={x}>
            <circle className={L} cx={x} cy="505" r="6" strokeWidth="3.5" />
            <path className={L} strokeWidth="3.5" d={`M${x} 511L${x - 50} 668M${x} 511L${x + 50} 668M${x} 511V668`} />
            <path className={F} d={`M${x - 56} 668H${x + 56}A56 26 0 0 1 ${x - 56} 668Z`} />
        </g>
    );
    return (
        <g>
            <path className={L} strokeWidth="12" d="M476 470Q600 414 724 470" />
            <g className={L} strokeWidth="9">
                <circle cx="466" cy="458" r="21" />
                <circle cx="734" cy="458" r="21" />
            </g>
            <g className={F}>
                <circle cx="466" cy="458" r="7" />
                <circle cx="734" cy="458" r="7" />
                <rect x="593" y="412" width="14" height="290" />
                <path d="M600 376C607 392 613 400 613 410A13 13 0 0 1 587 410C587 400 593 392 600 376Z" />
                <ellipse cx="600" cy="468" rx="13" ry="7" />
                <ellipse cx="600" cy="694" rx="13" ry="7" />
                <path d="M594 696C594 724 568 740 528 748H672C632 740 606 724 606 696Z" />
                <rect x="484" y="746" width="232" height="12" />
                <rect x="468" y="756" width="264" height="13" />
                <rect x="452" y="767" width="296" height="22" />
            </g>
            {pan(472)}
            {pan(728)}
        </g>
    );
}

function EngineeringInnovation() {
    const electrons = [0, -120, 120].map((a) => {
        const p = at(a, 207).split(" ");
        return { x: p[0], y: p[1] };
    });
    return (
        <g>
            <g className={L} strokeWidth="11">
                {[0, 60, -60].map((r) => (
                    <ellipse key={r} cx="600" cy="600" rx="219" ry="80" transform={`rotate(${r} 600 600)`} />
                ))}
            </g>
            <g className={F}>
                <circle cx="600" cy="600" r="40" />
                {electrons.map((e) => (
                    <circle key={`${e.x}-${e.y}`} cx={e.x} cy={e.y} r="21" />
                ))}
            </g>
            <g className="ms-official-seal__spot">
                <circle cx="587" cy="590" r="9" />
                <circle cx="614" cy="611" r="7" />
            </g>
        </g>
    );
}

/** A compass point: a long kite from the hub to `tip`, widest (`half` each side) at `wide`. */
function kite(tip: number, wide: number, half: number, angle: number): string {
    const a = rad(angle);
    const corners: [number, number][] = [[0, -tip], [half, -wide], [0, -36], [-half, -wide]];
    const pts = corners.map(([x, y]) => `${n(C + x * Math.cos(a) - y * Math.sin(a))} ${n(C + x * Math.sin(a) + y * Math.cos(a))}`);
    return `M${pts.join("L")}Z`;
}

const COMPASS = {
    main: [0, 90, 180, 270].map((a) => kite(222, 150, 22, a)).join(""),
    diagonal: [45, 135, 225, 315].map((a) => kite(140, 92, 18, a)).join(""),
    ticks: Array.from({ length: 24 }, (_, k) => k * 15)
        .filter((a) => a % 90 !== 0)
        .map((a) => `M${at(a, 206)}L${at(a, 224)}`)
        .join(""),
    cardinal: [0, 90, 180, 270].map((a) => `M${at(a, 200)}L${at(a, 236)}`).join(""),
};

function Director() {
    return (
        <g>
            <circle className={GROOVE} cx="600" cy="600" r="241" strokeWidth="4" fill="none" />
            <circle className={`${L} ${DIM}`} cx="600" cy="600" r="232" strokeWidth="1.5" />
            <path className="ms-official-seal__dim-line" strokeWidth="7" d={COMPASS.ticks} />
            <path className="ms-official-seal__dim-line" strokeWidth="6" d={COMPASS.cardinal} />
            <path className="ms-official-seal__dim-fill" d={COMPASS.diagonal} />
            <path className={F} d={COMPASS.main} />
            <circle className={F} cx="600" cy="600" r="34" />
            <circle className={GROOVE} cx="600" cy="600" r="12" strokeWidth="6" fill="none" />
        </g>
    );
}

function Emblem({ seal, clip }: { seal: SealKey; clip: string }): ReactNode {
    switch (seal) {
        case "administration": return <Administration />;
        case "development": return <Development />;
        case "quality-control": return <QualityControl />;
        case "external-affairs": return <ExternalAffairs clip={clip} />;
        case "human-resources": return <HumanResources />;
        case "ethics-regulations": return <EthicsRegulations />;
        case "engineering-innovation": return <EngineeringInnovation />;
        case "director": return <Director />;
    }
}

type OfficialSealProps = {
    seal: SealKey;
    /** The title along the top of the ring, e.g. "Department of Development". */
    title: string;
    className?: string;
};

/**
 * The official seal of a department, as an SVG. Decorative (aria-hidden): put the department's
 * name in text next to it. Size it with CSS; it stays crisp from about 96px up. The disc is dark
 * in both themes, like the printed seal.
 */
export default function OfficialSeal({ seal, title, className }: OfficialSealProps) {
    const base = `os${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const ids = { title: `${base}-t`, foot: `${base}-f`, clip: `${base}-c` };
    const text = title.toUpperCase();
    const natural = text.length * 43;
    const titleLength = Math.min(natural, TITLE_MAX);
    const titleSize = natural > TITLE_MAX ? n((52 * TITLE_MAX) / natural) : 52;

    return (
        <svg
            className={className ? `ms-official-seal ${className}` : "ms-official-seal"}
            viewBox="0 0 1200 1200"
            data-seal={seal}
            aria-hidden="true"
            focusable="false"
        >
            <defs>
                <path id={ids.title} d={TITLE_ARC} />
                <path id={ids.foot} d={FOOT_ARC} />
                <clipPath id={ids.clip}>
                    <rect width="1200" height="600" />
                </clipPath>
            </defs>

            <circle className="ms-official-seal__disc" cx="600" cy="600" r="580" strokeWidth="2" />
            <circle className="ms-official-seal__hairline" cx="600" cy="600" r="556" strokeWidth="1.5" />
            {RIVETS.map((r) => (
                <g key={`${r.x}-${r.y}`}>
                    <circle className="ms-official-seal__rivet" cx={r.x} cy={r.y} r="10.7" />
                    <circle className="ms-official-seal__rivet-head" cx={r.x} cy={r.y} r="6.4" />
                </g>
            ))}
            <circle className="ms-official-seal__band" cx="600" cy="600" r="450" strokeWidth="1" />
            <circle className="ms-official-seal__ring" cx="600" cy="600" r="390" strokeWidth="14" />

            {[946, 166].map((x) => (
                <g key={x}>
                    <rect className="ms-official-seal__vent" x={x} y="574" width="88" height="52" strokeWidth="1.5" />
                    <path
                        className="ms-official-seal__vent-line"
                        strokeWidth="2"
                        d={VENT_LINES.map((d) => `M${x + 14 + d} 586V614`).join("")}
                    />
                </g>
            ))}
            <path className="ms-official-seal__gear" fillRule="evenodd" d={GEAR} />
            <circle className="ms-official-seal__inner" cx="600" cy="600" r="284" strokeWidth="3" />
            <circle className={`${L} ${DIM}`} cx="600" cy="600" r="264" strokeWidth="1.5" />

            <path className={F} d={STAR} />
            <path className={F} d={STAR} transform="translate(1000 0)" />

            <text className="ms-official-seal__title" fontSize={titleSize}>
                <textPath href={`#${ids.title}`} startOffset="50%" textLength={titleLength} lengthAdjust="spacing">
                    {text}
                </textPath>
            </text>
            <text className="ms-official-seal__foot" fontSize="50">
                <textPath href={`#${ids.foot}`} startOffset="50%" textLength="974" lengthAdjust="spacing">
                    MEH STUDIOS INCORPORATED
                </textPath>
            </text>

            <Emblem seal={seal} clip={ids.clip} />
        </svg>
    );
}
