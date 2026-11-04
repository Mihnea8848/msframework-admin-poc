import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, CircleAlert, CircleCheck, Clock3 } from "lucide-react";
import { get } from "../api/client";
import type { DepartmentResponse } from "../api/types";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import PageHeader from "../ui/PageHeader";
import "../ui/field.css";
import "../ui/list.css";
import "../ui/surface.css";
import "./payments.css";

// Everything on this page except the department list is sample data: no payment provider is connected.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const SPENDING = [3200, 4800, 2900, 5100, 3800, 4200];
const MAX_SPEND = Math.max(...SPENDING);

type TxStatus = "completed" | "pending" | "failed";

interface Transaction {
    id: string;
    type: "in" | "out";
    desc: string;
    amount: number;
    date: string;
    status: TxStatus;
}

const MOCK_TRANSACTIONS: Transaction[] = [
    { id: "txn-001", type: "out", desc: "SaaS Subscriptions", amount: 1240.00, date: "2026-05-07", status: "completed" },
    { id: "txn-002", type: "in", desc: "Client Invoice #3201", amount: 8500.00, date: "2026-05-06", status: "completed" },
    { id: "txn-003", type: "out", desc: "Cloud Infrastructure", amount: 620.50, date: "2026-05-05", status: "completed" },
    { id: "txn-004", type: "out", desc: "Office Supplies", amount: 184.20, date: "2026-05-04", status: "completed" },
    { id: "txn-005", type: "in", desc: "Client Invoice #3198", amount: 3200.00, date: "2026-05-03", status: "completed" },
    { id: "txn-006", type: "out", desc: "Marketing Campaign", amount: 2100.00, date: "2026-05-01", status: "pending" },
    { id: "txn-007", type: "out", desc: "Legal Fees", amount: 950.00, date: "2026-04-29", status: "completed" },
    { id: "txn-008", type: "in", desc: "Refund — Vendor", amount: 340.00, date: "2026-04-28", status: "completed" },
    { id: "txn-009", type: "out", desc: "Team Lunch", amount: 220.00, date: "2026-04-27", status: "completed" },
    { id: "txn-010", type: "out", desc: "Software Licences", amount: 580.00, date: "2026-04-25", status: "failed" },
];

const STATUS_PILL = {
    completed: { label: "Completed", tone: "ok", Icon: CircleCheck },
    pending: { label: "Pending", tone: "warn", Icon: Clock3 },
    failed: { label: "Failed", tone: "danger", Icon: CircleAlert },
} as const;

const EMPTY_FORM = { amount: "", dept: "", memo: "" };

/** The spending bars, drawn in a stretched SVG so each height needs no inline style. */
function SpendingChart() {
    const gap = 24;
    const width = 100;
    return (
        <figure className="ms-payments__chart">
            <svg
                className="ms-payments__bars"
                viewBox={`0 0 ${MONTHS.length * (width + gap) - gap} 100`}
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                {SPENDING.map((value, i) => {
                    const h = (value / MAX_SPEND) * 100;
                    return (
                        <rect key={MONTHS[i]} className="ms-payments__bar" x={i * (width + gap)} y={100 - h} width={width} height={h}>
                            <title>{`$${value.toLocaleString()}`}</title>
                        </rect>
                    );
                })}
            </svg>
            <figcaption className="ms-payments__months">
                {MONTHS.map((m, i) => (
                    <span key={m}>
                        {m}
                        <span className="ms-visually-hidden">: ${(SPENDING[i] ?? 0).toLocaleString()}</span>
                    </span>
                ))}
            </figcaption>
        </figure>
    );
}

export default function Payments() {
    const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
    const [form, setForm] = useState(EMPTY_FORM);
    const [sent, setSent] = useState<string | false>(false);
    const [sending, setSending] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const id = useId();

    useEffect(() => {
        get<DepartmentResponse[]>("/api/departments")
            .then((d) => setDepartments(Array.isArray(d) ? d : []))
            .catch(() => setDepartments([]));
        return () => clearTimeout(timer.current);
    }, []);

    async function handleSend(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setFormError(null);
        const amount = Number(form.amount);
        if (!Number.isFinite(amount) || amount <= 0) { setFormError("Enter an amount greater than 0."); return; }
        if (!form.dept) { setFormError("Choose a recipient department."); return; }
        setSending(true);
        await new Promise((r) => setTimeout(r, 600));
        setSending(false);
        const dept = departments.find((d) => String(d.id) === String(form.dept));
        setSent(`Simulated payment of $${amount.toFixed(2)} to ${dept?.name ?? "department"} — no money was moved.`);
        setForm(EMPTY_FORM);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setSent(false), 5000);
    }

    return (
        <section className="ms-payments">
            <PageHeader
                eyebrow="Ventures"
                title="Payments"
                description="Proof-of-concept payments dashboard. Balances and transactions are sample data; no payment provider is connected."
            />

            <div className="ms-cut ms-payments__balance">
                <p className="ms-payments__balance-label">
                    Available Balance <span className="ms-tag">Sample data</span>
                </p>
                <p className="ms-payments__balance-amount">$24,860.00</p>
                <p className="ms-payments__balance-sub">Updated just now · USD</p>
            </div>

            <div className="ms-payments__grid">
                <div className="ms-payments__main">
                    <section className="ms-panel" aria-labelledby={`${id}-spend`}>
                        <div className="ms-panel__head">
                            <h2 className="ms-panel__title" id={`${id}-spend`}>Spending (last 6 months)</h2>
                            <span className="ms-tag">Sample data</span>
                        </div>
                        <SpendingChart />
                    </section>

                    <section className="ms-panel" aria-labelledby={`${id}-tx`}>
                        <div className="ms-panel__head">
                            <h2 className="ms-panel__title" id={`${id}-tx`}>Transaction History</h2>
                            <span className="ms-tag">Sample data</span>
                        </div>
                        <ul className="ms-payments__tx">
                            {MOCK_TRANSACTIONS.map((tx) => {
                                const pill = STATUS_PILL[tx.status];
                                const incoming = tx.type === "in";
                                return (
                                    <li key={tx.id} className={`ms-payments__tx-row ms-payments__tx-row--${tx.type}`}>
                                        <span className="ms-payments__tx-icon" aria-hidden="true">
                                            {incoming ? <ArrowDownLeft /> : <ArrowUpRight />}
                                        </span>
                                        <div className="ms-payments__tx-body">
                                            <p className="ms-payments__tx-desc">{tx.desc}</p>
                                            <p className="ms-payments__tx-date"><time dateTime={tx.date}>{tx.date}</time></p>
                                        </div>
                                        <div className="ms-payments__tx-side">
                                            <span className="ms-payments__tx-amount">
                                                <span className="ms-visually-hidden">{incoming ? "Received " : "Paid "}</span>
                                                {incoming ? "+" : "−"}${tx.amount.toFixed(2)}
                                            </span>
                                            <span className={`ms-status ms-status--${pill.tone}`}>
                                                <pill.Icon aria-hidden="true" />
                                                {pill.label}
                                            </span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                </div>

                <form className="ms-panel ms-payments__form" onSubmit={handleSend} aria-labelledby={`${id}-pay`}>
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id={`${id}-pay`}>Quick Pay</h2>
                        <span className="ms-tag">Demo</span>
                    </div>
                    <div className="ms-payments__fields">
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor={`${id}-amount`}>Amount (USD)</label>
                            <input
                                id={`${id}-amount`}
                                className="ms-input"
                                type="number"
                                min="0.01"
                                step="0.01"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={form.amount}
                                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                            />
                        </div>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor={`${id}-dept`}>Recipient (Department)</label>
                            <div className="ms-select">
                                <select
                                    id={`${id}-dept`}
                                    className="ms-input"
                                    value={form.dept}
                                    onChange={(e) => setForm((f) => ({ ...f, dept: e.target.value }))}
                                >
                                    <option value="">Select department…</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor={`${id}-memo`}>Memo (optional)</label>
                            <input
                                id={`${id}-memo`}
                                className="ms-input"
                                type="text"
                                placeholder="e.g. Q2 budget allocation"
                                value={form.memo}
                                onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                            />
                        </div>
                        {formError && <Alert tone="danger" role="alert">{formError}</Alert>}
                        {sent && <Alert tone="ok" role="status">{sent}</Alert>}
                        <Button type="submit" variant="primary" full disabled={sending}>
                            {sending ? "Sending…" : "Simulate Payment"}
                        </Button>
                    </div>
                </form>
            </div>
        </section>
    );
}
