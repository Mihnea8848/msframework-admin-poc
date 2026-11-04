import { useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Check, ChevronDown, Download, Upload, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import { post } from "../api/client";
import type { CurrentUserDto, ImportResult } from "../api/types";
import { parseCSV } from "../utils/csv";
import type { ParsedCSV } from "../utils/csv";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import PageHeader from "../ui/PageHeader";
import "../ui/field.css";
import "../ui/list.css";
import "../ui/surface.css";
import "./data-transfer.css";

const MAX_ROWS = 1000;

type EntityKey = "users" | "departments" | "expenses" | "budgets" | "checkins";

interface EntityConfig {
    label: string;
    /** Whether the user may import this type (the backend checks the same). */
    allowed: (user: CurrentUserDto | null) => boolean;
    endpoint: string;
    requiredCols: string[];
    optionalCols: string[];
    /** A rule the required columns cannot express; returns the problem, or null. */
    columnsProblem?: (headers: string[]) => string | null;
    aliases: Record<string, string>;
    example: string;
    notes: string;
    toRow: (r: Record<string, string>) => Record<string, string | undefined>;
}

const ENTITY_CONFIGS: Record<EntityKey, EntityConfig> = {
    users: {
        label: "Users",
        allowed: (u) => hasPermission(u, "IMPORT_DATA") && hasPermission(u, "USER_CREATE"),
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
        allowed: (u) => hasPermission(u, "IMPORT_DATA") && hasPermission(u, "DEPARTMENT_CREATE"),
        endpoint: "/api/import/departments",
        requiredCols: ["name"],
        optionalCols: ["color"],
        aliases: { color_class: "color" },
        example: "name,color\nEngineering,avatar-azure\nMarketing,avatar-rose",
        notes: "Color is optional: one of avatar-azure, avatar-rose, avatar-cyan, avatar-magenta, avatar-amber, avatar-gold, avatar-violet, avatar-jade, avatar-sky, avatar-coral, avatar-orange, avatar-plum. Each colour is shown as the nearest department seal.",
        toRow: (r) => ({ name: r.name, color: r.color || "" }),
    },
    expenses: {
        label: "Expenses",
        allowed: (u) => hasPermission(u, "IMPORT_DATA") && hasPermission(u, "FINANCE_MANAGE"),
        endpoint: "/api/import/expenses",
        requiredCols: ["department", "category", "amount", "date", "vendor"],
        optionalCols: ["description", "reference", "status", "submitter_email"],
        aliases: { submitter: "submitter_email" },
        example: "department,category,amount,date,vendor,description,reference,status,submitter_email\nDevelopment,Hardware,1249.00,2026-10-14,Dell,Precision workstation,INV-1042,APPROVED,radu.constantinescu@mehstudios.net\nExternal Affairs,Travel,386.40,2026-10-20,Deutsche Bahn,Train tickets,,SUBMITTED,",
        notes: "Department and category by name; date as YYYY-MM-DD, not in the future. Status: DRAFT, SUBMITTED, APPROVED or PAID (default SUBMITTED). The submitter defaults to you. Amounts use a dot or a comma for decimals.",
        toRow: (r) => ({
            department: r.department, category: r.category, amount: r.amount, date: r.date, vendor: r.vendor,
            description: r.description || "", reference: r.reference || "", status: r.status || "", submitterEmail: r.submitter_email || "",
        }),
    },
    budgets: {
        label: "Budgets",
        allowed: (u) => hasPermission(u, "IMPORT_DATA") && hasPermission(u, "FINANCE_MANAGE"),
        endpoint: "/api/import/budgets",
        requiredCols: ["department", "category", "year", "quarter", "amount"],
        optionalCols: ["notes"],
        aliases: {},
        example: "department,category,year,quarter,amount,notes\nDevelopment,Salaries,2027,1,265000,\nQuality Control,Software & licences,2027,Q1,6500,Test tooling",
        notes: "One line per department, category and quarter. Department and category by name; quarter 1 to 4 (or Q1 to Q4). A line that already exists is reported, not changed.",
        toRow: (r) => ({ department: r.department, category: r.category, year: r.year, quarter: r.quarter, amount: r.amount, notes: r.notes || "" }),
    },
    checkins: {
        label: "Goal check-ins",
        allowed: (u) => hasPermission(u, "IMPORT_DATA") || hasPermission(u, "GOALS_MANAGE"),
        endpoint: "/api/import/checkins",
        requiredCols: ["value"],
        optionalCols: ["goal_id", "department", "goal", "date", "note"],
        aliases: {},
        columnsProblem: (headers) => (headers.includes("goal_id") || (headers.includes("department") && headers.includes("goal"))
            ? null
            : "Add a goal_id column, or both department and goal columns."),
        example: "department,goal,date,value,note\nDevelopment,Sprint velocity,2026-11-02,48,Sprint 22\nQuality Control,Automated test coverage,2026-11-02,68.4,",
        notes: "Identify the goal by goal_id, or by department and goal name (the goal of the quarter that contains the date). Date as YYYY-MM-DD, default today, inside the goal's quarter and not in the future. You can record check-ins for your own department's goals (admins for any).",
        toRow: (r) => ({ goalId: r.goal_id || "", department: r.department || "", goal: r.goal || "", date: r.date || "", value: r.value, note: r.note || "" }),
    },
};

/** Saves the example of a type as a CSV file to fill in. */
function downloadTemplate(key: EntityKey, cfg: EntityConfig) {
    const blob = new Blob([`${cfg.example}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${key}-template.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function applyAliases(parsed: ParsedCSV, aliases: Record<string, string>): ParsedCSV {
    const headers = parsed.headers.map((h) => aliases[h] || h);
    const rows = parsed.rows.map((row) =>
        Object.fromEntries(Object.entries(row).map(([k, v]) => [aliases[k] || k, v]))
    );
    return { headers, rows };
}

export default function ImportData() {
    const { user } = useAuth();
    const available = useMemo(
        () => (Object.entries(ENTITY_CONFIGS) as [EntityKey, EntityConfig][]).filter(([, cfg]) => cfg.allowed(user)),
        [user]
    );

    const [entity, setEntity] = useState<EntityKey>(() => available[0]?.[0] || "users");
    const [dragOver, setDragOver] = useState(false);
    const [parsed, setParsed] = useState<ParsedCSV | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const cfg = ENTITY_CONFIGS[entity];

    function reset() {
        setParsed(null);
        setFileName(null);
        setFileError(null);
        setResult(null);
        setImportError(null);
        if (fileRef.current) fileRef.current.value = "";
    }

    function readFile(file: File | undefined) {
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
            const data = applyAliases(parseCSV(String(e.target?.result)), cfg.aliases);
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

    function handleDrop(e: DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setDragOver(false);
        readFile(e.dataTransfer.files[0]);
    }

    async function handleImport() {
        if (!parsed) return;
        setBusy(true);
        setImportError(null);
        try {
            const rows = parsed.rows.map(cfg.toRow);
            setResult(await post<ImportResult>(cfg.endpoint, { rows }));
        } catch (err) {
            setImportError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    }

    if (available.length === 0) {
        return (
            <section className="ms-transfer">
                <PageHeader eyebrow="Operations" title="Import Data" description="Your role cannot import any of the record types, so there is nothing to import here." />
            </section>
        );
    }

    const missingCols = parsed ? cfg.requiredCols.filter((c) => !parsed.headers.includes(c)) : [];
    const columnsProblem = parsed && cfg.columnsProblem ? cfg.columnsProblem(parsed.headers) : null;
    const knownCols = [...cfg.requiredCols, ...cfg.optionalCols];
    const extraCols = parsed ? parsed.headers.filter((h) => !knownCols.includes(h)) : [];
    const tooMany = parsed !== null && parsed.rows.length > MAX_ROWS;

    return (
        <section className="ms-transfer">
            <PageHeader eyebrow="Operations" title="Import Data" description="Upload a CSV to create records in bulk. Every row is validated by the server." />

            <div className="ms-field ms-transfer__entity">
                <label className="ms-field__label" htmlFor="import-entity">What would you like to import?</label>
                <div className="ms-select">
                    <select id="import-entity" className="ms-input" value={entity}
                        onChange={(e) => { setEntity(e.target.value as EntityKey); reset(); }}>
                        {available.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                </div>
            </div>

            <div
                className={`ms-transfer__drop${dragOver ? " ms-transfer__drop--over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
            >
                <span className="ms-transfer__drop-icon" aria-hidden="true"><Upload /></span>
                <span className="ms-transfer__drop-title">{fileName ? `Loaded ${fileName}` : "Drop your CSV here or click to browse"}</span>
                <span className="ms-transfer__drop-sub">Accepts .csv files (UTF-8, comma-separated, header row) · {cfg.label} format · max {MAX_ROWS} rows</span>
                <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => readFile(e.target.files?.[0])} />
            </div>
            {fileError && <Alert tone="danger" role="alert" className="ms-transfer__alert">{fileError}</Alert>}

            <div className="ms-transfer__guide">
                <button type="button" className="ms-transfer__guide-toggle" onClick={() => setGuideOpen((o) => !o)} aria-expanded={guideOpen}>
                    <ChevronDown className="ms-transfer__chevron" aria-hidden="true" />
                    CSV format guide
                </button>
                <div>
                    <Button size="sm" icon={<Download aria-hidden="true" />} onClick={() => downloadTemplate(entity, cfg)}>
                        Download {cfg.label.toLowerCase()} template
                    </Button>
                </div>
                {guideOpen && (
                    <div className="ms-panel ms-transfer__guide-body">
                        <pre className="ms-transfer__example">{cfg.example}</pre>
                        <p className="ms-transfer__note">{cfg.notes}</p>
                    </div>
                )}
            </div>

            {parsed && (
                <div className="ms-transfer__preview">
                    <section className="ms-panel ms-transfer__mapping" aria-labelledby="import-mapping">
                        <h2 className="ms-transfer__h" id="import-mapping">Column Mapping</h2>
                        <div className="ms-transfer__cols">
                            {knownCols.map((c) => {
                                const present = parsed.headers.includes(c);
                                const required = cfg.requiredCols.includes(c);
                                const tone = present ? "ok" : required ? "danger" : "neutral";
                                return (
                                    <span key={c} className={`ms-status ms-status--${tone}`}>
                                        {present ? <Check aria-hidden="true" /> : required ? <X aria-hidden="true" /> : null}
                                        {c}
                                        {present ? <span className="ms-visually-hidden"> present</span> : required ? " missing" : " (optional)"}
                                    </span>
                                );
                            })}
                            {extraCols.map((c) => (
                                <span key={c} className="ms-status ms-status--warn">{c} (ignored)</span>
                            ))}
                        </div>
                        {missingCols.length > 0 && (
                            <p className="ms-transfer__danger">Missing required columns: {missingCols.join(", ")}</p>
                        )}
                        {columnsProblem && <p className="ms-transfer__danger">{columnsProblem}</p>}
                    </section>

                    <h2 className="ms-transfer__h">Preview (first 5 rows)</h2>
                    <div className="ms-table-wrap">
                        <table className="ms-table">
                            <thead>
                                <tr>
                                    {parsed.headers.map((h) => <th key={h} scope="col">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {parsed.rows.slice(0, 5).map((row, i) => (
                                    <tr key={i}>
                                        {parsed.headers.map((h) => <td key={h} className="ms-table__muted">{row[h] || "—"}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="ms-transfer__note">
                        {parsed.rows.length} data row{parsed.rows.length !== 1 ? "s" : ""} detected
                        {tooMany && <span className="ms-transfer__danger"> — too many, split the file into chunks of {MAX_ROWS}</span>}
                    </p>

                    {importError && <Alert tone="danger" role="alert">{importError}</Alert>}

                    {result ? (
                        <div className="ms-transfer__result">
                            <Alert tone={result.created > 0 ? "ok" : "danger"} role="status">
                                Imported {result.created} {cfg.label.toLowerCase()}; {result.skipped} row{result.skipped !== 1 ? "s" : ""} skipped.
                            </Alert>
                            {result.errors.length > 0 && (
                                <ul className="ms-panel ms-transfer__errors">
                                    {result.errors.slice(0, 50).map((e) => (
                                        <li key={e.row} className="ms-transfer__error">
                                            <strong>Row {e.row}</strong>
                                            <span>{e.message}</span>
                                        </li>
                                    ))}
                                    {result.errors.length > 50 && <li className="ms-transfer__error">…and {result.errors.length - 50} more.</li>}
                                </ul>
                            )}
                            <div>
                                <Button onClick={reset}>Import another file</Button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <Button
                                variant="primary"
                                onClick={handleImport}
                                disabled={busy || missingCols.length > 0 || columnsProblem !== null || parsed.rows.length === 0 || tooMany}
                            >
                                {busy ? "Importing…" : `Import ${parsed.rows.length} row${parsed.rows.length !== 1 ? "s" : ""}`}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
