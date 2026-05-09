import { useRef, useState } from "react";
import { ChevronDown, Upload } from "lucide-react";

const ENTITY_CONFIGS = {
    users: {
        label: "Users",
        expectedCols: ["full_name", "email", "role", "status", "department"],
        example: "full_name,email,role,status,department\nJane Smith,jane@co.com,MEMBER,active,Engineering\nBob Lee,bob@co.com,ADMIN,active,",
    },
    departments: {
        label: "Departments",
        expectedCols: ["name", "color_class"],
        example: "name,color_class\nEngineering,avatar-azure\nMarketing,avatar-rose",
    },
};

function parseCSV(text) {
    const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((l) => {
        const vals = l.split(",").map((v) => v.trim());
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] || ""]));
    });
    return { headers, rows };
}

export default function ImportData() {
    const [entity, setEntity] = useState("users");
    const [dragOver, setDragOver] = useState(false);
    const [parsed, setParsed] = useState(null);
    const [imported, setImported] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const fileRef = useRef(null);

    const cfg = ENTITY_CONFIGS[entity];

    function readFile(file) {
        if (!file || !file.name.endsWith(".csv")) return;
        setImported(false);
        const reader = new FileReader();
        reader.onload = (e) => setParsed(parseCSV(e.target.result));
        reader.readAsText(file);
    }

    function handleDrop(e) {
        e.preventDefault();
        setDragOver(false);
        readFile(e.dataTransfer.files[0]);
    }

    function handleImport() {
        setImported(true);
    }

    const missingCols = cfg.expectedCols.filter((c) => !parsed?.headers.includes(c));
    const extraCols   = parsed?.headers.filter((h) => !cfg.expectedCols.includes(h)) || [];
    const validRows   = parsed?.rows.filter((r) => cfg.expectedCols.every((c) => !["full_name", "email", "name"].includes(c) || r[c])) || [];

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">Ventures / Import Data</div>
                    <div className="workspace-title-row">
                        <h1>Import Data</h1>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Upload a CSV to import records into the system.
                    </p>
                </div>
            </div>

            {/* Entity selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-strong)" }}>What would you like to import?</div>
                <div style={{ position: "relative" }}>
                    <select
                        className="select-entity"
                        value={entity}
                        onChange={(e) => { setEntity(e.target.value); setParsed(null); setImported(false); }}
                    >
                        {Object.entries(ENTITY_CONFIGS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Upload zone */}
            <div
                className={`upload-zone${dragOver ? " drag-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
            >
                <div className="upload-zone-icon">
                    <Upload size={22} />
                </div>
                <div className="upload-zone-title">Drop your CSV here or click to browse</div>
                <div className="upload-zone-sub">Accepts .csv files · {cfg.label} format</div>
                <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    style={{ display: "none" }}
                    onChange={(e) => readFile(e.target.files[0])}
                />
            </div>

            {/* Format guide */}
            <div style={{ marginTop: 10, marginBottom: 16 }}>
                <button type="button" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)", cursor: "pointer", background: "none", border: "none" }} onClick={() => setGuideOpen((o) => !o)}>
                    <ChevronDown size={14} style={{ transform: guideOpen ? "rotate(180deg)" : "none", transition: "transform 180ms" }} />
                    CSV format guide
                </button>
                {guideOpen && (
                    <div style={{ marginTop: 8, padding: "12px 14px", borderRadius: 10, background: "var(--panel)", border: "1px solid var(--line)", fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap", color: "var(--muted-strong)" }}>
                        {cfg.example}
                    </div>
                )}
            </div>

            {/* Preview */}
            {parsed && (
                <div>
                    {/* Column mapping */}
                    <div style={{ marginBottom: 14, padding: "12px 16px", borderRadius: 12, background: "var(--panel)", border: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Column Mapping</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {cfg.expectedCols.map((c) => (
                                <span key={c} style={{
                                    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                                    background: parsed.headers.includes(c) ? "rgba(45,216,129,0.12)" : "rgba(255,106,95,0.12)",
                                    color: parsed.headers.includes(c) ? "var(--success)" : "var(--danger)",
                                    border: `1px solid ${parsed.headers.includes(c) ? "rgba(45,216,129,0.3)" : "rgba(255,106,95,0.3)"}`,
                                }}>
                                    {c} {parsed.headers.includes(c) ? "✓" : "✗ missing"}
                                </span>
                            ))}
                            {extraCols.map((c) => (
                                <span key={c} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "rgba(240,168,50,0.12)", color: "#f0a832", border: "1px solid rgba(240,168,50,0.3)" }}>
                                    {c} (extra)
                                </span>
                            ))}
                        </div>
                        {missingCols.length > 0 && (
                            <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>
                                Missing required columns: {missingCols.join(", ")}
                            </div>
                        )}
                    </div>

                    {/* Table preview */}
                    <div className="workspace-section-title">Preview (first 5 rows)</div>
                    <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 12, background: "var(--panel)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr>
                                    {parsed.headers.map((h) => (
                                        <th key={h} style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {parsed.rows.slice(0, 5).map((row, i) => (
                                    <tr key={i}>
                                        {parsed.headers.map((h) => (
                                            <td key={h} style={{ padding: "9px 14px", borderBottom: i < 4 && i < parsed.rows.length - 1 ? "1px solid var(--line)" : "none", color: "var(--muted-strong)" }}>{row[h] || "—"}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                        {parsed.rows.length} row{parsed.rows.length !== 1 ? "s" : ""} detected · {validRows.length} valid
                    </div>

                    {imported ? (
                        <div className="inline-success" style={{ marginTop: 14 }}>
                            {validRows.length} record{validRows.length !== 1 ? "s" : ""} imported successfully (preview only — no backend write).
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="btn-primary"
                            style={{ marginTop: 14 }}
                            onClick={handleImport}
                            disabled={missingCols.length > 0}
                        >
                            Import {validRows.length} Record{validRows.length !== 1 ? "s" : ""}
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
