/**
 * Pure helpers behind the chart components: scales, nice axis ticks, the sparkline path and the
 * ring arc. Nothing here touches the DOM (scale.test.ts covers it).
 */

/** Keeps `value` within [min, max]. */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/** A linear scale from [d0, d1] to [r0, r1]. A zero-width domain maps everything to r0. */
export function linearScale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
    const span = d1 - d0;
    if (span === 0) return () => r0;
    return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** The share of `value` in `total` as 0..100; 0 when the total is 0 or less. */
export function percentOf(value: number, total: number): number {
    if (!(total > 0) || !Number.isFinite(value)) return 0;
    return (value / total) * 100;
}

/** The nearest "nice" step (1, 2, 2.5 or 5 times a power of ten) at or above `raw`. */
export function niceStep(raw: number): number {
    if (!(raw > 0) || !Number.isFinite(raw)) return 1;
    const power = 10 ** Math.floor(Math.log10(raw));
    const fraction = raw / power;
    const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
    return nice * power;
}

/**
 * Ticks from 0 up to a nice maximum that covers `max`, about `count` steps apart. Returns
 * `[0, 1]` (one empty step) when there is nothing to show, so the axis still draws.
 */
export function niceTicks(max: number, count = 4): number[] {
    if (!(max > 0) || !Number.isFinite(max)) return [0, 1];
    const step = niceStep(max / count);
    const top = Math.ceil(max / step - 1e-9) * step;
    const ticks: number[] = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
    return ticks;
}

/** The largest value in a list, ignoring null; 0 for an empty list. */
export function maxOf(values: readonly (number | null | undefined)[]): number {
    let max = 0;
    for (const v of values) if (typeof v === "number" && Number.isFinite(v) && v > max) max = v;
    return max;
}

export interface SparkPoint {
    x: number;
    y: number;
}

/**
 * The points of a sparkline in a `width` x `height` box with `pad` inside. Null values leave a
 * gap (no point). `min`/`max` fix the value domain (default: the data's own range).
 */
export function sparkPoints(
    values: readonly (number | null)[],
    width: number,
    height: number,
    { pad = 2, min, max }: { pad?: number; min?: number; max?: number } = {},
): (SparkPoint | null)[] {
    const numbers = values.filter((v): v is number => v !== null && Number.isFinite(v));
    if (numbers.length === 0) return values.map(() => null);
    let lo = min ?? Math.min(...numbers);
    let hi = max ?? Math.max(...numbers);
    if (lo === hi) {
        lo -= 1;
        hi += 1;
    }
    const x = linearScale(0, Math.max(1, values.length - 1), pad, width - pad);
    const y = linearScale(lo, hi, height - pad, pad);
    return values.map((v, i) => (v === null || !Number.isFinite(v) ? null : { x: round2(x(i)), y: round2(y(clamp(v, lo, hi))) }));
}

/** An SVG path through the points; a null breaks the line into separate runs. */
export function linePath(points: readonly (SparkPoint | null)[]): string {
    let d = "";
    let pen = false;
    for (const p of points) {
        if (!p) {
            pen = false;
            continue;
        }
        d += `${pen ? "L" : "M"}${p.x} ${p.y}`;
        pen = true;
    }
    return d;
}

/**
 * The arc of a progress ring: a circle of radius `r` around (cx, cy), from 12 o'clock clockwise
 * through `percent` of the turn (clamped to 0..100). Empty for 0, a full circle (two arcs) for 100.
 */
export function ringArc(percent: number, cx: number, cy: number, r: number): string {
    const p = clamp(percent, 0, 100);
    if (p <= 0) return "";
    if (p >= 100) {
        return `M${cx} ${cy - r}A${r} ${r} 0 1 1 ${cx} ${cy + r}A${r} ${r} 0 1 1 ${cx} ${cy - r}`;
    }
    const angle = (p / 100) * Math.PI * 2;
    const x = round2(cx + r * Math.sin(angle));
    const y = round2(cy - r * Math.cos(angle));
    const large = p > 50 ? 1 : 0;
    return `M${cx} ${cy - r}A${r} ${r} 0 ${large} 1 ${x} ${y}`;
}

/**
 * A column from the baseline up: square at the bottom, the top corners rounded by up to `radius`
 * (never more than half the width or the full height). Empty when it has no height.
 */
export function columnPath(x: number, y: number, width: number, height: number, radius = 4): string {
    if (!(height > 0) || !(width > 0)) return "";
    const r = Math.min(radius, width / 2, height);
    const bottom = round2(y + height);
    const right = round2(x + width);
    return `M${round2(x)} ${bottom}V${round2(y + r)}Q${round2(x)} ${round2(y)} ${round2(x + r)} ${round2(y)}`
        + `H${round2(right - r)}Q${right} ${round2(y)} ${right} ${round2(y + r)}V${bottom}Z`;
}

/** Every `n`th label fits when each needs `minGap` px and a slot is `slot` px wide. */
export function labelStride(slot: number, minGap = 40): number {
    if (!(slot > 0)) return 1;
    return Math.max(1, Math.ceil(minGap / slot));
}

function round2(v: number): number {
    return Math.round(v * 100) / 100;
}

/**
 * The segments of a budget bar, as percentages of its track. The track is the larger of the
 * budget and what was used (spent + committed), so overspending shows as a bar past the budget
 * mark instead of being cut off.
 */
export function budgetSegments(budget: number, spent: number, committed: number): {
    spent: number;
    committed: number;
    budgetMark: number;
    over: boolean;
    used: number;
} {
    const safeBudget = Math.max(0, budget);
    const safeSpent = Math.max(0, spent);
    const safeCommitted = Math.max(0, committed);
    const used = safeSpent + safeCommitted;
    const track = Math.max(safeBudget, used);
    return {
        spent: percentOf(safeSpent, track),
        committed: percentOf(safeCommitted, track),
        budgetMark: percentOf(safeBudget, track),
        over: used > safeBudget,
        used: percentOf(used, safeBudget),
    };
}
