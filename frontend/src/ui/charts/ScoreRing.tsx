import { ringArc } from "./scale";
import "./charts.css";

type ScoreRingProps = {
    /** 0 to 120 (attainment can pass 100%); null when there is no data yet. */
    value: number | null;
    /** What the score is, for the accessible name ("Development performance score"). */
    label: string;
    size?: number;
    /** Ring thickness in px. */
    stroke?: number;
};

/**
 * A progress ring with the value in the middle. The arc fills to 100% and stays full above it
 * (the number says by how much). Inside an element with `data-seal` it takes the seal colour,
 * otherwise the accent.
 */
export default function ScoreRing({ value, label, size = 64, stroke = 6 }: ScoreRingProps) {
    const r = (size - stroke) / 2;
    const c = size / 2;
    const text = value === null ? "—" : `${Math.round(value)}%`;
    const name = value === null ? `${label}: no data yet` : `${label}: ${Math.round(value)}%`;
    return (
        <svg className="ms-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={name}>
            <title>{name}</title>
            <circle className="ms-ring__track" cx={c} cy={c} r={r} strokeWidth={stroke} />
            {value !== null && value > 0 && (
                <path className="ms-ring__arc" d={ringArc(value, c, c, r)} strokeWidth={stroke} />
            )}
            <text className={`ms-ring__value${size < 56 ? " ms-ring__value--sm" : ""}`} x={c} y={c} dy="0.35em" textAnchor="middle">{text}</text>
        </svg>
    );
}
