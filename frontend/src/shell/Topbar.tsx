import { ChevronLeft, ChevronRight, LogOut, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { CurrentUserDto } from "../api/types";
import { prefetchPage } from "../app/pages";
import { primaryRole } from "../auth/permissions";
import Logo from "../ui/brand/Logo";
import { initialsOf } from "../utils/format";
import { SETTINGS_PATH } from "../routes/navigation";
import "./topbar.css";

type TopbarProps = {
    user: CurrentUserDto;
    /** The "Group / Page" breadcrumb for the current path (crumbFor), or null. */
    crumb: { group: string; label: string } | null;
    /** The current path is a Settings tab. */
    inSettings: boolean;
    onLogout: () => void;
};

const prefetchSettings = () => prefetchPage("settings");

/**
 * The top bar, ported from the concept: back and forward, the "Group / Page" breadcrumb, and
 * the user chip with settings and log out. The chip and the cog both open Settings. Below 768px
 * it shrinks to the logo, the page title and two icon buttons, so it never overflows a 360px
 * screen.
 */
export default function Topbar({ user, crumb, inSettings, onLogout }: TopbarProps) {
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
                    {crumb ? <li className="ms-topbar__crumb ms-topbar__crumb--group">{crumb.group}</li> : null}
                    <li className="ms-topbar__crumb" aria-current="page">{crumb?.label ?? "MSFramework"}</li>
                </ol>
            </nav>

            <Link
                to={`${SETTINGS_PATH}/account`}
                className="ms-topbar__user"
                aria-label={`Account settings for ${name}`}
                onMouseEnter={prefetchSettings}
                onFocus={prefetchSettings}
            >
                <span className="ms-topbar__avatar" aria-hidden="true">{initialsOf(user.fullName, user.email?.[0] || "?")}</span>
                <span className="ms-topbar__who" aria-hidden="true">
                    <span className="ms-topbar__name" title={user.email}>{name}</span>
                    <span className="ms-topbar__role"><span className="ms-topbar__tag">{role}</span></span>
                </span>
            </Link>

            <span className="ms-topbar__sep" aria-hidden="true" />

            <Link
                to={SETTINGS_PATH}
                className="ms-topbar__icon"
                aria-label="Settings"
                title="Settings"
                aria-current={inSettings ? "page" : undefined}
                onMouseEnter={prefetchSettings}
                onFocus={prefetchSettings}
                onTouchStart={prefetchSettings}
            >
                <Settings aria-hidden="true" />
            </Link>
            <button type="button" className="ms-topbar__logout" onClick={onLogout}>
                <LogOut aria-hidden="true" />
                <span className="ms-topbar__logout-text">Log out</span>
            </button>
        </header>
    );
}
