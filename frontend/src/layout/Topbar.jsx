import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Home, ChevronRight, Menu } from "lucide-react";

export default function Topbar({ onOpenSidebar }) {
    const navigate = useNavigate();
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

    const actions = [
        { label: "Back", icon: ChevronLeft, onClick: handleBack, disabled: false },
        { label: "Home", icon: Home, onClick: handleHome, disabled: false },
        { label: "Forward", icon: ChevronRight, onClick: handleForward, disabled: !forwardAvailable },
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
                {actions.map(({ label, onClick, disabled }) => (
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
        </div>
    );
}
