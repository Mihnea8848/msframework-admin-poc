import { Search } from "lucide-react";
import Logo from "../ui/brand/Logo";
import { groupPages, isCurrentPage } from "../routes/navigation";
import type { PageEntry } from "../routes/navigation";
import PageLink from "./PageLink";
import { badgeLabel } from "./badges";
import type { PageBadges } from "./badges";
import { shortcutLabel } from "./shortcuts";
import "./sidebar.css";

type SidebarProps = {
    pages: readonly PageEntry[];
    pathname: string;
    /** Count badges by page: unread activity ("3", "50+"), pending access requests. */
    badges: PageBadges;
    onOpenQuickActions: () => void;
};

/**
 * The sidebar: full width from 1024 px, an icon rail from 768 to 1023 px (labels become
 * tooltips and stay the links' accessible names), hidden below 768 px where BottomNav takes over.
 */
export default function Sidebar({ pages, pathname, badges, onOpenQuickActions }: SidebarProps) {
    return (
        <aside className="ms-sidebar" aria-label="Sidebar">
            <div className="ms-sidebar__head">
                <Logo className="ms-sidebar__logo" />
                <div className="ms-sidebar__brand">
                    <p className="ms-sidebar__word">MSFramework</p>
                    <p className="ms-sidebar__sub">MEH Studios Inc</p>
                </div>
            </div>

            <button
                type="button"
                className="ms-sidebar__qa"
                aria-haspopup="dialog"
                aria-keyshortcuts="Control+K Meta+K /"
                aria-label="Quick actions"
                data-label="Quick actions"
                onClick={onOpenQuickActions}
            >
                <Search className="ms-sidebar__qa-icon" aria-hidden="true" />
                <span className="ms-sidebar__qa-text" aria-hidden="true">Quick actions</span>
                <kbd className="ms-sidebar__kbd" aria-hidden="true">{shortcutLabel()}</kbd>
            </button>

            <nav className="ms-sidebar__nav" aria-label="Main">
                {groupPages(pages).map(({ group, pages: items }) => (
                    <div className="ms-sidebar__group" key={group}>
                        <p className="ms-sidebar__group-title" id={`ms-nav-${group}`}>{group}</p>
                        <ul className="ms-sidebar__list" aria-labelledby={`ms-nav-${group}`}>
                            {items.map((page) => {
                                const Icon = page.icon;
                                const itemBadge = badges[page.key] ?? null;
                                return (
                                    <li key={page.key}>
                                        <PageLink
                                            page={page}
                                            current={isCurrentPage(page, pathname)}
                                            className="ms-sidebar__item"
                                            data-label={page.label}
                                        >
                                            <Icon className="ms-sidebar__icon" aria-hidden="true" />
                                            <span className="ms-sidebar__label">{page.label}</span>
                                            {itemBadge ? (
                                                <>
                                                    <span className="ms-sidebar__badge" aria-hidden="true">{itemBadge}</span>
                                                    <span className="ms-visually-hidden">{badgeLabel(page.key, itemBadge)}</span>
                                                </>
                                            ) : null}
                                        </PageLink>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            <p className="ms-sidebar__foot">Multimedia Entertainment Hub</p>
        </aside>
    );
}
