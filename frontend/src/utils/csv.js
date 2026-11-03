/**
 * Minimal RFC 4180 CSV support: quoted fields, escaped quotes (""), commas and newlines inside
 * quotes, CRLF line endings and a UTF-8 BOM.
 */
export function parseCSV(text) {
    const input = (text || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (inQuotes) {
            if (ch === '"') {
                if (input[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ",") {
            row.push(field);
            field = "";
        } else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && input[i + 1] === "\n") i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else {
            field += ch;
        }
    }
    if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
    if (nonEmpty.length === 0) return { headers: [], rows: [] };

    const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
    const data = nonEmpty.slice(1).map((values) =>
        Object.fromEntries(headers.map((h, idx) => [h, (values[idx] ?? "").trim()]))
    );
    return { headers, rows: data };
}

function escapeCell(value) {
    const s = value === null || value === undefined ? "" : String(value);
    // Prevent formula injection when the file is opened in a spreadsheet, without mangling
    // ordinary values such as "+40 712 345 678" or "-5".
    const safe = /^[=@\t\r]/.test(s) || /^[+-][^0-9\s]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** columns: [{ key, label, get?(row) }] */
export function toCSV(rows, columns) {
    const header = columns.map((c) => escapeCell(c.label)).join(",");
    const lines = rows.map((row) => columns.map((c) => escapeCell(c.get ? c.get(row) : row[c.key])).join(","));
    return [header, ...lines].join("\r\n");
}

export function downloadText(content, filename, type = "text/csv;charset=utf-8;") {
    // BOM so Excel opens UTF-8 (diacritics) correctly.
    const blob = new Blob(["\uFEFF", content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
