import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Database, RefreshCw } from "lucide-react";
import { get } from "../api/client.js";
import { formatBytes } from "../utils/format.js";
import PageHeader from "../ui/PageHeader.jsx";

const DESCRIPTIONS = {
    users: "Accounts that can sign in",
    departments: "Organisational units",
    role: "Built-in roles",
    role_permissions: "Permissions granted to each role",
    user_roles: "Which role each user has",
    audit_events: "Audit log shown on the Notifications page",
    service_connections: "Integration status on the Connections page",
    webhooks: "Registered webhook endpoints",
    api_keys: "Issued API keys (hashes only)",
    org_settings: "Organisation settings (timezone, world clocks)",
    password_reset_tokens: "Pending password reset links (hashes only)",
};

function DbPanel({ table, defaultOpen }) {
    const [open, setOpen] = useState(defaultOpen ?? false);

    return (
        <div className="db-panel">
            <div
                className="db-panel-header"
                onClick={() => setOpen((o) => !o)}
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
            >
                <div style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--panel-muted)", border: "1px solid var(--line)", color: "var(--muted-strong)", flexShrink: 0 }}>
                    <Database size={15} />
                </div>
                <div style={{ minWidth: 0 }}>
                    <span className="db-panel-title">{table.name}</span>
                    {DESCRIPTIONS[table.name] && <div className="muted-note">{DESCRIPTIONS[table.name]}</div>}
                </div>
                <div className="db-panel-stats">
                    <span>{table.rowCount.toLocaleString()} row{table.rowCount === 1 ? "" : "s"}</span>
                    <span>{formatBytes(table.sizeBytes)}</span>
                    <span>{table.columns.length} column{table.columns.length === 1 ? "" : "s"}</span>
                </div>
                <ChevronDown size={16} style={{ color: "var(--muted)", transition: "transform 200ms ease", transform: open ? "rotate(180deg)" : "none" }} />
            </div>
            {open && (
                <div className="db-panel-body">
                    {table.columns.map((col) => (
                        <div key={col.name} className="db-schema-row">
                            <span className="db-col-name">{col.name}</span>
                            <span className="db-type-badge">{col.type}</span>
                            <span className="db-col-nullable">{col.nullable ? "nullable" : "not null"}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function DatabasePage() {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await get("/api/database/tables");
            setTables(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);

    return (
        <section className="workspace">
            <PageHeader
                breadcrumb="General / Database"
                title="Database"
                count={tables.length || undefined}
                subtitle={tables.length ? `Live schema of the application database · ${totalRows.toLocaleString()} rows in total.` : "Live schema of the application database."}
                actions={
                    <button type="button" className="btn-secondary btn-small" onClick={load} disabled={loading}>
                        <RefreshCw size={13} /> Refresh
                    </button>
                }
            />

            {error && <div className="inline-error page-banner" role="alert">Could not read the database schema: {error}</div>}
            {loading && tables.length === 0 && <div className="empty-state">Reading schema…</div>}

            <div className="workspace-section">
                {tables.map((table, i) => (
                    <DbPanel key={table.name} table={table} defaultOpen={i === 0} />
                ))}
            </div>
        </section>
    );
}
