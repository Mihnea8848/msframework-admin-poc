/** Standard page heading used by every dashboard page. */
export default function PageHeader({ breadcrumb, title, count, subtitle, actions }) {
    return (
        <div className="workspace-hero">
            <div>
                {breadcrumb && <div className="workspace-breadcrumb">{breadcrumb}</div>}
                <div className="workspace-title-row">
                    <h1>{title}</h1>
                    {count !== undefined && count !== null && <span className="workspace-count">{count}</span>}
                </div>
                {subtitle && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{subtitle}</p>}
            </div>
            {actions && <div className="page-actions">{actions}</div>}
        </div>
    );
}
