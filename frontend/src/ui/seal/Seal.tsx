import type { SealKey } from "./seals";
import { SEAL_ICONS } from "./seals";
import "./seal.css";

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? inner : outer;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(" ");
}

const STAR_L = starPoints(12, 39, 5, 2.1);
const STAR_R = starPoints(100, 39, 5, 2.1);

/** The small round seal shown next to a department name. Decorative; `null` draws an empty ring. */
export function SealMini({ seal }: { seal: SealKey | null }) {
    if (!seal) return <span className="ms-seal-mini ms-seal-mini--empty" aria-hidden="true" />;
    const Icon = SEAL_ICONS[seal];
    return (
        <span className="ms-seal-mini" data-seal={seal} aria-hidden="true">
            <Icon />
        </span>
    );
}

/** The department badge: gear ring, seal disc, two stars and the emblem. Decorative. */
export function SealBadge({ seal }: { seal: SealKey }) {
    const Icon = SEAL_ICONS[seal];
    return (
        <span className="ms-seal-badge" data-seal={seal} aria-hidden="true">
            <svg className="ms-seal-badge__svg" viewBox="0 0 112 76" preserveAspectRatio="xMidYMid slice" focusable="false">
                <circle className="ms-seal-badge__teeth" cx="56" cy="38" r="32.5" />
                <circle className="ms-seal-badge__ring" cx="56" cy="38" r="30" />
                <circle className="ms-seal-badge__disc" cx="56" cy="38" r="25" />
                <polygon className="ms-seal-badge__star" points={STAR_L} />
                <polygon className="ms-seal-badge__star" points={STAR_R} />
            </svg>
            <Icon className="ms-seal-badge__icon" />
        </span>
    );
}
