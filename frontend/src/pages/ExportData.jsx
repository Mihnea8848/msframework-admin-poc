import { useEffect, useState } from "react";
import { Download } from "lucide-react";

const ENTITY_OPTIONS = {
    users: {
        label: "Users",
        fetchData: () => fetch("/api/users", { credentials: "include" }).then((r) => r.json()),
        columns: [
            { key: "fullName",    label: "Full Name"   },
            { key: "email",       label: "Email"       },
            { key: "role",        label: "Role"        },
            { key: "status",      label: "Status"      },
            { key: "phoneNumber", label: "Phone"       },
        ],
    },
    departments: {
        label: "Departments",
        fetchData: () => fetch("/api/departments", { credentials: "include" }).then((r) => r.json()),
        columns: [
            { key: "id",         label: "ID"       },
            { key: "name",       label: "Name"     },
            { key: "colorClass", label: "Color"    },
        ],
    },
};

function toCSV(rows, selectedCols, colDefs) {
    const active = colDefs.filter((c) => selectedCols.includes(c.key));
    const header = active.map((c) => c.label).join(",");
    const lines = rows.map((row) =>
        active.map((c) => {
            const val = row[c.key] ?? "";
            return String(val).includes(",") ? `"${val}"` : val;
        }).join(",")
    );
    return [header, ...lines].join("\n");
}

function download(content, filename) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export default function ExportData() {
    const [entity, setEntity] = useState("users");
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedCols, setSelectedCols] = useState(ENTITY_OPTIONS.users.columns.map((c) => c.key));

    const cfg = ENTITY_OPTIONS[entity];

    useEffect(() => {
        const entityCfg = ENTITY_OPTIONS[entity];
        const cols = entityCfg.columns.map((c) => c.key);
        entityCfg.fetchData()
            .then((result) => {
                setData(result);
                setSelectedCols(cols);
                setLoading(false);
            })
            .catch(() => {
                setData([]);
                setSelectedCols(cols);
                setLoading(false);
            });
    }, [entity]);

    function toggleCol(key) {
        setSelectedCols((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    }

    function handleDownload() {
        const csv = toCSV(data, selectedCols, cfg.columns);
        const ts = new Date().toISOString().slice(0, 10);
        download(csv, `${entity}-${ts}.csv`);
        fetch("/api/audit/event", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventType: "export_generated", description: `Exported ${entity} CSV (${data.length} rows)` }),
        }).catch(() => {});
    }

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">Ventures / Export Data</div>
                    <div className="workspace-title-row">
                        <h1>Export Data</h1>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Download a CSV file from live system data.
                    </p>
                </div>
            </div>

            {/* Entity selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-strong)" }}>What would you like to export?</div>
                <select
                    className="select-entity"
                    value={entity}
                    onChange={(e) => setEntity(e.target.value)}
                >
                    {Object.entries(ENTITY_OPTIONS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
            </div>

            {/* Column picker */}
            <div className="workspace-section-title" style={{ marginBottom: 8 }}>Columns to include</div>
            <div className="export-options">
                {cfg.columns.map((col) => (
                    <label key={col.key} className="export-option-row">
                        <input
                            type="checkbox"
                            checked={selectedCols.includes(col.key)}
                            onChange={() => toggleCol(col.key)}
                        />
                        <span>{col.label}</span>
                        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace", marginLeft: "auto" }}>{col.key}</span>
                    </label>
                ))}
            </div>

            {/* Date range (UI only) */}
            <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-strong)" }}>Date range</div>
                <input type="date" className="form-input" style={{ width: 160 }} defaultValue="2026-01-01" />
                <span style={{ color: "var(--muted)", fontSize: 13 }}>to</span>
                <input type="date" className="form-input" style={{ width: 160 }} defaultValue="2026-05-09" />
            </div>

            {/* Summary + download */}
            <div style={{ marginTop: 20, padding: "16px 20px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--panel)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                        {loading ? "Loading…" : `${data.length} row${data.length !== 1 ? "s" : ""} · ${selectedCols.length} column${selectedCols.length !== 1 ? "s" : ""}`}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        File: <code style={{ color: "var(--accent)", fontSize: 11 }}>{entity}-{new Date().toISOString().slice(0, 10)}.csv</code>
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
        </section>
    );
}
