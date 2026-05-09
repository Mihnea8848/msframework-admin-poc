import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";

const SECTIONS = [
    {
        id: "getting-started",
        title: "Getting Started",
        content: (
            <>
                <p>Welcome to <strong>MSFramework Admin</strong> — your central hub for managing users, departments, and company operations.</p>
                <p>After logging in, you&apos;ll land on the <strong>Home</strong> page which gives you a bird&apos;s-eye view of every section. Use the sidebar on the left to navigate between pages, or press <code>⌘K</code> to open the Quick Actions palette.</p>
                <p>Your session is preserved via a secure HTTP-only cookie. You will be automatically redirected to the login page if your session expires.</p>
            </>
        ),
    },
    {
        id: "user-management",
        title: "User Management",
        content: (
            <>
                <p>Navigate to <code>/users</code> to see all registered accounts in your organisation.</p>
                <p>Each row shows the member&apos;s <strong>name</strong>, <strong>email</strong>, <strong>role</strong> (Admin or Member), <strong>status</strong> (Active / Inactive), and their assigned <strong>department</strong>.</p>
                <p>New users can register via <code>/register</code>. Admins can manage existing users directly from the table.</p>
                <pre>{`GET  /api/users          — list all users
POST /api/auth/register — create a new user`}</pre>
            </>
        ),
    },
    {
        id: "departments",
        title: "Departments",
        content: (
            <>
                <p>The <strong>Departments</strong> page (<code>/departments</code>) lets you create, edit, and delete organisational units.</p>
                <p>Each department can have a <strong>name</strong> and a <strong>colour</strong> (chosen from 12 curated gradients). The table shows live member counts, a performance sparkline, and a budget progress bar.</p>
                <pre>{`GET    /api/departments      — list departments
POST   /api/departments      — create department
PUT    /api/departments/{id} — update department
DELETE /api/departments/{id} — delete department`}</pre>
            </>
        ),
    },
    {
        id: "navigation",
        title: "Navigation & Shortcuts",
        content: (
            <>
                <p>The sidebar contains two groups:</p>
                <p><strong>General</strong> — Home, Dashboard, Notifications, Appearance, Database, Documentation.</p>
                <p><strong>Ventures</strong> — Authentication, User Management, Departments, Security, Payments, Import/Export.</p>
                <p>Keyboard shortcuts:</p>
                <pre>{`⌘K  / Ctrl+K  — Open Quick Actions palette
/              — Open Quick Actions palette
↑ ↓            — Navigate results in palette
↵              — Open selected page
Esc            — Close any overlay`}</pre>
            </>
        ),
    },
    {
        id: "import-export",
        title: "Import & Export",
        content: (
            <>
                <p><strong>Export</strong> (<code>/export</code>) generates a real CSV file downloaded directly to your browser. Select the dataset (Users or Departments), choose which columns to include, then click <em>Download CSV</em>.</p>
                <p><strong>Import</strong> (<code>/import</code>) accepts a <code>.csv</code> file. After uploading, you&apos;ll see a preview of the first 5 rows and a column-mapping summary. Click <em>Import</em> to validate the rows.</p>
                <p>Expected CSV formats:</p>
                <pre>{`# Users CSV
full_name,email,role,status,department

# Departments CSV
name,color_class`}</pre>
            </>
        ),
    },
    {
        id: "appearance",
        title: "Appearance & Theming",
        content: (
            <>
                <p>Visit <code>/appearance</code> to switch between <strong>Dark</strong> and <strong>Light</strong> mode. Your preference is saved in <code>localStorage</code> and applied instantly without a page reload.</p>
                <p>You can also pick an <strong>accent colour</strong> from six options (Lime, Sky, Violet, Rose, Amber, Cyan) and choose between <strong>Comfortable</strong> and <strong>Compact</strong> density.</p>
                <p>The theme is restored before the first render via an inline script in <code>index.html</code>, so there is no flash of unstyled content.</p>
            </>
        ),
    },
];

function AccordionItem({ section }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="accordion-item" id={section.id}>
            <div className="accordion-header" onClick={() => setOpen((o) => !o)}>
                <BookOpen size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
                {section.title}
                <ChevronDown size={16} className={`accordion-chevron${open ? " open" : ""}`} />
            </div>
            {open && (
                <div className="accordion-body">
                    {section.content}
                </div>
            )}
        </div>
    );
}

export default function Documentation() {
    function scrollTo(id) {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
        // Also open the accordion
    }

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">General / Documentation</div>
                    <div className="workspace-title-row">
                        <h1>Documentation</h1>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        How to use MSFramework Admin.
                    </p>
                </div>
            </div>

            <div className="doc-jump-links">
                {SECTIONS.map((s) => (
                    <button key={s.id} type="button" className="doc-jump-link" onClick={() => scrollTo(s.id)}>
                        {s.title}
                    </button>
                ))}
            </div>

            {SECTIONS.map((s) => (
                <AccordionItem key={s.id} section={s} />
            ))}
        </section>
    );
}
