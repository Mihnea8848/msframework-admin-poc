import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { get } from "../api/client";
import type { ReportExportType, ReportOverview } from "../api/business";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import PageHeader from "../ui/PageHeader";
import { Tile } from "../ui/BizControls";
import BarList from "../ui/charts/BarList";
import BudgetBar from "../ui/charts/BudgetBar";
import ColumnChart from "../ui/charts/ColumnChart";
import { SealMini } from "../ui/seal/Seal";
import { sealOf } from "../ui/useDepartments";
import { useReveal } from "../ui/useReveal";
import { formatMoney, formatMoneyCompact, formatMonth, formatPercent, presetRange, RANGE_PRESETS } from "../utils/money";
import type { DateRange, RangePreset } from "../utils/money";
import "../ui/field.css";
import "../ui/list.css";
import "../ui/surface.css";
import "../ui/business.css";
import "./reports.css";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

const EXPORTS: readonly { type: ReportExportType; label: string; finance: boolean }[] = [
    { type: "budgets", label: "Budgets CSV", finance: false },
    { type: "performance", label: "Performance CSV", finance: false },
    { type: "expenses", label: "Expenses CSV", finance: true },
];

export default function Reports() {
    const { user } = useAuth();
    const canFinance = hasPermission(user, "FINANCE_READ");
    const [now] = useState(() => new Date());
    const [preset, setPreset] = useState<RangePreset | "custom">("6m");
    const [range, setRange] = useState<DateRange>(() => presetRange("6m", now));
    const [data, setData] = useState<ReportOverview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [version, setVersion] = useState(0);
    const reveal = useReveal(data !== null);

    useEffect(() => {
        if (!range.from || !range.to) return undefined;
        let alive = true;
        get<ReportOverview>(`/api/reports/overview?from=${range.from}&to=${range.to}`)
            .then((d) => { if (alive) { setData(d); setError(null); setLoading(false); } })
            .catch((err) => { if (alive) { setError(messageOf(err)); setLoading(false); } });
        return () => { alive = false; };
    }, [range, version]);

    function choose(p: RangePreset) {
        setPreset(p);
        setLoading(true);
        setRange(presetRange(p, now));
    }

    function setCustom(field: keyof DateRange, value: string) {
        setPreset("custom");
        setLoading(true);
        setRange((r) => ({ ...r, [field]: value }));
    }

    const currency = data?.currency ?? "EUR";
    const money = (v: number) => formatMoney(v, currency);
    const compact = (v: number) => formatMoneyCompact(v, currency);

    const monthly = useMemo(() => (data?.monthlySpend ?? []).map((m) => ({ key: m.month, label: formatMonth(m.month, true), title: formatMonth(m.month), values: [m.spent, m.committed] })), [data]);
    const exports = EXPORTS.filter((e) => !e.finance || canFinance);
    const exportQuery = `from=${range.from}&to=${range.to}`;
    const totals = data?.totals;

    return (
        <section className="ms-biz ms-reports">
            <PageHeader
                eyebrow="Performance"
                title="Reports"
                description="Spending, budgets, performance and headcount for a period, from the live records."
                actions={
                    <div className="ms-reports__exports">
                        {exports.map((e) => (
                            <a key={e.type} className="ms-btn ms-btn--secondary ms-btn--sm" href={`/api/reports/export.csv?type=${e.type}&${exportQuery}`} download>
                                <span className="ms-btn__face"><Download aria-hidden="true" />{e.label}</span>
                            </a>
                        ))}
                    </div>
                }
            />

            <div className="ms-filters" role="group" aria-label="Period">
                <div className="ms-chips">
                    {RANGE_PRESETS.map((p) => (
                        <button key={p.key} type="button" className="ms-chip" aria-pressed={preset === p.key} onClick={() => choose(p.key)}>
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="rep-from">From</label>
                    <input id="rep-from" className="ms-input" type="date" value={range.from} max={range.to} onChange={(e) => setCustom("from", e.target.value)} />
                </div>
                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="rep-to">To</label>
                    <input id="rep-to" className="ms-input" type="date" value={range.to} min={range.from} onChange={(e) => setCustom("to", e.target.value)} />
                </div>
            </div>

            {error && (
                <Alert tone="danger" role="alert" className="ms-notice">
                    <span>Could not load the report: {error}</span>
                    <Button size="sm" onClick={() => setVersion((v) => v + 1)}>Retry</Button>
                </Alert>
            )}

            {!data && !error && <div className="ms-empty"><p>Loading the report…</p></div>}

            {data && totals && (
                <div className={`ms-biz ms-reports__body${loading ? " ms-reports__body--busy" : ""}`} aria-busy={loading}>
                    <ul className="ms-tiles" aria-label="Totals">
                        <Tile {...reveal(0)} label="Budget" value={money(totals.budget)} detail="Prorated to the period" />
                        <Tile {...reveal(1)} label="Spent" value={money(totals.spent)} detail="Approved and paid" />
                        <Tile {...reveal(2)} label="Committed" value={money(totals.committed)} detail="Submitted, awaiting approval" />
                        <Tile {...reveal(3)} label="Remaining" value={money(totals.remaining)} tone={totals.remaining < 0 ? "danger" : undefined}
                            detail={totals.remaining < 0 ? "Over budget" : "Budget left"} />
                        <Tile {...reveal(4)} label="Active people" value={totals.activeHeadcount} detail="Active accounts today" />
                    </ul>

                    <div className="ms-reports__grid">
                        <section className="ms-panel" aria-labelledby="rep-monthly">
                            <div className="ms-panel__head"><h2 className="ms-panel__title" id="rep-monthly">Monthly spend</h2></div>
                            <div className="ms-panel__body">
                                {monthly.every((m) => m.values.every((v) => v === 0))
                                    ? <p className="ms-muted">Nothing was spent in this period.</p>
                                    : <ColumnChart label="Monthly spend, spent and committed" stacked format={money} formatAxis={compact}
                                        categories={monthly}
                                        series={[{ key: "spent", label: "Spent", tone: "1" }, { key: "committed", label: "Committed", tone: "2" }]}
                                        values={monthly.map((m) => m.values)} />}
                            </div>
                        </section>

                        <section className="ms-panel" aria-labelledby="rep-dept">
                            <div className="ms-panel__head"><h2 className="ms-panel__title" id="rep-dept">Spend by department</h2></div>
                            <div className="ms-panel__body">
                                {data.spendByDepartment.length === 0 ? <p className="ms-muted">No spending in this period.</p> : (
                                    <BarList label="Spend by department" format={money} shareOf="of all spending"
                                        items={data.spendByDepartment.map((d) => ({
                                            key: d.departmentId, label: d.departmentName, value: d.spent, seal: sealOf(d.departmentColor),
                                            lead: <SealMini seal={sealOf(d.departmentColor)} />,
                                        }))} />
                                )}
                            </div>
                        </section>

                        <section className="ms-panel" aria-labelledby="rep-bvs">
                            <div className="ms-panel__head">
                                <h2 className="ms-panel__title" id="rep-bvs">Budget vs spend</h2>
                                <span className="ms-panel__meta">By department</span>
                            </div>
                            <div className="ms-panel__body">
                                {data.budgetVsSpend.length === 0 ? <p className="ms-muted">No budgets or spending in this period.</p> : (
                                    <ul className="ms-reports__bvs">
                                        {data.budgetVsSpend.map((row) => (
                                            <li key={row.departmentId} data-seal={sealOf(row.departmentColor) ?? undefined}>
                                                <p className="ms-reports__bvs-head">
                                                    <span className="ms-reports__bvs-name"><SealMini seal={sealOf(row.departmentColor)} />{row.departmentName}</span>
                                                    <span className="ms-muted">
                                                        {money(row.spent)} of {money(row.budget)}
                                                        {row.utilisation !== null ? ` · ${formatPercent(row.utilisation)}` : " · no budget"}
                                                    </span>
                                                </p>
                                                <BudgetBar label={row.departmentName} budget={row.budget} spent={row.spent} committed={row.committed} format={money} focusable />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <ul className="ms-chart-legend ms-reports__legend">
                                    <li><i className="ms-chart-key" aria-hidden="true" />Spent</li>
                                    <li><i className="ms-chart-key ms-chart-key--2" aria-hidden="true" />Committed</li>
                                    <li><i className="ms-chart-key ms-chart-key--track" aria-hidden="true" />Budget</li>
                                    <li><i className="ms-chart-key ms-chart-key--over" aria-hidden="true" />Over budget</li>
                                </ul>
                            </div>
                        </section>

                        <section className="ms-panel" aria-labelledby="rep-cat">
                            <div className="ms-panel__head"><h2 className="ms-panel__title" id="rep-cat">Spend by category</h2></div>
                            <div className="ms-panel__body">
                                {data.spendByCategory.length === 0 ? <p className="ms-muted">No spending in this period.</p> : (
                                    <BarList label="Spend by category" format={money} shareOf="of all spending"
                                        items={data.spendByCategory.map((c) => ({ key: c.categoryId, label: c.categoryName, value: c.spent }))} />
                                )}
                            </div>
                        </section>

                        <section className="ms-panel" aria-labelledby="rep-perf">
                            <div className="ms-panel__head">
                                <h2 className="ms-panel__title" id="rep-perf">Performance by department</h2>
                                <span className="ms-panel__meta">Q{data.performanceQuarter} {data.performanceYear}</span>
                            </div>
                            <div className="ms-panel__body">
                                {data.performance.every((p) => p.score === null) ? <p className="ms-muted">No goal has check-ins in this quarter yet.</p> : (
                                    <BarList label="Performance score by department" format={(v) => formatPercent(v)} max={100} noShare
                                        items={data.performance.filter((p) => p.score !== null).map((p) => ({
                                            key: p.departmentId, label: p.departmentName, value: p.score ?? 0, seal: sealOf(p.departmentColor),
                                            lead: <SealMini seal={sealOf(p.departmentColor)} />,
                                        }))} />
                                )}
                                <p className="ms-muted ms-reports__note">Weighted attainment of each department's goals, from baseline toward target.</p>
                            </div>
                        </section>

                        <section className="ms-panel" aria-labelledby="rep-head">
                            <div className="ms-panel__head">
                                <h2 className="ms-panel__title" id="rep-head">Headcount</h2>
                                <span className="ms-panel__meta">Today</span>
                            </div>
                            <div className="ms-table-wrap">
                                <table className="ms-table">
                                    <thead>
                                        <tr><th scope="col">Department</th><th scope="col" className="ms-num">Active</th><th scope="col" className="ms-num">Total</th></tr>
                                    </thead>
                                    <tbody>
                                        {data.headcount.map((h) => (
                                            <tr key={h.departmentId ?? "none"}>
                                                <td>{h.departmentName ?? "No department"}</td>
                                                <td className="ms-num">{h.active}</td>
                                                <td className="ms-num ms-table__muted">{h.total}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </section>
    );
}
