import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DepartmentResponse } from "../api/types";
import type { Quarter } from "../utils/money";
import { quarterKey, quarterLabel, parseQuarterKey } from "../utils/money";
import Button from "./Button";
import "./field.css";
import "./business.css";

/** A labelled <select> of quarters (newest first). */
export function QuarterSelect({ id, value, options, onChange }: {
    id: string;
    value: Quarter;
    options: readonly Quarter[];
    onChange: (q: Quarter) => void;
}) {
    return (
        <div className="ms-field">
            <label className="ms-field__label" htmlFor={id}>Quarter</label>
            <div className="ms-select">
                <select id={id} className="ms-input" value={quarterKey(value)}
                    onChange={(e) => { const q = parseQuarterKey(e.target.value); if (q) onChange(q); }}>
                    {options.map((q) => <option key={quarterKey(q)} value={quarterKey(q)}>{quarterLabel(q)}</option>)}
                </select>
            </div>
        </div>
    );
}

/** A labelled <select> of departments with an "All departments" option (value ""). */
export function DepartmentSelect({ id, value, departments, onChange, allLabel = "All departments", label = "Department" }: {
    id: string;
    value: string;
    departments: readonly DepartmentResponse[];
    onChange: (id: string) => void;
    allLabel?: string | null;
    label?: string;
}) {
    return (
        <div className="ms-field">
            <label className="ms-field__label" htmlFor={id}>{label}</label>
            <div className="ms-select">
                <select id={id} className="ms-input" value={value} onChange={(e) => onChange(e.target.value)}>
                    {allLabel !== null && <option value="">{allLabel}</option>}
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
            </div>
        </div>
    );
}

/** One totals tile: label, value, an optional line under it. */
export function Tile({ label, value, detail, tone, className = "", style }: {
    label: string;
    value: ReactNode;
    detail?: ReactNode;
    tone?: "danger";
    /** Extra classes, for example from useReveal. */
    className?: string;
    style?: CSSProperties;
}) {
    return (
        <li className={`ms-tile ms-cut${tone ? ` ms-tile--${tone}` : ""}${className ? ` ${className}` : ""}`} style={style}>
            <p className="ms-tile__label">{label}</p>
            <p className="ms-tile__value">{value}</p>
            {detail ? <p className="ms-tile__detail">{detail}</p> : null}
        </li>
    );
}

/** "Page 2 of 9 · 214 expenses" with previous and next buttons. `page` is 0-based. */
export function Pager({ page, totalPages, total, noun, busy = false, onPage }: {
    page: number;
    totalPages: number;
    total: number;
    noun: string;
    busy?: boolean;
    onPage: (page: number) => void;
}) {
    if (total === 0) return null;
    return (
        <nav className="ms-pager" aria-label="Pages">
            <span aria-live="polite">Page {page + 1} of {Math.max(1, totalPages)} · {total} {noun}</span>
            <span className="ms-pager__buttons">
                <Button size="sm" icon={<ChevronLeft aria-hidden="true" />} disabled={busy || page <= 0} onClick={() => onPage(page - 1)}>
                    Previous
                </Button>
                <Button size="sm" disabled={busy || page + 1 >= totalPages} onClick={() => onPage(page + 1)}>
                    Next
                    <ChevronRight aria-hidden="true" />
                </Button>
            </span>
        </nav>
    );
}
