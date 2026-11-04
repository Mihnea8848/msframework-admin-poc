import { useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { columnPath, labelStride, linearScale, maxOf, niceTicks } from "./scale";
import { useChartTip } from "./useChartTip";
import { useWidth } from "./useWidth";
import { ChartTip, TipBody } from "./ChartTip";
import DataTable from "./DataTable";
import Legend from "./Legend";
import type { LegendItem } from "./Legend";
import "./charts.css";

export interface ColumnCategory {
    key: string;
    /** Under the column ("May"). */
    label: string;
    /** In the tooltip and the hidden table ("May 2026"). */
    title: string;
}

export interface ColumnSeries extends LegendItem {
    key: string;
}

type ColumnChartProps = {
    /** The accessible name of the chart. */
    label: string;
    categories: readonly ColumnCategory[];
    series: readonly ColumnSeries[];
    /** values[category][series] */
    values: readonly (readonly number[])[];
    /** Stack the series in one column (part of a whole) instead of side by side. */
    stacked?: boolean;
    format: (value: number) => string;
    /** Axis tick labels, usually a compact form of `format`. */
    formatAxis?: (value: number) => string;
    height?: number;
};

const GUTTER = 56;
const TOP = 10;
const BOTTOM = 24;
const GAP = 2;

/**
 * Columns per category (months), stacked or grouped, from one baseline with one value axis.
 * Hover or focus for a tooltip with every series at that category; the arrow keys move along the
 * categories. A legend names the series and a visually hidden table lists every value.
 */
export default function ColumnChart({
    label, categories, series, values, stacked = false, format, formatAxis = format, height = 220,
}: ColumnChartProps) {
    const [wrapRef, width] = useWidth<HTMLDivElement>(560);
    const { frameRef, tip, showAt, hide } = useChartTip<HTMLDivElement>();
    const [active, setActive] = useState<number | null>(null);

    const n = Math.max(1, categories.length);
    const totals = values.map((row) => (stacked ? row.reduce((s, v) => s + Math.max(0, v), 0) : maxOf(row)));
    const ticks = niceTicks(maxOf(totals));
    const top = ticks[ticks.length - 1] ?? 1;
    const plotW = Math.max(40, width - GUTTER);
    const plotH = height - TOP - BOTTOM;
    const y = linearScale(0, top, TOP + plotH, TOP);
    const slot = plotW / n;
    const stride = labelStride(slot, 44);
    const barW = stacked
        ? Math.min(24, slot * 0.6)
        : Math.min(16, (slot * 0.72 - GAP * (series.length - 1)) / Math.max(1, series.length));

    function columnTop(i: number): number {
        return y(totals[i] ?? 0);
    }

    function show(i: number) {
        setActive(i);
        const cat = categories[i];
        const row = values[i] ?? [];
        const rows = series.map((s, j) => ({ label: s.label, value: format(row[j] ?? 0), tone: s.tone }));
        if (stacked && series.length > 1) rows.push({ label: "Total", value: format(totals[i] ?? 0), tone: "" });
        showAt(GUTTER + slot * (i + 0.5), columnTop(i) - 6, <TipBody title={cat?.title} rows={rows} />);
    }

    function onPointerMove(e: PointerEvent<HTMLDivElement>) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left - GUTTER;
        if (x < 0) return;
        show(Math.max(0, Math.min(n - 1, Math.floor(x / slot))));
    }

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        const current = active ?? n - 1;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            show(Math.max(0, Math.min(n - 1, current + (e.key === "ArrowLeft" ? -1 : 1))));
        } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            show(e.key === "Home" ? 0 : n - 1);
        } else if (e.key === "Escape") {
            leave();
        }
    }

    function leave() {
        setActive(null);
        hide();
    }

    const marks = categories.map((cat, i) => {
        const row = values[i] ?? [];
        const cx = GUTTER + slot * (i + 0.5);
        const paths: { key: string; d: string; tone: string }[] = [];
        if (stacked) {
            let base = y(0);
            const visible = series.map((_, j) => (row[j] ?? 0) > 0);
            const lastVisible = visible.lastIndexOf(true);
            series.forEach((s, j) => {
                const v = Math.max(0, row[j] ?? 0);
                if (v <= 0) return;
                const h = y(0) - y(v);
                const gap = base < y(0) ? GAP : 0;
                const segH = Math.max(0, h - gap);
                const segTop = base - gap - segH;
                const d = j === lastVisible
                    ? columnPath(cx - barW / 2, segTop, barW, segH)
                    : `M${cx - barW / 2} ${base - gap}V${segTop}H${cx + barW / 2}V${base - gap}Z`;
                paths.push({ key: s.key, d, tone: s.tone });
                base = segTop;
            });
        } else {
            const groupW = barW * series.length + GAP * (series.length - 1);
            series.forEach((s, j) => {
                const v = Math.max(0, row[j] ?? 0);
                const x = cx - groupW / 2 + j * (barW + GAP);
                paths.push({ key: s.key, d: columnPath(x, y(v), barW, y(0) - y(v)), tone: s.tone });
            });
        }
        return { key: cat.key, cx, paths };
    });

    return (
        <figure className="ms-chart">
            {series.length > 1 && <Legend items={series} />}
            <div ref={frameRef} className="ms-chart__frame">
                {/* A chart you can focus: the arrow keys give the same per-month readout as the pointer. */}
                {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                <div
                    ref={wrapRef}
                    className="ms-chart__plot"
                    role="img"
                    aria-label={`${label}. Use the arrow keys to read each month.`}
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                    tabIndex={0}
                    onPointerMove={onPointerMove}
                    onPointerLeave={leave}
                    onFocus={() => show(active ?? n - 1)}
                    onBlur={leave}
                    onKeyDown={onKeyDown}
                >
                    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
                        {ticks.map((t) => (
                            <g key={t}>
                                <line className="ms-chart__grid" x1={GUTTER} x2={width} y1={y(t)} y2={y(t)} />
                                <text className="ms-chart__tick" x={GUTTER - 8} y={y(t)} dy="0.32em" textAnchor="end">{formatAxis(t)}</text>
                            </g>
                        ))}
                        {active !== null && (
                            <rect className="ms-chart__band" x={GUTTER + slot * active} y={TOP} width={slot} height={plotH} />
                        )}
                        {marks.map((m) => (
                            <g key={m.key}>
                                {m.paths.map((p) => p.d && <path key={p.key} className={`ms-chart__mark ms-chart-fill--${p.tone}`} d={p.d} />)}
                            </g>
                        ))}
                        <line className="ms-chart__axis" x1={GUTTER} x2={width} y1={y(0)} y2={y(0)} />
                        {categories.map((cat, i) => (i % stride === 0 || i === n - 1) && (n - 1 - i >= stride || i === n - 1) ? (
                            <text key={cat.key} className="ms-chart__tick" x={GUTTER + slot * (i + 0.5)} y={height - 6} textAnchor="middle">{cat.label}</text>
                        ) : null)}
                    </svg>
                </div>
                <ChartTip tip={tip} />
            </div>
            <DataTable
                caption={label}
                columns={["Month", ...series.map((s) => s.label)]}
                rows={categories.map((cat, i) => [cat.title, ...series.map((_, j) => format(values[i]?.[j] ?? 0))])}
            />
        </figure>
    );
}
