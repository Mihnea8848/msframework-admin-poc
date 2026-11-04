import type { CSSProperties } from "react";
import { budgetSegments } from "./scale";
import { useChartTip } from "./useChartTip";
import { ChartTip, TipBody } from "./ChartTip";
import "./charts.css";

type BudgetBarProps = {
    /** What the bar is for ("Development, Hardware"), for the accessible name and the tooltip. */
    label: string;
    budget: number;
    spent: number;
    committed: number;
    format: (value: number) => string;
    /** Make it a tab stop with a tooltip on focus. Leave off where the numbers are printed next to it. */
    focusable?: boolean;
};

/**
 * Budget against spending: the track is the budget, the solid segment what was spent (approved
 * and paid), the lighter one what is committed (submitted). When spending passes the budget the
 * track grows to fit, a tick marks where the budget ends and the bar turns to the danger colour.
 */
export default function BudgetBar({ label, budget, spent, committed, format, focusable = false }: BudgetBarProps) {
    const { frameRef, tip, showFor, hide } = useChartTip<HTMLDivElement>();
    const seg = budgetSegments(budget, spent, committed);
    const remaining = budget - spent - committed;
    const name = `${label}: ${format(spent)} spent and ${format(committed)} committed of ${format(budget)} budget`
        + (seg.over ? `, over budget by ${format(-remaining)}` : `, ${format(remaining)} left`);
    const content = (
        <TipBody title={label} rows={[
            { label: "spent", value: format(spent), tone: seg.over ? "over" : "1" },
            { label: "committed", value: format(committed), tone: "2" },
            { label: "budget", value: format(budget), tone: "track" },
            { label: remaining < 0 ? "over budget" : "left", value: format(Math.abs(remaining)) },
        ]} />
    );
    return (
        <div ref={frameRef} className="ms-budgetbar">
            <div
                className={`ms-budgetbar__track${seg.over ? " ms-budgetbar__track--over" : ""}`}
                role="img"
                aria-label={name}
                // Only a tab stop where the figures are not printed beside the bar.
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={focusable ? 0 : undefined}
                onPointerEnter={(e) => showFor(e.currentTarget, content)}
                onPointerLeave={hide}
                onFocus={(e) => showFor(e.currentTarget, content)}
                onBlur={hide}
                style={{ "--spent": `${seg.spent}%`, "--committed": `${seg.committed}%`, "--mark": `${seg.budgetMark}%` } as CSSProperties}
            >
                {seg.spent > 0 && <span className="ms-budgetbar__spent" />}
                {seg.committed > 0 && <span className="ms-budgetbar__committed" />}
                {seg.over && budget > 0 && <span className="ms-budgetbar__mark" />}
            </div>
            <ChartTip tip={tip} />
        </div>
    );
}
