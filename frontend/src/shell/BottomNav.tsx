import type { Ref } from "react";
import { Ellipsis } from "lucide-react";
import { SHORT_LABELS, isCurrentPage } from "../routes/navigation";
import type { PageEntry } from "../routes/navigation";
import PageLink from "./PageLink";
import { badgeLabel, moreBadgeLabel } from "./badges";
import type { PageBadges } from "./badges";
import "./bottom-nav.css";

type BottomNavProps = {
    /** The tab pages, from mobileTabs(). */
    tabs: readonly PageEntry[];
    /** The pages in the More sheet, from morePages(). */
    more: readonly PageEntry[];
    pathname: string;
    /** Count badges by page (see Sidebar). */
    badges: PageBadges;
    moreOpen: boolean;
    onOpenMore: () => void;
    moreButtonRef?: Ref<HTMLButtonElement>;
};

/**
 * The phone tab bar (below 768px): the first four pages the user may open, ordered by
 * `mobilePriority` in navigation.ts, and a More button for the rest. 44px+ touch targets,
 * padded for the home indicator with env(safe-area-inset-bottom).
 */
export default function BottomNav({ tabs, more, pathname, badges, moreOpen, onOpenMore, moreButtonRef }: BottomNavProps) {
    const moreHasCurrent = more.some((p) => isCurrentPage(p, pathname));
    const moreLabel = moreBadgeLabel(more.map((p) => p.key), badges);
    const moreHasBadge = moreLabel !== "";

    return (
        <nav className="ms-bottom-nav" aria-label="Main">
            {tabs.map((page) => {
                const Icon = page.icon;
                const tabBadge = badges[page.key] ?? null;
                return (
                    <PageLink key={page.key} page={page} current={isCurrentPage(page, pathname)} className="ms-bottom-nav__tab">
                        <span className="ms-bottom-nav__icon-wrap">
                            <Icon className="ms-bottom-nav__icon" aria-hidden="true" />
                            {tabBadge ? <span className="ms-bottom-nav__dot" aria-hidden="true" /> : null}
                        </span>
                        <span className="ms-bottom-nav__label">{SHORT_LABELS[page.key] ?? page.label}</span>
                        {tabBadge ? <span className="ms-visually-hidden">{badgeLabel(page.key, tabBadge)}</span> : null}
                    </PageLink>
                );
            })}
            {more.length > 0 ? (
                <button
                    ref={moreButtonRef}
                    type="button"
                    className="ms-bottom-nav__tab"
                    aria-haspopup="dialog"
                    aria-expanded={moreOpen}
                    data-current={moreHasCurrent ? "true" : undefined}
                    onClick={onOpenMore}
                >
                    <span className="ms-bottom-nav__icon-wrap">
                        <Ellipsis className="ms-bottom-nav__icon" aria-hidden="true" />
                        {moreHasBadge ? <span className="ms-bottom-nav__dot" aria-hidden="true" /> : null}
                    </span>
                    <span className="ms-bottom-nav__label">More</span>
                    {moreHasBadge ? <span className="ms-visually-hidden">{moreLabel}</span> : null}
                </button>
            ) : null}
        </nav>
    );
}
