import type { PerformanceTrendPointLite } from "../../api/people";

/** "2026-06" as "Jun 2026" (local month name); anything else is returned as it is. */
export function monthLabel(month: string): string {
    const match = /^(\d{4})-(\d{2})/.exec(month);
    if (!match) return month;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export interface SparkPoint {
    x: number;
    y: number;
    value: number;
    label: string;
}

/** Smallest vertical range drawn, in score points, so small wobbles do not look like swings. */
const MIN_RANGE = 10;
const PAD = 3;

/**
 * The geometry of a trend sparkline: one point per month with data, evenly spaced across all the
 * months, and the polyline segments between consecutive months that have data (a month without
 * data leaves a gap). Scores are rounded to whole percent.
 */
export function sparkGeometry(trend: readonly PerformanceTrendPointLite[], width: number, height: number): {
    points: SparkPoint[];
    segments: string[];
} {
    const values = trend.map((t) => (t.score == null ? null : Math.round(t.score)));
    const known = values.filter((v): v is number => v !== null);
    if (known.length === 0) return { points: [], segments: [] };

    let min = Math.min(...known);
    let max = Math.max(...known);
    if (max - min < MIN_RANGE) {
        const mid = (max + min) / 2;
        min = mid - MIN_RANGE / 2;
        max = mid + MIN_RANGE / 2;
    }
    const step = trend.length > 1 ? (width - PAD * 2) / (trend.length - 1) : 0;
    const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * (height - PAD * 2);
    const round = (n: number) => Math.round(n * 10) / 10;

    const points: SparkPoint[] = [];
    const segments: string[] = [];
    let current: string[] = [];
    values.forEach((v, i) => {
        if (v === null) {
            if (current.length > 1) segments.push(current.join(" "));
            current = [];
            return;
        }
        const point = { x: round(trend.length > 1 ? PAD + i * step : width / 2), y: round(y(v)), value: v, label: monthLabel(trend[i]?.month ?? "") };
        points.push(point);
        current.push(`${point.x},${point.y}`);
    });
    if (current.length > 1) segments.push(current.join(" "));
    return { points, segments };
}

/** The trend as a sentence for screen readers: "Score by month: Jun 2026 61%, Jul 2026 no data, ...". */
export function trendSummary(trend: readonly PerformanceTrendPointLite[]): string {
    const parts = trend.map((t) => `${monthLabel(t.month)} ${t.score == null ? "no data" : `${Math.round(t.score)}%`}`);
    return `Score by month: ${parts.join(", ")}`;
}
