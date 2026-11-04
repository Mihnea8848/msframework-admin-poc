import { useEffect, useMemo, useState } from "react";
import { CircleMinus, PlugZap } from "lucide-react";
import { get } from "../api/client";
import type { PaymentLedger } from "../api/business";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import PageHeader from "../ui/PageHeader";
import { DepartmentSelect, Pager, Tile } from "../ui/BizControls";
import ColumnChart from "../ui/charts/ColumnChart";
import { useDepartments } from "../ui/useDepartments";
import { useReveal } from "../ui/useReveal";
import { formatDate, formatMoney, formatMoneyCompact, formatMonth, presetRange, RANGE_PRESETS } from "../utils/money";
import type { DateRange, RangePreset } from "../utils/money";
import "../ui/field.css";
import "../ui/list.css";
import "../ui/surface.css";
import "../ui/business.css";
import "./payments.css";

const PAGE_SIZE = 25;
const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * The payments ledger: every PAID expense by payment date, with monthly totals. MSFramework
 * records payments when finance marks an approved expense as paid; it does not move money.
 */
export default function Payments() {
    const [now] = useState(() => new Date());
    const departments = useDepartments();
    const [preset, setPreset] = useState<RangePreset | "custom">("6m");
    const [range, setRange] = useState<DateRange>(() => presetRange("6m", now));
    const [departmentId, setDepartmentId] = useState("");
    const [page, setPage] = useState(0);
    const [data, setData] = useState<PaymentLedger | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [version, setVersion] = useState(0);
    const reveal = useReveal(data !== null);

    useEffect(() => {
        if (!range.from || !range.to) return undefined;
        let alive = true;
        const dept = departmentId ? `&departmentId=${departmentId}` : "";
        get<PaymentLedger>(`/api/payments?from=${range.from}&to=${range.to}${dept}&page=${page}&size=${PAGE_SIZE}`)
            .then((d) => { if (alive) { setData(d); setError(null); setLoading(false); } })
            .catch((err) => { if (alive) { setError(messageOf(err)); setLoading(false); } });
        return () => { alive = false; };
    }, [range, departmentId, page, version]);

    function update(next: () => void) {
        setLoading(true);
        setPage(0);
        next();
    }

    const currency = data?.currency ?? "EUR";
    const money = (v: number) => formatMoney(v, currency);
    const months = useMemo(() => (data?.months ?? []).map((m) => ({ key: m.month, label: formatMonth(m.month, true), title: `${formatMonth(m.month)} (${m.count} payment${m.count === 1 ? "" : "s"})`, total: m.total })), [data]);
    const largest = months.reduce((best, m) => (m.total > (best?.total ?? -1) ? m : best), months[0]);

    return (
        <section className="ms-biz ms-payments">
            <PageHeader
                eyebrow="Finance"
                title="Payments"
                count={data?.count ?? null}
                description="Approved expenses that finance has marked as paid, by payment date."
            />

            <div className="ms-filters" role="group" aria-label="Period and department">
                <div className="ms-chips">
                    {RANGE_PRESETS.map((p) => (
                        <button key={p.key} type="button" className="ms-chip" aria-pressed={preset === p.key}
                            onClick={() => update(() => { setPreset(p.key); setRange(presetRange(p.key, now)); })}>
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="pay-from">From</label>
                    <input id="pay-from" className="ms-input" type="date" value={range.from} max={range.to}
                        onChange={(e) => update(() => { setPreset("custom"); setRange((r) => ({ ...r, from: e.target.value })); })} />
                </div>
                <div className="ms-field">
                    <label className="ms-field__label" htmlFor="pay-to">To</label>
                    <input id="pay-to" className="ms-input" type="date" value={range.to} min={range.from}
                        onChange={(e) => update(() => { setPreset("custom"); setRange((r) => ({ ...r, to: e.target.value })); })} />
                </div>
                <DepartmentSelect id="pay-dept" value={departmentId} departments={departments} onChange={(v) => update(() => setDepartmentId(v))} />
            </div>

            {error && (
                <Alert tone="danger" role="alert" className="ms-notice">
                    <span>Could not load payments: {error}</span>
                    <Button size="sm" onClick={() => { setLoading(true); setVersion((v) => v + 1); }}>Retry</Button>
                </Alert>
            )}

            {!data && !error && <div className="ms-empty"><p>Loading payments…</p></div>}

            {data && (
                <>
                    <div className="ms-payments__top">
                        <ul className="ms-tiles" aria-label="Totals">
                            <Tile {...reveal(0)} label="Paid out" value={money(data.totalAmount)} detail={`${formatDate(data.from)} to ${formatDate(data.to)}`} />
                            <Tile {...reveal(1)} label="Payments" value={data.count} detail={largest && largest.total > 0 ? `Most in ${formatMonth(largest.key)}` : "None in this period"} />
                        </ul>
                        <section {...reveal(2, "ms-panel ms-payments__provider")} aria-labelledby="pay-provider">
                            <h2 className="ms-payments__provider-title" id="pay-provider">
                                <PlugZap aria-hidden="true" />
                                Payment provider not connected
                            </h2>
                            <p className="ms-muted">{data.provider.note}</p>
                            <span className="ms-status ms-status--neutral"><CircleMinus aria-hidden="true" />Not connected</span>
                        </section>
                    </div>

                    <section className="ms-panel" aria-labelledby="pay-monthly">
                        <div className="ms-panel__head">
                            <h2 className="ms-panel__title" id="pay-monthly">Paid per month</h2>
                            <span className="ms-panel__meta">By payment date</span>
                        </div>
                        <div className={`ms-panel__body${loading ? " ms-payments__busy" : ""}`}>
                            {data.count === 0 ? <p className="ms-muted">No payments in this period.</p> : (
                                <ColumnChart label="Paid per month" categories={months} series={[{ key: "paid", label: "Paid", tone: "1" }]}
                                    values={months.map((m) => [m.total])} format={money} formatAxis={(v) => formatMoneyCompact(v, currency)} height={200} />
                            )}
                        </div>
                    </section>

                    <section className="ms-panel" aria-labelledby="pay-ledger">
                        <div className="ms-panel__head">
                            <h2 className="ms-panel__title" id="pay-ledger">Ledger</h2>
                            <span className="ms-panel__meta">Newest first</span>
                        </div>
                        {data.items.length === 0 ? (
                            <p className="ms-panel__body ms-muted">No payments recorded in this period. Payments appear here when finance marks an approved expense as paid on the Expenses page.</p>
                        ) : (
                            <ul className={`ms-payments__list${loading ? " ms-payments__busy" : ""}`} aria-busy={loading}>
                                {data.items.map((p) => (
                                    <li key={p.expenseId} className="ms-payments__row">
                                        <div className="ms-payments__main">
                                            <p className="ms-payments__vendor">{p.vendor}</p>
                                            <p className="ms-muted">
                                                {p.departmentName} · {p.categoryName}
                                                {p.description ? ` · ${p.description}` : ""}
                                            </p>
                                            <p className="ms-muted">
                                                {p.paymentReference ? `Ref ${p.paymentReference}` : "No payment reference"}
                                                {p.reference ? ` · Invoice ${p.reference}` : ""}
                                                {p.paidByEmail ? ` · Marked paid by ${p.paidByEmail}` : ""}
                                            </p>
                                        </div>
                                        <div className="ms-payments__side">
                                            <span className="ms-payments__amount">{formatMoney(p.amount, p.currency)}</span>
                                            <time className="ms-muted" dateTime={p.paidOn}>{formatDate(p.paidOn)}</time>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                    <Pager page={data.page} totalPages={data.totalPages} total={data.count} noun={data.count === 1 ? "payment" : "payments"} busy={loading}
                        onPage={(p) => { setLoading(true); setPage(p); }} />
                </>
            )}
        </section>
    );
}
