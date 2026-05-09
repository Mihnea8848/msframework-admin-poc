import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import QuickActions from "../ui/QuickActions.jsx";

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

    { key: "home", label: "Home", icon: Home, path: "/" },

    { key: "dashboard", label: "Dashboard", icon: Box, path: "/dashboard" },

    { key: "notifications", label: "Notifications", icon: Bell, badge: "10", path: "/notifications" },

    { key: "appearance", label: "Appearance", icon: Palette, path: "/appearance" },

    { key: "database", label: "Database", icon: Database, path: "/database" },

    { key: "connections", label: "Connections", icon: Cable, path: "/connections" },

    { key: "timezones", label: "Timezones", icon: Clock3, path: "/timezones" },

    { key: "documentation", label: "Documentation", icon: BookText, path: "/docs" },

];



const ventureItems = [

    { key: "authentication", label: "Authentication", icon: BriefcaseBusiness, path: "/auth" },

    // Point this to your actual User Management route

    { key: "user-management", label: "User management", icon: UsersRound, path: "/users" },

    // Point this to your actual Department CRUD route

    { key: "departments", label: "Departments", icon: Building2, path: "/departments" },

    { key: "security", label: "Security", icon: Shield, path: "/security" },

    { key: "payments", label: "Payments", icon: CreditCard, path: "/payments" },

    { key: "import-data", label: "Import data", icon: Upload, path: "/import" },

    { key: "export-data", label: "Export data", icon: Download, path: "/export" },

];



function NavGroup({ title, items }) {

    const location = useLocation(); // To highlight which tab is active



    return (

        <div className="sidebar-group">

            <div className="sidebar-group-title">{title}</div>

            <nav className="sidebar-nav">

                {/* eslint-disable-next-line no-unused-vars */}
                {items.map(({ key, label, badge, path, icon: Icon }) => {

                    const isActive = location.pathname === path;

                    return (

                        <Link

                            key={key}

                            to={path}

                            className={`sidebar-link ${isActive ? "active" : ""}`}

                        >

                            <span className="sidebar-link-main">

                                <Icon size={18} className="sidebar-icon" />

                                <span>{label}</span>

                            </span>

                            {badge ? <span className="sidebar-badge">{badge}</span> : null}

                        </Link>

                    );

                })}

            </nav>

        </div>

    );

}



export default function Sidebar() {
    const [qaOpen, setQaOpen] = useState(false);

    useEffect(() => {
        function onKey(e) {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setQaOpen(true);
            }
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    return (
        <>
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
                    <button type="button" className="quick-action" onClick={() => setQaOpen(true)}>
                        <span>Quick actions</span>
                        <kbd>⌘K</kbd>
                    </button>
                    <button type="button" className="search-shortcut" aria-label="Search shortcut" onClick={() => setQaOpen(true)}>
                        /
                    </button>
                </div>

                <NavGroup title="General" items={generalItems} />
                <NavGroup title="Ventures" items={ventureItems} />
            </div>

            <QuickActions open={qaOpen} onClose={() => setQaOpen(false)} />
        </>
    );
}