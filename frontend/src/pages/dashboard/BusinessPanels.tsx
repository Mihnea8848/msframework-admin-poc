import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../../api/client";
import type { BudgetSummary, PerformanceOverview } from "../../api/business";
import Sparkline from "../../ui/charts/Sparkline";
import BudgetBar from "../../ui/charts/BudgetBar";
import Legend from "../../ui/charts/Legend";
import { SealMini } from "../../ui/seal/Seal";
import { sealOf } from "../../ui/useDepartments";
import { formatMoney, formatMonth, formatPercent, quarterLabel, quarterOf } from "../../utils/money";
import "../../ui/surface.css";
import "../../ui/business.css";

type Loaded<T> = { data: T } | { error: string } | null;

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * The Dashboard's business panels: department performance (GOALS_READ or REPORTS_READ) and
 * this quarter's spending against budget (FINANCE_READ). Each loads on its own and says so when
 * it fails; nothing is shown that the API did not return.
 */
export default function BusinessPanels({ showPerformance, showSpending, version }: {
    showPerformance: boolean;
    showSpending: boolean;
    /** Bumped by the Dashboard's Refresh button. */
    version: number;
}) {
    const [now] = useState(() => new Date());
    const quarter = quarterOf(now);
    const [performance, setPerformance] = useState<Loaded<PerformanceOverview>>(null);
    const [budgets, setBudgets] = useState<Loaded<BudgetSummary>>(null);

    useEffect(() => {
        if (!showPerformance) return undefined;
        let alive = true;
        get<PerformanceOverview>(`/api/performance?year=${quarter.year}&quarter=${quarter.quarter}`)
            .then((data) => { if (alive) setPerformance({ data }); })
            .catch((err) => { if (alive) setPerformance({ error: messageOf(err) }); });
        return () => { alive = false; };
    }, [showPerformance, quarter.year, quarter.quarter, version]);

    useEffect(() => {
        if (!showSpending) return undefined;
        let alive = true;
        get<BudgetSummary>(`/api/budgets?year=${quarter.year}&quarter=${quarter.quarter}`)
            .then((data) => { if (alive) setBudgets({ data }); })
            .catch((err) => { if (alive) setBudgets({ error: messageOf(err) }); });
        return () => { alive = false; };
    }, [showSpending, quarter.year, quarter.quarter, version]);

    if (!showPerformance && !showSpending) return null;

    return (
        <div className={showPerformance && showSpending ? "ms-dashboard__cols ms-dashboard__biz" : "ms-dashboard__cols ms-dashboard__cols--single ms-dashboard__biz"}>
            {showPerformance && (
                <section className="ms-panel" aria-labelledby="dash-perf">
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id="dash-perf">Department performance</h2>
                        <Link className="ms-panel__meta ms-dashboard__more" to="/goals">{quarterLabel(quarter)} goals</Link>
                    </div>
                    {performance === null && <p className="ms-dashboard__empty">Loading…</p>}
                    {performance && "error" in performance && <p className="ms-dashboard__empty">Could not load performance: {performance.error}</p>}
                    {performance && "data" in performance && (
                        performance.data.departments.length === 0
                            ? <p className="ms-dashboard__empty">No goals set for this quarter yet.</p>
                            : (
                                <ul className="ms-dash-perf">
                                    {performance.data.departments.map((d) => {
                                        const seal = sealOf(d.departmentColor);
                                        return (
                                            <li key={d.departmentId} className="ms-dash-perf__row" data-seal={seal ?? undefined}>
                                                <span className="ms-dash-perf__name"><SealMini seal={seal} />{d.departmentName}</span>
                                                <Sparkline values={d.trend.map((t) => t.score)} labels={d.trend.map((t) => formatMonth(t.month))}
                                                    label={`${d.departmentName} score, last six months`} format={(v) => formatPercent(v)}
                                                    min={0} max={120} width={96} height={28} valueName="Score" />
                                                <span className="ms-dash-perf__score">{d.score === null ? "No data" : formatPercent(d.score)}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )
                    )}
                </section>
            )}
            {showSpending && (
                <section className="ms-panel" aria-labelledby="dash-spend">
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id="dash-spend">Spending this quarter</h2>
                        <Link className="ms-panel__meta ms-dashboard__more" to="/budgets">{quarterLabel(quarter)} budgets</Link>
                    </div>
                    {budgets === null && <p className="ms-dashboard__empty">Loading…</p>}
                    {budgets && "error" in budgets && <p className="ms-dashboard__empty">Could not load budgets: {budgets.error}</p>}
                    {budgets && "data" in budgets && (() => {
                        const { totals, currency } = budgets.data;
                        const money = (v: number) => formatMoney(v, currency);
                        if (totals.budget === 0 && totals.spent === 0 && totals.committed === 0) {
                            return <p className="ms-dashboard__empty">No budgets or spending recorded for this quarter.</p>;
                        }
                        return (
                            <div className="ms-panel__body ms-dash-spend">
                                <dl className="ms-dash-spend__figures">
                                    <div><dt>Budget</dt><dd>{money(totals.budget)}</dd></div>
                                    <div><dt>Spent</dt><dd>{money(totals.spent)}</dd></div>
                                    <div><dt>Committed</dt><dd>{money(totals.committed)}</dd></div>
                                    <div><dt>{totals.remaining < 0 ? "Over budget" : "Remaining"}</dt><dd className={totals.remaining < 0 ? "ms-dash-spend__over" : ""}>{money(Math.abs(totals.remaining))}</dd></div>
                                </dl>
                                <BudgetBar label={`All departments, ${quarterLabel(quarter)}`} budget={totals.budget} spent={totals.spent} committed={totals.committed} format={money} focusable />
                                <Legend items={[{ label: "Spent", tone: "1" }, { label: "Committed", tone: "2" }, { label: "Budget", tone: "track" }]} />
                            </div>
                        );
                    })()}
                </section>
            )}
        </div>
    );
}
