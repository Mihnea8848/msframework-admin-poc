import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Home, ChevronRight, Menu, Settings, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

function UserAvatar({ user }) {
    const initials = user?.fullName
        ? user.fullName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
        : (user?.email?.[0] || "?").toUpperCase();
    return (
        <div className="topbar-avatar" aria-hidden="true">
            {initials}
        </div>
    );
}

export default function Topbar({ onOpenSidebar }) {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [forwardAvailable, setForwardAvailable] = useState(false);

    const handleBack = () => {
        navigate(-1);
        setForwardAvailable(true);
    };

    const handleHome = () => {
        navigate("/");
        setForwardAvailable(false);
    };

    const handleForward = () => {
        navigate(1);
    };

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        } catch {
            // ignore network errors — clear local state regardless
        }
        logout();
        navigate("/login");
    };

    const actions = [
        { label: "Back",    icon: ChevronLeft,  onClick: handleBack,    disabled: false           },
        { label: "Home",    icon: Home,          onClick: handleHome,    disabled: false           },
        { label: "Forward", icon: ChevronRight,  onClick: handleForward, disabled: !forwardAvailable },
    ];

    return (
        <div className="topbar-shell">
            <button
                onClick={onOpenSidebar}
                className="topbar-mobile-trigger"
                type="button"
                aria-label="Open sidebar"
            >
                <Menu size={18} />
            </button>

            <div className="topbar-actions" aria-label="Navigation actions">
                {actions.map(({ label, icon: Icon, onClick, disabled }) => (
                    <button
                        key={label}
                        type="button"
                        className="topbar-icon-button"
                        aria-label={label}
                        onClick={onClick}
                        disabled={disabled}
                    >
                        <Icon size={18} />
                    </button>
                ))}
            </div>

            <div className="topbar-path">Ventures</div>

            <div className="topbar-user">
                {user && (
                    <>
                        <UserAvatar user={user} />
                        <span className="topbar-user-name">{user.fullName || user.email}</span>
                    </>
                )}
                <button
                    type="button"
                    className="topbar-icon-button topbar-user-settings"
                    aria-label="Account settings"
                    onClick={() => navigate("/auth")}
                >
                    <Settings size={16} />
                </button>
                <button
                    type="button"
                    className="topbar-icon-button topbar-user-logout"
                    aria-label="Log out"
                    onClick={handleLogout}
                >
                    <LogOut size={16} />
                </button>
            </div>
        </div>
    );
}
