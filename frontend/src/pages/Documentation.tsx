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
                <p>Everyone can change their own email and password under <strong>Settings</strong> (Account and Security) and their look and feel under <strong>Settings &gt; Appearance</strong>.</p>
            </>
        ),
    },
    {
        id: "user-management",
        title: "User Management",
        content: (
            <>
                <p>The <strong>User management</strong> page lists accounts 25 at a time with their job title, role, status, department and last sign-in. Search by name, email or job title, filter by role, status and department, and sort by a column; the filters stay in the address, so a filtered list can be shared or bookmarked.</p>
                <p>Click a name to open the <strong>profile</strong>: contact details, department and manager, what the role allows, account dates and the person's activity. From there you can edit them, activate or deactivate them, or create a <strong>password reset link</strong> to hand over privately (it works once and expires after 30 minutes).</p>
                <p>Tick users to change several at once: <strong>Activate</strong>, <strong>Deactivate</strong>, <strong>Change role</strong> or <strong>Move to department</strong>. Each user is checked on its own, and the page lists anyone who could not be changed and why.</p>
                <p>Admins can <strong>add</strong>, <strong>edit</strong> and <strong>delete</strong> users. Managers can edit members and viewers of their own department, but cannot promote anyone to Admin or Manager or move people to another department.</p>
                <p>Setting a user to <strong>Inactive</strong> signs them out immediately and blocks sign-in. The system always keeps at least one active admin, and you cannot delete or deactivate yourself.</p>
                <pre>{`GET    /api/users/search          — paged search with filters and sort
GET    /api/users/{id}            — one user's profile
GET    /api/users/{id}/activity   — events about the user (keyset paged)
POST   /api/users                 — create user (admin)
PUT    /api/users/{id}            — update user
POST   /api/users/bulk            — bulk activate, deactivate, role or department
POST   /api/users/{id}/password-reset — one-time reset link
DELETE /api/users/{id}            — delete user (admin)
POST   /api/auth/register         — request access (an admin approves it)`}</pre>
            </>
        ),
    },
    {
        id: "departments",
        title: "Departments",
        content: (
            <>
                <p>The <strong>Departments</strong> page lets admins create, rename, re-seal and delete departments; managers can edit their own department.</p>
                <p>Each department shows its seal, its manager and member count, and this quarter's performance score (with a six-month trend) and budget used, for roles that may read goals, reports or budgets. Click a department for its members, manager, figures and activity. Admins choose the manager among the department's active members with the Manager or Admin role. Deleting a department keeps its members — they simply become unassigned.</p>
                <p><strong>Roles</strong> shows what each role may do, and <strong>Access requests</strong> is where admins approve or reject the people who asked for an account.</p>
                <pre>{`GET    /api/departments      — list departments
POST   /api/departments      — create department
GET    /api/departments/{id} — one department with its members
PUT    /api/departments/{id} — update department
PUT    /api/departments/{id}/manager — choose the manager (admin)
POST   /api/departments/{id}/members/{userId} — add a member
DELETE /api/departments/{id}/members/{userId} — remove a member
DELETE /api/departments/{id} — delete department`}</pre>
            </>
        ),
    },
    {
        id: "activity",
        title: "Activity, Audit Log & Sessions",
        content: (
            <>
                <p>Every important action — sign-ins (including failed ones), user and department changes, integration changes, API keys, settings, imports and exports — is written to the audit log.</p>
                <p><strong>Activity</strong> is yours: what you did and what happened to your account, for every role. It refreshes on its own and highlights what others did to your account since your last visit; the sidebar badge counts those events and sign-in warnings, never your own actions.</p>
                <p>The <strong>Audit log</strong> under Security (roles with audit access) shows every event, filtered by category, actor and date.</p>
                <p><strong>Sessions</strong> under Security lists where you are signed in. Sign out a device you do not recognise, or every other session at once. Administrators can sign any user out everywhere.</p>
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
