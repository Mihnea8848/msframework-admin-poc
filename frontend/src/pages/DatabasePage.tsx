import { useCallback, useEffect, useId, useState } from "react";
import { ChevronDown, Database, RefreshCw } from "lucide-react";
import { get } from "../api/client";
import type { TableInfo } from "../api/types";
import { formatBytes } from "../utils/format";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import PageHeader from "../ui/PageHeader";
import "../ui/list.css";
import "../ui/surface.css";
import "./database.css";

const DESCRIPTIONS: Record<string, string> = {
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

function DbPanel({ table, defaultOpen }: { table: TableInfo; defaultOpen: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    const bodyId = useId();
    const description = DESCRIPTIONS[table.name];

    return (
        <li className="ms-panel ms-database__table">
            <button
                type="button"
                className="ms-database__head"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls={bodyId}
            >
                <span className="ms-database__icon" aria-hidden="true"><Database /></span>
                <span className="ms-database__name-wrap">
                    <span className="ms-database__name">{table.name}</span>
                    {description && <span className="ms-database__desc">{description}</span>}
                </span>
                <span className="ms-database__stats">
                    <span>{table.rowCount.toLocaleString()} row{table.rowCount === 1 ? "" : "s"}</span>
                    <span>{formatBytes(table.sizeBytes)}</span>
                    <span>{table.columns.length} column{table.columns.length === 1 ? "" : "s"}</span>
                </span>
                <ChevronDown className="ms-database__chevron" aria-hidden="true" />
            </button>
            {open && (
                <table className="ms-table ms-database__columns" id={bodyId}>
                    <thead>
                        <tr>
                            <th scope="col">Column</th>
                            <th scope="col">Type</th>
                            <th scope="col">Null</th>
                        </tr>
                    </thead>
                    <tbody>
                        {table.columns.map((col) => (
                            <tr key={col.name}>
                                <td className="ms-database__col">{col.name}</td>
                                <td><span className="ms-tag">{col.type}</span></td>
                                <td className="ms-table__muted">{col.nullable ? "nullable" : "not null"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </li>
    );
}

export default function DatabasePage() {
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await get<TableInfo[]>("/api/database/tables");
            setTables(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);

    return (
        <section className="ms-database">
            <PageHeader
                eyebrow="General"
                title="Database"
                count={tables.length || undefined}
                description={tables.length ? `Live schema of the application database · ${totalRows.toLocaleString()} rows in total.` : "Live schema of the application database."}
                actions={
                    <Button size="sm" icon={<RefreshCw aria-hidden="true" />} onClick={load} disabled={loading}>Refresh</Button>
                }
            />

            {error && <Alert tone="danger" role="alert" className="ms-notice">Could not read the database schema: {error}</Alert>}
            {loading && tables.length === 0 && <div className="ms-empty"><p>Reading schema…</p></div>}

            <ul className="ms-database__list">
                {tables.map((table, i) => (
                    <DbPanel key={table.name} table={table} defaultOpen={i === 0} />
                ))}
            </ul>
        </section>
    );
}
