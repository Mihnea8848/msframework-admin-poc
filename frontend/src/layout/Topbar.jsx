import { ChevronLeft, ChevronRight, Menu, RotateCcw } from "lucide-react";

const actions = [
    { label: "Back", icon: ChevronLeft },
    { label: "Forward", icon: ChevronRight },
    { label: "Refresh", icon: RotateCcw },
];

export default function Topbar({ onOpenSidebar }) {
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
                {actions.map(({ label }) => (
                    <button key={label} type="button" className="topbar-icon-button" aria-label={label}>
                    </button>
                ))}
            </div>

            <div className="topbar-path">Ventures / User management</div>
        </div>
    );
}
