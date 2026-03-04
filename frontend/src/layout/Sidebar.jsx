import {
    Bell,
    BookText,
    Box,
    BriefcaseBusiness,
    Building2,
    Cable,
    ChevronDown,
    Clock3,
    CreditCard,
    Database,
    Download,
    Home,
    Palette,
    Shield,
    SquarePen,
    Upload,
    UsersRound,
} from "lucide-react";

const generalItems = [
    { key: "home", label: "Home", icon: Home },
    { key: "dashboard", label: "Dashboard", icon: Box },
    { key: "notifications", label: "Notifications", icon: Bell, badge: "10" },
    { key: "appearance", label: "Appearance", icon: Palette },
    { key: "database", label: "Database", icon: Database },
    { key: "connections", label: "Connections", icon: Cable },
    { key: "timezones", label: "Timezones", icon: Clock3 },
    { key: "documentation", label: "Documentation", icon: BookText },
];

const ventureItems = [
    { key: "authentication", label: "Authentication", icon: BriefcaseBusiness },
    { key: "user-management", label: "User management", icon: UsersRound, active: true },
    { key: "security", label: "Security", icon: Shield },
    { key: "payments", label: "Payments", icon: CreditCard },
    { key: "import-data", label: "Import data", icon: Upload },
    { key: "export-data", label: "Export data", icon: Download },
];

function NavGroup({ title, items, onNavigate }) {
    return (
        <div className="sidebar-group">
            <div className="sidebar-group-title">{title}</div>
            <nav className="sidebar-nav">
                {items.map(({ key, label, icon: Icon, badge, active }) => (
                    <button
                        key={key}
                        type="button"
                        className={`sidebar-link ${active ? "active" : ""}`}
                        onClick={() => onNavigate?.()}
                    >
                        <span className="sidebar-link-main">
                            <Icon size={16} />
                            <span>{label}</span>
                        </span>
                        {badge ? <span className="sidebar-badge">{badge}</span> : null}
                    </button>
                ))}
            </nav>
        </div>
    );
}

export default function Sidebar({ onNavigate }) {
    return (
        <div className="sidebar-inner">
            <div className="sidebar-brand">
                <button type="button" className="brand-pill">
                    <Building2 size={15} />
                    <span>Company</span>
                    <ChevronDown size={14} />
                </button>

                <button type="button" className="icon-square" aria-label="Edit workspace">
                    <SquarePen size={16} />
                </button>
            </div>

            <div className="sidebar-actions">
                <button type="button" className="quick-action">
                    <span>Quick actions</span>
                    <kbd>⌘K</kbd>
                </button>
                <button type="button" className="search-shortcut" aria-label="Search shortcut">
                    /
                </button>
            </div>

            <NavGroup title="General" items={generalItems} onNavigate={onNavigate} />
            <NavGroup title="Ventures" items={ventureItems} onNavigate={onNavigate} />
        </div>
    );
}
