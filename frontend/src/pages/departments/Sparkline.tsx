import type { PerformanceTrendPointLite } from "../../api/people";
import { sparkGeometry, trendSummary } from "./figures";
import "./figures.css";

type SparklineProps = {
    trend: readonly PerformanceTrendPointLite[];
    width?: number;
    height?: number;
    className?: string;
};

/**
 * The six-month score trend as a small line: one series, so no legend; the score itself is printed
 * next to it. Months without data leave a gap. Each point has a tooltip with its month and score,
 * and the whole line has a text summary for screen readers.
 */
export default function Sparkline({ trend, width = 88, height = 28, className }: SparklineProps) {
    const { segments, points } = sparkGeometry(trend, width, height);
    if (points.length === 0) return null;
    const last = points[points.length - 1];
    return (
        <svg
            className={`ms-spark${className ? ` ${className}` : ""}`}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={trendSummary(trend)}
        >
            {segments.map((seg) => (
                <polyline key={seg} className="ms-spark__line" points={seg} fill="none" />
            ))}
            {points.map((p) => (
                <circle key={p.label} className="ms-spark__hit" cx={p.x} cy={p.y} r={6}>
                    <title>{`${p.label}: ${p.value}%`}</title>
                </circle>
            ))}
            {last && <circle className="ms-spark__dot" cx={last.x} cy={last.y} r={2.5} />}
        </svg>
    );
}
