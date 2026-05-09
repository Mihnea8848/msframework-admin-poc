import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const SPENDING = [3200, 4800, 2900, 5100, 3800, 4200];
const MAX_SPEND = Math.max(...SPENDING);

const MOCK_TRANSACTIONS = [
    { id: "txn-001", type: "out", desc: "SaaS Subscriptions",  amount: 1240.00, date: "2026-05-07", status: "completed" },
    { id: "txn-002", type: "in",  desc: "Client Invoice #3201", amount: 8500.00, date: "2026-05-06", status: "completed" },
    { id: "txn-003", type: "out", desc: "Cloud Infrastructure",amount: 620.50,  date: "2026-05-05", status: "completed" },
    { id: "txn-004", type: "out", desc: "Office Supplies",     amount: 184.20,  date: "2026-05-04", status: "completed" },
    { id: "txn-005", type: "in",  desc: "Client Invoice #3198", amount: 3200.00, date: "2026-05-03", status: "completed" },
    { id: "txn-006", type: "out", desc: "Marketing Campaign",  amount: 2100.00, date: "2026-05-01", status: "pending"   },
    { id: "txn-007", type: "out", desc: "Legal Fees",          amount: 950.00,  date: "2026-04-29", status: "completed" },
    { id: "txn-008", type: "in",  desc: "Refund — Vendor",     amount: 340.00,  date: "2026-04-28", status: "completed" },
    { id: "txn-009", type: "out", desc: "Team Lunch",          amount: 220.00,  date: "2026-04-27", status: "completed" },
    { id: "txn-010", type: "out", desc: "Software Licences",   amount: 580.00,  date: "2026-04-25", status: "failed"    },
];

export default function Payments() {
    const [departments, setDepartments] = useState([]);
    const [form, setForm] = useState({ amount: "", dept: "", memo: "" });
    const [sent, setSent] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetch("/api/departments").then((r) => r.json()).then(setDepartments).catch(() => {});
    }, []);

    async function handleSend(e) {
        e.preventDefault();
        if (!form.amount || !form.dept) return;
        setSending(true);
        await new Promise((r) => setTimeout(r, 800));
        setSending(false);
        setSent(true);
        setForm({ amount: "", dept: "", memo: "" });
        setTimeout(() => setSent(false), 4000);
    }

    const STATUS_PILL = {
        completed: { label: "Completed", color: "var(--success)", bg: "rgba(45,216,129,0.12)" },
        pending:   { label: "Pending",   color: "#f0a832",        bg: "rgba(240,168,50,0.12)" },
        failed:    { label: "Failed",    color: "var(--danger)",  bg: "rgba(255,106,95,0.12)" },
    };

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">Ventures / Payments</div>
                    <div className="workspace-title-row">
                        <h1>Payments</h1>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Proof-of-concept payments dashboard.
                    </p>
                </div>
            </div>

            {/* Balance */}
            <div className="payment-balance-card">
                <div className="payment-balance-label">Available Balance</div>
                <div className="payment-balance-amount">$24,860.00</div>
                <div className="payment-balance-sub">Updated just now · USD</div>
                {/* Decorative glow */}
                <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "var(--accent)", opacity: 0.06, pointerEvents: "none" }} />
            </div>

            <div className="payment-grid">
                {/* Transaction history */}
                <div>
                    <div style={{ marginBottom: 12 }}>
                        <div className="workspace-section-title">Spending (last 6 months)</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80, marginBottom: 16 }}>
                            {MONTHS.map((m, i) => (
                                <div key={m} className="bar-col">
                                    <div
                                        className="bar"
                                        style={{ height: `${(SPENDING[i] / MAX_SPEND) * 100}%` }}
                                        title={`$${SPENDING[i].toLocaleString()}`}
                                    />
                                    <div className="bar-label">{m}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="workspace-section-title">Transaction History</div>
                    <div className="audit-list">
                        {MOCK_TRANSACTIONS.map((tx) => {
                            const pill = STATUS_PILL[tx.status];
                            return (
                                <div key={tx.id} className="audit-row" style={{ alignItems: "center" }}>
                                    <div className="audit-icon" style={tx.type === "in"
                                        ? { background: "rgba(45,216,129,0.12)", color: "var(--success)" }
                                        : { background: "rgba(255,106,95,0.12)", color: "var(--danger)" }
                                    }>
                                        {tx.type === "in" ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                    </div>
                                    <div className="audit-body">
                                        <div className="audit-top">
                                            <span className="audit-actor">{tx.desc}</span>
                                            <span className="audit-time">{tx.date}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: tx.type === "in" ? "var(--success)" : "var(--text)" }}>
                                            {tx.type === "in" ? "+" : "−"}${tx.amount.toFixed(2)}
                                        </span>
                                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: pill.bg, color: pill.color, fontWeight: 600 }}>
                                            {pill.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Quick pay */}
                <form className="payment-form-card" onSubmit={handleSend}>
                    <div className="payment-form-title">Quick Pay</div>
                    <div className="form-field">
                        <label className="form-label">Amount (USD)</label>
                        <input
                            className="form-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={form.amount}
                            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                        />
                    </div>
                    <div className="form-field">
                        <label className="form-label">Recipient (Department)</label>
                        <select
                            className="form-select"
                            value={form.dept}
                            onChange={(e) => setForm((f) => ({ ...f, dept: e.target.value }))}
                        >
                            <option value="">Select department…</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-field">
                        <label className="form-label">Memo (optional)</label>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="e.g. Q2 budget allocation"
                            value={form.memo}
                            onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                        />
                    </div>
                    {sent && (
                        <div className="inline-success" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <CheckCircle size={14} /> Payment sent successfully!
                        </div>
                    )}
                    <button type="submit" className="btn-primary" disabled={sending}>
                        {sending ? "Sending…" : "Send Payment"}
                    </button>
                </form>
            </div>
        </section>
    );
}
