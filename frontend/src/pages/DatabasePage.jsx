import { useEffect, useState } from "react";
import { fetchUsers } from "../auth/auth";
import { ChevronDown, Database } from "lucide-react";

const USERS_SCHEMA = [
    { col: "id",          type: "UUID",      nullable: false },
    { col: "full_name",   type: "VARCHAR",   nullable: false },
    { col: "email",       type: "VARCHAR",   nullable: false },
    { col: "phone",       type: "VARCHAR",   nullable: true  },
    { col: "role",        type: "ENUM",      nullable: false },
    { col: "status",      type: "ENUM",      nullable: false },
    { col: "department_id", type: "UUID",    nullable: true  },
    { col: "created_at",  type: "TIMESTAMP", nullable: false },
];

const DEPARTMENTS_SCHEMA = [
    { col: "id",          type: "UUID",      nullable: false },
    { col: "name",        type: "VARCHAR",   nullable: false },
    { col: "color_class", type: "VARCHAR",   nullable: true  },
    { col: "created_at",  type: "TIMESTAMP", nullable: false },
];

const FINANCE_DBS = [
    {
        name: "Transactions",
        rows: 1842,
        size: "14.2 MB",
        updated: "2 min ago",
        schema: [
            { col: "id",          type: "UUID",      nullable: false },
            { col: "amount",      type: "DECIMAL",   nullable: false },
            { col: "currency",    type: "CHAR(3)",   nullable: false },
            { col: "type",        type: "ENUM",      nullable: false },
            { col: "status",      type: "ENUM",      nullable: false },
            { col: "created_at",  type: "TIMESTAMP", nullable: false },
            { col: "department_id", type: "UUID",    nullable: true  },
        ],
    },
    {
        name: "Invoices",
        rows: 318,
        size: "3.1 MB",
        updated: "1 h ago",
        schema: [
            { col: "id",          type: "UUID",      nullable: false },
            { col: "invoice_no",  type: "VARCHAR",   nullable: false },
            { col: "amount",      type: "DECIMAL",   nullable: false },
            { col: "due_date",    type: "DATE",      nullable: false },
            { col: "paid",        type: "BOOLEAN",   nullable: false },
            { col: "vendor",      type: "VARCHAR",   nullable: true  },
        ],
    },
    {
        name: "Payroll",
        rows: 94,
        size: "1.8 MB",
        updated: "3 d ago",
        schema: [
            { col: "id",          type: "UUID",      nullable: false },
            { col: "employee_id", type: "UUID",      nullable: false },
            { col: "period",      type: "DATE",      nullable: false },
            { col: "gross",       type: "DECIMAL",   nullable: false },
            { col: "net",         type: "DECIMAL",   nullable: false },
            { col: "processed",   type: "BOOLEAN",   nullable: false },
        ],
    },
];

function DbPanel({ name, icon, rows, size, updated, schema, defaultOpen }) {
    const [open, setOpen] = useState(defaultOpen ?? false);

    return (
        <div className="db-panel">
            <div className="db-panel-header" onClick={() => setOpen((o) => !o)}>
                <div style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--panel-muted)", border: "1px solid var(--line)", color: "var(--muted-strong)", flexShrink: 0 }}>
                    {icon}
                </div>
                <span className="db-panel-title">{name}</span>
                <div className="db-panel-stats">
                    <span>{rows.toLocaleString()} rows</span>
                    <span>{size}</span>
                    <span>Updated {updated}</span>
                </div>
                <ChevronDown size={16} style={{ color: "var(--muted)", transition: "transform 200ms ease", transform: open ? "rotate(180deg)" : "none" }} />
            </div>
            {open && (
                <div className="db-panel-body">
                    {schema.map((col) => (
                        <div key={col.col} className="db-schema-row">
                            <span className="db-col-name">{col.col}</span>
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
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);

    useEffect(() => {
        fetchUsers().then(setUsers).catch(() => {});
        fetch("/api/departments").then((r) => r.json()).then(setDepartments).catch(() => {});
    }, []);

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">General / Database</div>
                    <div className="workspace-title-row">
                        <h1>Database</h1>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Browse connected databases and their schemas.
                    </p>
                </div>
            </div>

            <div className="workspace-section">
                <div className="workspace-section-title">Live Databases</div>
                <DbPanel
                    name="users"
                    icon={<Database size={15} />}
                    rows={users.length}
                    size={`${(users.length * 0.8).toFixed(1)} KB`}
                    updated="live"
                    schema={USERS_SCHEMA}
                    defaultOpen
                />
                <DbPanel
                    name="departments"
                    icon={<Database size={15} />}
                    rows={departments.length}
                    size={`${(departments.length * 0.4).toFixed(1)} KB`}
                    updated="live"
                    schema={DEPARTMENTS_SCHEMA}
                />
            </div>

            <div className="workspace-section">
                <div className="workspace-section-title">Finance Module (Mock)</div>
                {FINANCE_DBS.map((db) => (
                    <DbPanel
                        key={db.name}
                        name={db.name}
                        icon={<Database size={15} />}
                        rows={db.rows}
                        size={db.size}
                        updated={db.updated}
                        schema={db.schema}
                    />
                ))}
            </div>
        </section>
    );
}
