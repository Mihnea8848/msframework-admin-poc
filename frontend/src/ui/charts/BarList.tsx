import type { CSSProperties, ReactNode } from "react";
import type { SealKey } from "../seal/seals";
import { maxOf, percentOf } from "./scale";
import { useChartTip } from "./useChartTip";
import { ChartTip, TipBody } from "./ChartTip";
import "./charts.css";

export interface BarListItem {
    key: string | number;
    label: string;
    value: number;
    /** Colours the bar with a department seal; the accent otherwise. */
    seal?: SealKey | null;
    /** Something to show before the label (a SealMini, an icon). */
    lead?: ReactNode;
}

type BarListProps = {
    /** The accessible name of the list. */
    label: string;
    items: readonly BarListItem[];
    format: (value: number) => string;
    /** What a share is a share of, in the tooltip ("of all spending"). */
    shareOf?: string;
    /** Fixes the end of the scale (100 for scores); the largest value otherwise. */
    max?: number;
    /** Leave out the share of the total (for scores, where a share means nothing). */
    noShare?: boolean;
};

/**
 * A horizontal bar per item: the label and value as text, the bar under them scaled to the
 * largest value. Values are always printed, so the bars need no axis; hover or focus a row for
 * its share of the total.
 */
export default function BarList({ label, items, format, shareOf = "of the total", max: fixedMax, noShare = false }: BarListProps) {
    const { frameRef, tip, showFor, hide } = useChartTip<HTMLDivElement>();
    const max = fixedMax ?? maxOf(items.map((i) => i.value));
    const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);

    return (
        <div ref={frameRef} className="ms-barlist">
            <ul className="ms-barlist__list" aria-label={label}>
                {items.map((item) => {
                    const share = percentOf(item.value, total);
                    const tipContent = (
                        <TipBody title={item.label} rows={noShare ? [{ label: "", value: format(item.value) }] : [
                            { label: "", value: format(item.value) },
                            { label: shareOf, value: `${share.toFixed(share < 10 ? 1 : 0)}%` },
                        ]} />
                    );
                    return (
                        <li
                            key={item.key}
                            className="ms-barlist__row"
                            data-seal={item.seal ?? undefined}
                            // Focusable so the share in the tooltip is reachable from the keyboard as well.
                            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                            tabIndex={0}
                            onPointerEnter={(e) => showFor(e.currentTarget, tipContent)}
                            onPointerLeave={hide}
                            onFocus={(e) => showFor(e.currentTarget, tipContent)}
                            onBlur={hide}
                        >
                            <span className="ms-barlist__label">{item.lead}{item.label}</span>
                            <span className="ms-barlist__value">{format(item.value)}</span>
                            <span className="ms-barlist__track" aria-hidden="true">
                                <span
                                    className={`ms-barlist__fill${item.seal ? " ms-barlist__fill--seal" : ""}`}
                                    style={{ "--w": `${Math.min(100, percentOf(Math.max(0, item.value), max))}%` } as CSSProperties}
                                />
                            </span>
                            {!noShare && <span className="ms-visually-hidden">, {share.toFixed(1)}% {shareOf}</span>}
                        </li>
                    );
                })}
            </ul>
            <ChartTip tip={tip} />
        </div>
    );
}
