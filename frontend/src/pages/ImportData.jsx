import { useMemo, useRef, useState } from "react";
import { ChevronDown, Upload } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import { post } from "../api/client";
import { parseCSV } from "../utils/csv";
import PageHeader from "../ui/PageHeader.jsx";

const MAX_ROWS = 1000;

const ENTITY_CONFIGS = {
    users: {
        label: "Users",
        permission: "USER_CREATE",
        endpoint: "/api/import/users",
        requiredCols: ["full_name", "email"],
        optionalCols: ["phone", "role", "status", "department"],
        aliases: {},
        example: "full_name,email,phone,role,status,department\nJane Smith,jane@co.com,+40712345678,MEMBER,Active,Development\nBob Lee,bob@co.com,,VIEWER,Active,",
        notes: "Role: ADMIN, MANAGER, MEMBER or VIEWER (default MEMBER). Status: Active or Inactive (default Active). Department must match an existing department name. Imported users get a random password and set their own via “Forgot password”.",
        toRow: (r) => ({
            fullName: r.full_name,
            email: r.email,
            phone: r.phone || "",
            role: r.role || "",
            status: r.status || "",
            department: r.department || "",
        }),
    },
    departments: {
        label: "Departments",
        permission: "DEPARTMENT_CREATE",
        endpoint: "/api/import/departments",
        requiredCols: ["name"],
        optionalCols: ["color"],
        aliases: { color_class: "color" },
        example: "name,color\nEngineering,avatar-azure\nMarketing,avatar-rose",
        notes: "Color is optional: one of avatar-azure, avatar-rose, avatar-cyan, avatar-magenta, avatar-amber, avatar-gold, avatar-violet, avatar-jade, avatar-sky, avatar-coral, avatar-orange, avatar-plum.",
        toRow: (r) => ({ name: r.name, color: r.color || "" }),
    },
};

function applyAliases(parsed, aliases) {
    const headers = parsed.headers.map((h) => aliases[h] || h);
    const rows = parsed.rows.map((row) =>
        Object.fromEntries(Object.entries(row).map(([k, v]) => [aliases[k] || k, v]))
    );
    return { headers, rows };
}

export default function ImportData() {
    const { user } = useAuth();
    const available = useMemo(
        () => Object.entries(ENTITY_CONFIGS).filter(([, cfg]) => hasPermission(user, cfg.permission)),
        [user]
    );

    const [entity, setEntity] = useState(() => available[0]?.[0] || "users");
    const [dragOver, setDragOver] = useState(false);
    const [parsed, setParsed] = useState(null);
    const [fileName, setFileName] = useState(null);
    const [fileError, setFileError] = useState(null);
    const [result, setResult] = useState(null);
    const [importError, setImportError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const fileRef = useRef(null);

    const cfg = ENTITY_CONFIGS[entity];

    function reset() {
        setParsed(null);
        setFileName(null);
        setFileError(null);
        setResult(null);
        setImportError(null);
        if (fileRef.current) fileRef.current.value = "";
    }

    function readFile(file) {
        reset();
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".csv")) {
            setFileError("Please choose a .csv file.");
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setFileError("The file is larger than 2 MB.");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = applyAliases(parseCSV(String(e.target.result)), cfg.aliases);
            if (data.headers.length === 0) {
                setFileError("The file is empty.");
                return;
            }
            setParsed(data);
            setFileName(file.name);
        };
        reader.onerror = () => setFileError("The file could not be read.");
        reader.readAsText(file);
    }

    function handleDrop(e) {
        e.preventDefault();
        setDragOver(false);
        readFile(e.dataTransfer.files[0]);
    }

    async function handleImport() {
        setBusy(true);
        setImportError(null);
        try {
            const rows = parsed.rows.map(cfg.toRow);
            setResult(await post(cfg.endpoint, { rows }));
        } catch (err) {
            setImportError(err.message);
        } finally {
            setBusy(false);
        }
    }

    if (available.length === 0) {
        return (
            <section className="workspace">
                <PageHeader breadcrumb="Ventures / Import Data" title="Import Data" subtitle="Your role cannot create users or departments, so there is nothing you can import." />
            </section>
        );
    }

    const missingCols = parsed ? cfg.requiredCols.filter((c) => !parsed.headers.includes(c)) : [];
    const knownCols = [...cfg.requiredCols, ...cfg.optionalCols];
    const extraCols = parsed ? parsed.headers.filter((h) => !knownCols.includes(h)) : [];
    const tooMany = parsed && parsed.rows.length > MAX_ROWS;

    return (
        <section className="workspace">
            <PageHeader breadcrumb="Ventures / Import Data" title="Import Data" subtitle="Upload a CSV to create records in bulk. Every row is validated by the server." />

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <label htmlFor="import-entity" style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-strong)" }}>What would you like to import?</label>
                <select
                    id="import-entity"
                    className="select-entity"
                    value={entity}
                    onChange={(e) => { setEntity(e.target.value); reset(); }}
                >
                    {available.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>

            <div
                className={`upload-zone${dragOver ? " drag-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
            >
                <div className="upload-zone-icon"><Upload size={22} /></div>
                <div className="upload-zone-title">{fileName ? `Loaded ${fileName}` : "Drop your CSV here or click to browse"}</div>
                <div className="upload-zone-sub">Accepts .csv files (UTF-8, comma-separated, header row) · {cfg.label} format · max {MAX_ROWS} rows</div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => readFile(e.target.files[0])} />
            </div>
            {fileError && <div className="inline-error" style={{ marginTop: 10 }}>{fileError}</div>}

            <div style={{ marginTop: 10, marginBottom: 16 }}>
                <button
                    type="button"
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)", cursor: "pointer", background: "none", border: "none" }}
                    onClick={() => setGuideOpen((o) => !o)}
                    aria-expanded={guideOpen}
                >
                    <ChevronDown size={14} style={{ transform: guideOpen ? "rotate(180deg)" : "none", transition: "transform 180ms" }} />
                    CSV format guide
                </button>
                {guideOpen && (
                    <div style={{ marginTop: 8, padding: "12px 14px", borderRadius: 10, background: "var(--panel)", border: "1px solid var(--line)", fontSize: 12 }}>
                        <div style={{ fontFamily: "monospace", whiteSpace: "pre-wrap", color: "var(--muted-strong)", marginBottom: 8 }}>{cfg.example}</div>
                        <div className="muted-note">{cfg.notes}</div>
                    </div>
                )}
            </div>

            {parsed && (
                <div>
                    <div style={{ marginBottom: 14, padding: "12px 16px", borderRadius: 12, background: "var(--panel)", border: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Column Mapping</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {knownCols.map((c) => {
                                const present = parsed.headers.includes(c);
                                const required = cfg.requiredCols.includes(c);
                                const color = present ? "var(--success)" : required ? "var(--danger)" : "var(--muted)";
                                return (
                                    <span key={c} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, color, border: `1px solid ${color}` }}>
                                        {c} {present ? "✓" : required ? "✗ missing" : "(optional)"}
                                    </span>
                                );
                            })}
                            {extraCols.map((c) => (
                                <span key={c} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, color: "#f0a832", border: "1px solid rgba(240,168,50,0.5)" }}>
                                    {c} (ignored)
                                </span>
                            ))}
                        </div>
                        {missingCols.length > 0 && (
                            <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>Missing required columns: {missingCols.join(", ")}</div>
                        )}
                    </div>

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
                                            <td key={h} style={{ padding: "9px 14px", borderBottom: "1px solid var(--line)", color: "var(--muted-strong)" }}>{row[h] || "—"}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                        {parsed.rows.length} data row{parsed.rows.length !== 1 ? "s" : ""} detected
                        {tooMany && <span style={{ color: "var(--danger)" }}> — too many, split the file into chunks of {MAX_ROWS}</span>}
                    </div>

                    {importError && <div className="inline-error" style={{ marginTop: 14 }} role="alert">{importError}</div>}

                    {result ? (
                        <div style={{ marginTop: 14 }}>
                            <div className={result.created > 0 ? "inline-success" : "inline-error"} role="status">
                                Imported {result.created} {cfg.label.toLowerCase()}; {result.skipped} row{result.skipped !== 1 ? "s" : ""} skipped.
                            </div>
                            {result.errors.length > 0 && (
                                <div className="audit-list" style={{ marginTop: 10 }}>
                                    {result.errors.slice(0, 50).map((e) => (
                                        <div key={e.row} className="audit-row" style={{ fontSize: 12 }}>
                                            <strong style={{ minWidth: 60 }}>Row {e.row}</strong>
                                            <span style={{ color: "var(--muted-strong)" }}>{e.message}</span>
                                        </div>
                                    ))}
                                    {result.errors.length > 50 && <div className="muted-note">…and {result.errors.length - 50} more.</div>}
                                </div>
                            )}
                            <button type="button" className="btn-secondary" style={{ marginTop: 12 }} onClick={reset}>Import another file</button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="btn-primary"
                            style={{ marginTop: 14 }}
                            onClick={handleImport}
                            disabled={busy || missingCols.length > 0 || parsed.rows.length === 0 || tooMany}
                        >
                            {busy ? "Importing…" : `Import ${parsed.rows.length} row${parsed.rows.length !== 1 ? "s" : ""}`}
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
