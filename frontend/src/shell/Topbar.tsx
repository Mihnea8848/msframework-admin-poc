import { ChevronLeft, ChevronRight, LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { CurrentUserDto } from "../api/types";
import { primaryRole } from "../auth/permissions";
import Logo from "../ui/brand/Logo";
import { initialsOf } from "../utils/format";
import type { PageEntry } from "../routes/navigation";
import "./topbar.css";

type TopbarProps = {
    user: CurrentUserDto;
    page: PageEntry | undefined;
    onLogout: () => void;
};

/**
 * The top bar, ported from the concept: back and forward, the "Group / Page" breadcrumb, and
 * the user chip with settings and log out. Below 768px it shrinks to the logo, the page title
 * and two icon buttons, so it never overflows a 360px screen.
 */
export default function Topbar({ user, page, onLogout }: TopbarProps) {
    const navigate = useNavigate();
    const name = user.fullName || user.email;
    const role = primaryRole(user);

    return (
        <header className="ms-topbar">
            <div className="ms-topbar__history">
                <button type="button" className="ms-topbar__icon" aria-label="Back" title="Back" onClick={() => navigate(-1)}>
                    <ChevronLeft aria-hidden="true" />
                </button>
                <button type="button" className="ms-topbar__icon" aria-label="Forward" title="Forward" onClick={() => navigate(1)}>
                    <ChevronRight aria-hidden="true" />
                </button>
            </div>

            <Logo className="ms-topbar__logo" />

            <nav className="ms-topbar__crumbs-nav" aria-label="Breadcrumb">
                <ol className="ms-topbar__crumbs">
                    {page ? <li className="ms-topbar__crumb ms-topbar__crumb--group">{page.group}</li> : null}
                    <li className="ms-topbar__crumb" aria-current="page">{page?.label ?? "MSFramework"}</li>
                </ol>
            </nav>

            <div className="ms-topbar__user">
                <span className="ms-topbar__avatar" aria-hidden="true">{initialsOf(user.fullName, user.email?.[0] || "?")}</span>
                <div className="ms-topbar__who">
                    <p className="ms-topbar__name" title={user.email}>{name}</p>
                    <p className="ms-topbar__role"><span className="ms-topbar__tag">{role}</span></p>
                </div>
            </div>

            <span className="ms-topbar__sep" aria-hidden="true" />

            <button
                type="button"
                className="ms-topbar__icon"
                aria-label="Account settings"
                title="Account settings"
                onClick={() => navigate("/auth")}
            >
                <Settings aria-hidden="true" />
            </button>
            <button type="button" className="ms-topbar__logout" onClick={onLogout}>
                <LogOut aria-hidden="true" />
                <span className="ms-topbar__logout-text">Log out</span>
            </button>
        </header>
    );
}
