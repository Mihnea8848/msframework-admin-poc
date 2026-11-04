import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, primaryRole } from "../auth/permissions";
import { get, post } from "../api/client";
import type { Permission } from "../api/types";
import { downloadText, toCSV } from "../utils/csv";
import type { CSVColumn } from "../utils/csv";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import PageHeader from "../ui/PageHeader";
import "../ui/field.css";
import "../ui/surface.css";
import "./data-transfer.css";

type Row = Record<string, unknown>;
type EntityKey = "users" | "departments" | "audit";

interface EntityConfig {
    label: string;
    permission: Permission;
    url: string;
    columns: CSVColumn<Row>[];
}

const ENTITY_OPTIONS: Record<EntityKey, EntityConfig> = {
    users: {
        label: "Users",
        permission: "USER_READ",
        url: "/api/users",
        columns: [
            { key: "id", label: "ID" },
            { key: "fullName", label: "Full Name" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "role", label: "Role", get: (u) => primaryRole(u as { roles?: string[] }) },
            { key: "status", label: "Status" },
            { key: "departmentName", label: "Department" },
            { key: "createdAt", label: "Created" },
        ],
    },
    departments: {
        label: "Departments",
        permission: "DEPARTMENT_READ",
        url: "/api/departments",
        columns: [
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
            { key: "color", label: "Color" },
            { key: "memberCount", label: "Members" },
        ],
    },
    audit: {
        label: "Audit log",
        permission: "AUDIT_READ",
        url: "/api/audit?limit=500",
        columns: [
            { key: "createdAt", label: "Time" },
            { key: "eventType", label: "Event" },
            { key: "actorEmail", label: "Actor" },
            { key: "description", label: "Description" },
        ],
    },
};

export default function ExportData() {
    const { user } = useAuth();
    const available = useMemo(
        () => (Object.entries(ENTITY_OPTIONS) as [EntityKey, EntityConfig][]).filter(([, cfg]) => hasPermission(user, cfg.permission)),
        [user]
    );

    const [entity, setEntity] = useState<EntityKey>(() => available[0]?.[0] || "users");
    const [data, setData] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCols, setSelectedCols] = useState(() => ENTITY_OPTIONS[entity].columns.map((c) => c.key));
    const [message, setMessage] = useState<string | null>(null);

    const cfg = ENTITY_OPTIONS[entity];

    useEffect(() => {
        let alive = true;
        get<Row[]>(ENTITY_OPTIONS[entity].url)
            .then((result) => {
                if (!alive) return;
                setData(Array.isArray(result) ? result : []);
                setError(null);
            })
            .catch((err: unknown) => {
                if (!alive) return;
                setData([]);
                setError(err instanceof Error ? err.message : String(err));
            })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [entity]);

    function changeEntity(next: EntityKey) {
        setEntity(next);
        setLoading(true);
        setMessage(null);
        setSelectedCols(ENTITY_OPTIONS[next].columns.map((c) => c.key));
    }

    function toggleCol(key: string) {
        setSelectedCols((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    }

    const fileName = `${entity}-${new Date().toISOString().slice(0, 10)}.csv`;

    function handleDownload() {
        const columns = cfg.columns.filter((c) => selectedCols.includes(c.key));
        downloadText(toCSV(data, columns), fileName);
        setMessage(`Downloaded ${fileName} (${data.length} rows).`);
        post("/api/audit/event", {
            eventType: "export_generated",
            description: `Exported ${cfg.label.toLowerCase()} CSV (${data.length} rows, ${columns.length} columns)`,
        }).catch(() => {});
    }

    if (available.length === 0) {
        return (
            <section className="ms-transfer">
                <PageHeader eyebrow="Operations" title="Export Data" description="You don't have access to any dataset that can be exported." />
            </section>
        );
    }

    return (
        <section className="ms-transfer">
            <PageHeader eyebrow="Operations" title="Export Data" description="Download a CSV file generated from live system data." />

            <div className="ms-field ms-transfer__entity">
                <label className="ms-field__label" htmlFor="export-entity">What would you like to export?</label>
                <div className="ms-select">
                    <select id="export-entity" className="ms-input" value={entity} onChange={(e) => changeEntity(e.target.value as EntityKey)}>
                        {available.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                </div>
            </div>

            {error && <Alert tone="danger" role="alert" className="ms-transfer__alert">Could not load {cfg.label.toLowerCase()}: {error}</Alert>}

            <fieldset className="ms-panel ms-transfer__columns">
                <legend className="ms-transfer__legend">Columns to include</legend>
                <div className="ms-transfer__checks">
                    {cfg.columns.map((col) => (
                        <label key={col.key} className="ms-transfer__check">
                            <input type="checkbox" checked={selectedCols.includes(col.key)} onChange={() => toggleCol(col.key)} />
                            <span>{col.label}</span>
                            <code className="ms-transfer__key">{col.key}</code>
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="ms-cut ms-transfer__summary">
                <div>
                    <p className="ms-transfer__summary-title">
                        {loading ? "Loading…" : `${data.length} row${data.length !== 1 ? "s" : ""} · ${selectedCols.length} column${selectedCols.length !== 1 ? "s" : ""}`}
                    </p>
                    <p className="ms-transfer__summary-sub">
                        File: <code className="ms-transfer__file">{fileName}</code> · UTF-8, opens in Excel
                    </p>
                </div>
                <Button
                    variant="primary"
                    icon={<Download aria-hidden="true" />}
                    onClick={handleDownload}
                    disabled={loading || data.length === 0 || selectedCols.length === 0}
                >
                    Download CSV
                </Button>
            </div>
            {message && <Alert tone="ok" role="status" className="ms-transfer__alert">{message}</Alert>}
        </section>
    );
}
