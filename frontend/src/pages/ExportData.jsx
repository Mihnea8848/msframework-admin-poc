import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission, primaryRole } from "../auth/permissions";
import { get, post } from "../api/client";
import { downloadText, toCSV } from "../utils/csv";
import PageHeader from "../ui/PageHeader.jsx";

const ENTITY_OPTIONS = {
    users: {
        label: "Users",
        permission: "USER_READ",
        url: "/api/users",
        columns: [
            { key: "id", label: "ID" },
            { key: "fullName", label: "Full Name" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "role", label: "Role", get: (u) => primaryRole(u) },
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
        () => Object.entries(ENTITY_OPTIONS).filter(([, cfg]) => hasPermission(user, cfg.permission)),
        [user]
    );

    const [entity, setEntity] = useState(() => available[0]?.[0] || "users");
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCols, setSelectedCols] = useState(() => ENTITY_OPTIONS[entity].columns.map((c) => c.key));
    const [message, setMessage] = useState(null);

    const cfg = ENTITY_OPTIONS[entity];

    useEffect(() => {
        let alive = true;
        get(ENTITY_OPTIONS[entity].url)
            .then((result) => {
                if (!alive) return;
                setData(Array.isArray(result) ? result : []);
                setError(null);
            })
            .catch((err) => {
                if (!alive) return;
                setData([]);
                setError(err.message);
            })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [entity]);

    function changeEntity(next) {
        setEntity(next);
        setLoading(true);
        setMessage(null);
        setSelectedCols(ENTITY_OPTIONS[next].columns.map((c) => c.key));
    }

    function toggleCol(key) {
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
            <section className="workspace">
                <PageHeader breadcrumb="Ventures / Export Data" title="Export Data" subtitle="You don't have access to any dataset that can be exported." />
            </section>
        );
    }

    return (
        <section className="workspace">
            <PageHeader breadcrumb="Ventures / Export Data" title="Export Data" subtitle="Download a CSV file generated from live system data." />

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <label htmlFor="export-entity" style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-strong)" }}>What would you like to export?</label>
                <select id="export-entity" className="select-entity" value={entity} onChange={(e) => changeEntity(e.target.value)}>
                    {available.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>

            {error && <div className="inline-error page-banner" role="alert">Could not load {cfg.label.toLowerCase()}: {error}</div>}

            <div className="workspace-section-title" style={{ marginBottom: 8 }}>Columns to include</div>
            <div className="export-options">
                {cfg.columns.map((col) => (
                    <label key={col.key} className="export-option-row">
                        <input type="checkbox" checked={selectedCols.includes(col.key)} onChange={() => toggleCol(col.key)} />
                        <span>{col.label}</span>
                        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace", marginLeft: "auto" }}>{col.key}</span>
                    </label>
                ))}
            </div>

            <div style={{ marginTop: 20, padding: "16px 20px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--panel)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                        {loading ? "Loading…" : `${data.length} row${data.length !== 1 ? "s" : ""} · ${selectedCols.length} column${selectedCols.length !== 1 ? "s" : ""}`}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        File: <code style={{ color: "var(--accent)", fontSize: 11 }}>{fileName}</code> · UTF-8, opens in Excel
                    </div>
                </div>
                <button
                    type="button"
                    className="btn-primary"
                    onClick={handleDownload}
                    disabled={loading || data.length === 0 || selectedCols.length === 0}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                    <Download size={14} />
                    Download CSV
                </button>
            </div>
            {message && <div className="inline-success" style={{ marginTop: 12 }}>{message}</div>}
        </section>
    );
}
