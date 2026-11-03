import type { MouseEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { prefetchPage } from "../app/pages";
import { viewTransitionsEnabled } from "../app/transitions";
import type { PageEntry } from "../routes/navigation";

type PageLinkProps = {
    page: PageEntry;
    current: boolean;
    className: string;
    children: ReactNode;
    /** Called after a plain click navigates (closes the More sheet, for example). */
    onNavigate?: () => void;
    "aria-label"?: string;
    "data-label"?: string;
};

function isPlainClick(e: MouseEvent<HTMLAnchorElement>): boolean {
    return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/**
 * A link to a shell page. It prefetches the page's chunk on hover and focus, marks the current
 * page with aria-current, and navigates with a view transition when motion allows it (decided at
 * click time, so a change on the Appearance page applies at once).
 */
export default function PageLink({ page, current, className, children, onNavigate, ...rest }: PageLinkProps) {
    const navigate = useNavigate();
    const prefetch = () => prefetchPage(page.key);

    function onClick(e: MouseEvent<HTMLAnchorElement>) {
        if (!isPlainClick(e)) return;
        e.preventDefault();
        if (!current) navigate(page.path, { viewTransition: viewTransitionsEnabled() });
        onNavigate?.();
    }

    return (
        <Link
            to={page.path}
            className={className}
            aria-current={current ? "page" : undefined}
            onMouseEnter={prefetch}
            onFocus={prefetch}
            onTouchStart={prefetch}
            onClick={onClick}
            {...rest}
        >
            {children}
        </Link>
    );
}
