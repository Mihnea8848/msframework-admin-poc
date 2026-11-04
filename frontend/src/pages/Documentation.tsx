import { useId, useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import "../ui/list.css";
import "../ui/surface.css";
import "./documentation.css";

interface DocSection {
    id: string;
    title: string;
    content: ReactNode;
}

const SECTIONS: DocSection[] = [
    {
        id: "getting-started",
        title: "Getting Started",
        content: (
            <>
                <p>Welcome to <strong>MSFramework Admin</strong> — your central hub for managing users, departments, and company operations.</p>
                <p>After logging in, you&apos;ll land on the <strong>Home</strong> page which shows every section your role can open. Use the sidebar to navigate, or press <code>⌘K</code> / <code>Ctrl+K</code> (or <code>/</code>) to open the Quick Actions palette.</p>
                <p>Your session is kept in a secure HTTP-only cookie. If it expires, or an administrator deactivates your account, you are sent back to the login page.</p>
                <p>Forgot your password? Use <em>Forgot password</em> on the login page. In this development setup the reset link is printed in the backend console instead of being emailed.</p>
            </>
        ),
    },
    {
        id: "roles",
        title: "Roles & Permissions",
        content: (
            <>
                <p>Every user has exactly one role. Pages and buttons you cannot use are hidden, and the server enforces the same rules.</p>
                <pre>{`ADMIN    — everything, including users, departments, integrations,
           API keys, organisation settings, import and export
MANAGER  — dashboard, users and departments (read), edit their own
           department and its members, notifications, timezones
MEMBER   — dashboard, users and departments (read), timezones, docs
VIEWER   — dashboard and documentation only`}</pre>
                <p>Everyone can change their own email and password under <strong>Settings</strong> (Account and Security) and their look and feel under <strong>Settings Everyone can change their own email and password under <strong>Account &amp; security</strong> and their look and feel under <strong>Appearance</strong>.gt; Appearance</strong>.</p>
            </>
        ),
    },
    {
        id: "user-management",
        title: "User Management",
        content: (
            <>
                <p>The <strong>User management</strong> page lists every account with its role, status and department, and has a search box.</p>
                <p>Admins can <strong>add</strong>, <strong>edit</strong> and <strong>delete</strong> users. Managers can edit members and viewers of their own department, but cannot promote anyone to Admin or Manager or move people to another department.</p>
                <p>Setting a user to <strong>Inactive</strong> signs them out immediately and blocks sign-in. The system always keeps at least one active admin, and you cannot delete or deactivate yourself.</p>
                <pre>{`GET    /api/users        — list users
POST   /api/users        — create user (admin)
PUT    /api/users/{id}   — update user
DELETE /api/users/{id}   — delete user (admin)
POST   /api/auth/register — self-service sign-up (MEMBER role)`}</pre>
            </>
        ),
    },
    {
        id: "departments",
        title: "Departments",
        content: (
            <>
                <p>The <strong>Departments</strong> page lets admins create, rename, re-seal and delete departments; managers can edit their own department.</p>
                <p>Member counts are live. Each department shows its seal (emblem and colour). The performance and budget figures are illustrative sample data. Deleting a department keeps its members — they simply become unassigned.</p>
                <pre>{`GET    /api/departments      — list departments
POST   /api/departments      — create department
PUT    /api/departments/{id} — update department
DELETE /api/departments/{id} — delete department`}</pre>
            </>
        ),
    },
    {
        id: "activity",
        title: "Activity & Audit Log",
        content: (
            <>
                <p>Every important action — sign-ins (including failed ones), user and department changes, integration changes, API keys, settings, imports and exports — is written to the audit log.</p>
                <p>The <strong>Activity</strong> page (and <strong>Audit log</strong> under Security) refreshes every 15 seconds and highlights events you haven&apos;t seen; the sidebar badge counts unseen events.</p>
            </>
        ),
    },
    {
        id: "import-export",
        title: "Import & Export",
        content: (
            <>
                <p><strong>Export</strong> generates a UTF-8 CSV from live data (users, departments or the audit log). Pick the columns, then click <em>Download CSV</em>.</p>
                <p><strong>Import</strong> accepts a <code>.csv</code> file with a header row. After a preview, the server validates every row: valid rows are created, invalid ones are listed with the reason. Imported users receive a random password and set their own with <em>Forgot password</em>.</p>
                <pre>{`# Users CSV (full_name and email required)
full_name,email,phone,role,status,department

# Departments CSV (name required)
name,color`}</pre>
            </>
        ),
    },
    {
        id: "navigation",
        title: "Navigation & Shortcuts",
        content: (
            <>
                <p>The sidebar shows only the pages your role can open, grouped as <strong>Overview</strong>, <strong>People</strong>, <strong>Finance</strong>, <strong>Operations</strong>, <strong>Security</strong> and <strong>Resources</strong>. <strong>Settings</strong> opens from the cog or your name in the top bar.</p>
                <pre>{`⌘K / Ctrl+K   — Open Quick Actions palette
/             — Open Quick Actions palette (when not typing)
↑ ↓           — Navigate results in palette
↵             — Open selected page
Esc           — Close any overlay or dialog`}</pre>
            </>
        ),
    },
    {
        id: "appearance",
        title: "Appearance & Theming",
        content: (
            <>
                <p>Open <strong>Settings &gt; Appearance</strong> to switch between <strong>Dark</strong> and <strong>Light</strong> mode, pick one of six accent colours and choose <strong>Comfortable</strong> or <strong>Compact</strong> density.</p>
                <p>Preferences are stored in this browser and restored before the first render, so there is no flash of the wrong theme.</p>
            </>
        ),
    },
];

function AccordionItem({ section, open, onToggle }: { section: DocSection; open: boolean; onToggle: () => void }) {
    const bodyId = useId();
    return (
        <section className="ms-panel ms-docs__item" id={section.id} aria-label={section.title}>
            <h2 className="ms-docs__heading">
                <button type="button" className="ms-docs__toggle" onClick={onToggle} aria-expanded={open} aria-controls={open ? bodyId : undefined}>
                    <BookOpen className="ms-docs__icon" aria-hidden="true" />
                    <span className="ms-docs__title">{section.title}</span>
                    <ChevronDown className="ms-docs__chevron" aria-hidden="true" />
                </button>
            </h2>
            {open && (
                <div className="ms-docs__body" id={bodyId}>
                    {section.content}
                </div>
            )}
        </section>
    );
}

export default function Documentation() {
    const [openIds, setOpenIds] = useState(() => new Set(["getting-started"]));

    function toggle(id: string) {
        setOpenIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function jumpTo(id: string) {
        setOpenIds((prev) => new Set(prev).add(id));
        const reduced = document.documentElement.dataset.motion === "reduced";
        requestAnimationFrame(() => {
            document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        });
    }

    return (
        <section className="ms-docs">
            <PageHeader eyebrow="Resources" title="Documentation" description="How to use MSFramework Admin." />

            <nav className="ms-docs__jump" aria-label="Sections">
                {SECTIONS.map((s) => (
                    <button key={s.id} type="button" className="ms-chip" onClick={() => jumpTo(s.id)}>
                        {s.title}
                    </button>
                ))}
            </nav>

            <div className="ms-docs__list">
                {SECTIONS.map((s) => (
                    <AccordionItem key={s.id} section={s} open={openIds.has(s.id)} onToggle={() => toggle(s.id)} />
                ))}
            </div>
        </section>
    );
}
