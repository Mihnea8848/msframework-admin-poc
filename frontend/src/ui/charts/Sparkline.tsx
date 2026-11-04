import { useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { linePath, sparkPoints } from "./scale";
import { useChartTip } from "./useChartTip";
import { ChartTip, TipBody } from "./ChartTip";
import DataTable from "./DataTable";
import "./charts.css";

type SparklineProps = {
    values: readonly (number | null)[];
    /** One label per value (for example "Jun 2026"), shown in the tooltip and the hidden table. */
    labels: readonly string[];
    /** The accessible name: what the line shows ("Development score, last 6 months"). */
    label: string;
    format: (value: number | null) => string;
    width?: number;
    height?: number;
    /** Fixes the value domain (for example 0..120 for scores), so lines can be compared. */
    min?: number;
    max?: number;
    /** Name of the value column in the hidden table. */
    valueName?: string;
    /** A reference value drawn as a hairline across the plot (a goal's target). Needs min and max. */
    reference?: number;
};

/**
 * A small trend line with an end dot. Hover or focus it for the value under the pointer; the left
 * and right arrow keys move between points. A visually hidden table lists every value.
 */
export default function Sparkline({
    values, labels, label, format, width = 120, height = 32, min, max, valueName = "Value", reference,
}: SparklineProps) {
    const { frameRef, tip, showAt, hide } = useChartTip<HTMLDivElement>();
    const [active, setActive] = useState<number | null>(null);
    const points = sparkPoints(values, width, height, { pad: 4, min, max });
    const lastIndex = points.reduce((last, p, i) => (p ? i : last), -1);
    const last = lastIndex >= 0 ? points[lastIndex] : null;
    const shown = active !== null ? points[active] : null;
    const refY = reference === undefined ? null : (sparkPoints([reference], width, height, { pad: 4, min, max })[0]?.y ?? null);

    function show(index: number) {
        const p = points[index];
        setActive(index);
        showAt(p ? p.x : (index / Math.max(1, values.length - 1)) * width, p ? p.y - 4 : 0,
            <TipBody title={labels[index]} rows={[{ label: valueName, value: format(values[index] ?? null) }]} />);
    }

    function onPointerMove(e: PointerEvent<HTMLDivElement>) {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
        show(Math.max(0, Math.min(values.length - 1, Math.round(ratio * (values.length - 1)))));
    }

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        if (values.length === 0) return;
        const current = active ?? Math.max(0, lastIndex);
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const next = Math.max(0, Math.min(values.length - 1, current + (e.key === "ArrowLeft" ? -1 : 1)));
            show(next);
        } else if (e.key === "Escape") {
            setActive(null);
            hide();
        }
    }

    function leave() {
        setActive(null);
        hide();
    }

    return (
        <div ref={frameRef} className="ms-spark">
            {/* A chart you can focus: the arrow keys give the same per-point readout as the pointer. */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <div
                className="ms-spark__plot"
                role="img"
                aria-label={label}
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                onPointerMove={onPointerMove}
                onPointerLeave={leave}
                onFocus={() => show(Math.max(0, lastIndex))}
                onBlur={leave}
                onKeyDown={onKeyDown}
            >
                <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
                    {refY !== null && <line className="ms-spark__ref" x1={0} x2={width} y1={refY} y2={refY} />}
                    <path className="ms-spark__line" d={linePath(points)} />
                    {last && <circle className="ms-spark__dot" cx={last.x} cy={last.y} r={3.5} />}
                    {shown && <circle className="ms-spark__dot ms-spark__dot--active" cx={shown.x} cy={shown.y} r={4} />}
                </svg>
            </div>
            <ChartTip tip={tip} />
            <DataTable caption={label} columns={["Month", valueName]} rows={values.map((v, i) => [labels[i] ?? "", format(v)])} />
        </div>
    );
}
