import type { ReactNode } from "react";
import "./page-header.css";

export type PageHeaderProps = {
    /** The small accent label above the title, usually the navigation group ("General"). */
    eyebrow?: ReactNode;
    /**
     * Older pages pass "Group / Page". Its first segment becomes the eyebrow when `eyebrow` is
     * not given.
     */
    breadcrumb?: string | null;
    title: ReactNode;
    /** A number shown in a small box after the title (for example the row count). */
    count?: number | string | null;
    /** Plain-language description under the title. */
    description?: ReactNode;
    /** Older name for `description`. */
    subtitle?: ReactNode;
    /** Buttons on the right. `false` and `null` render nothing, so `canCreate && <Button/>` works. */
    actions?: ReactNode;
    /** The three-segment stripe under the header. On by default. */
    stripe?: boolean;
};

function eyebrowFrom(breadcrumb: string | null | undefined): string | undefined {
    const first = breadcrumb?.split("/")[0]?.trim();
    return first || undefined;
}

/** The standard page heading: eyebrow, title (with an optional count), description, actions, stripe. */
export default function PageHeader({
    eyebrow,
    breadcrumb,
    title,
    count,
    description,
    subtitle,
    actions,
    stripe = true,
}: PageHeaderProps) {
    const label = eyebrow ?? eyebrowFrom(breadcrumb);
    const desc = description ?? subtitle;
    const hasCount = count !== undefined && count !== null && count !== "";
    const hasActions = actions !== undefined && actions !== null && actions !== false;

    return (
        <header className="ms-page-header">
            <div className="ms-page-header__row">
                <div className="ms-page-header__text">
                    {label ? <p className="ms-page-header__eyebrow">{label}</p> : null}
                    <h1 className="ms-page-header__title">
                        <span>{title}</span>
                        {hasCount ? (
                            <span className="ms-page-header__count">
                                <span className="ms-page-header__sr">, </span>
                                {count}
                            </span>
                        ) : null}
                    </h1>
                    {desc ? <p className="ms-page-header__desc">{desc}</p> : null}
                </div>
                {hasActions ? <div className="ms-page-header__actions">{actions}</div> : null}
            </div>
            {stripe ? (
                <div className="ms-page-header__stripe" aria-hidden="true" data-testid="page-header-stripe">
                    <span />
                    <span />
                    <span />
                    <i />
                </div>
            ) : null}
        </header>
    );
}
