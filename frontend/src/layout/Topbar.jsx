import { useNavigate } from "react-router-dom";
import { ChevronLeft, Home, ChevronRight, Menu, Settings, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { primaryRole } from "../auth/permissions";
import { initialsOf } from "../utils/format";

export default function Topbar({ onOpenSidebar }) {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    const actions = [
        { label: "Back", icon: ChevronLeft, onClick: () => navigate(-1) },
        { label: "Home", icon: Home, onClick: () => navigate("/") },
        { label: "Forward", icon: ChevronRight, onClick: () => navigate(1) },
    ];

    return (
        <div className="topbar-shell">
            <button onClick={onOpenSidebar} className="topbar-mobile-trigger" type="button" aria-label="Open sidebar">
                <Menu size={18} />
            </button>

            <div className="topbar-actions" aria-label="Navigation actions">
                {actions.map((action) => {
                    const NavIcon = action.icon;
                    return (
                        <button
                            key={action.label}
                            type="button"
                            className="topbar-icon-button"
                            aria-label={action.label}
                            title={action.label}
                            onClick={action.onClick}
                        >
                            <NavIcon size={18} />
                        </button>
                    );
                })}
            </div>

            <div className="topbar-path">Ventures</div>

            <div className="topbar-user">
                {user && (
                    <>
                        <div className="topbar-avatar" aria-hidden="true">{initialsOf(user.fullName, user.email?.[0] || "?")}</div>
                        <span className="topbar-user-name" title={`${user.email} · ${primaryRole(user)}`}>
                            {user.fullName || user.email}
                        </span>
                    </>
                )}
                <button
                    type="button"
                    className="topbar-icon-button topbar-user-settings"
                    aria-label="Account settings"
                    title="Account settings"
                    onClick={() => navigate("/auth")}
                >
                    <Settings size={16} />
                </button>
                <button
                    type="button"
                    className="topbar-icon-button topbar-user-logout"
                    aria-label="Log out"
                    title="Log out"
                    onClick={handleLogout}
                >
                    <LogOut size={16} />
                </button>
            </div>
        </div>
    );
}
