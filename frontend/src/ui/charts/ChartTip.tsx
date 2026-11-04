import type { ReactNode } from "react";
import type { TipState } from "./useChartTip";

/** The tooltip box: value first, label after (see TipBody). */
export function ChartTip({ tip }: { tip: TipState | null }) {
    if (!tip) return null;
    return (
        <div className="ms-chart-tip" aria-hidden="true" style={{ left: `${Math.round(tip.x)}px`, top: `${Math.round(tip.y)}px` }}>
            {tip.content}
        </div>
    );
}

export interface TipRow {
    label: ReactNode;
    value: ReactNode;
    /** Modifier of the line key in front of the row (`ms-chart-key--<tone>`). */
    tone?: string;
}

/** Tooltip content: a heading and one row per value, each value bold and before its label. */
export function TipBody({ title, rows }: { title?: ReactNode; rows: readonly TipRow[] }) {
    return (
        <>
            {title ? <span className="ms-chart-tip__title">{title}</span> : null}
            {rows.map((row, i) => (
                <span key={i} className="ms-chart-tip__row">
                    {row.tone ? <i className={`ms-chart-key ms-chart-key--${row.tone}`} /> : null}
                    <strong>{row.value}</strong>
                    <span>{row.label}</span>
                </span>
            ))}
        </>
    );
}
