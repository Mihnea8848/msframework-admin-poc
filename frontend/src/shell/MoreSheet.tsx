import { useEffect, useId, useRef } from "react";
import type { RefObject } from "react";
import { LogOut, Settings, X } from "lucide-react";
import { SETTINGS_PATH, groupPages, isCurrentPage } from "../routes/navigation";
import type { PageEntry } from "../routes/navigation";
import PageLink from "./PageLink";
import { badgeLabel } from "./badges";
import type { PageBadges } from "./badges";
import "./more-sheet.css";

type MoreSheetProps = {
    open: boolean;
    onClose: () => void;
    /** The pages that are not bottom bar tabs, from morePages(). */
    pages: readonly PageEntry[];
    pathname: string;
    /** Count badges by page (see Sidebar). */
    badges: PageBadges;
    onLogout: () => void;
    /** The current path is a Settings tab. */
    inSettings?: boolean;
    /** Gets focus back when the sheet closes (the More button). Defaults to whatever had focus. */
    returnFocusRef?: RefObject<HTMLElement | null>;
};

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * The phone "More" bottom sheet: every permitted page that is not a tab, grouped as in the
 * sidebar, plus Settings and Log out. A native modal <dialog> (focus stays inside, the page behind is inert);
 * Escape, the close button, the backdrop and choosing a page close it, and focus returns to
 * the button that opened it. Where showModal() is missing (jsdom) it falls back to the open
 * attribute with its own focus trap.
 */
export default function MoreSheet({ open, onClose, pages, pathname, badges, onLogout, inSettings = false, returnFocusRef }: MoreSheetProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const onCloseRef = useRef(onClose);
    const titleId = useId();

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const dialog = ref.current;
        if (!open || !dialog) return undefined;

        const trigger = returnFocusRef?.current
            ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        if (typeof dialog.showModal === "function") {
            if (!dialog.open) dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }
        dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();

        const close = () => onCloseRef.current();
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                close();
            } else if (e.key === "Tab") {
                const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
                const first = items[0];
                const last = items[items.length - 1];
                if (!first || !last) return;
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        // The native Escape handling: keep React state in charge of closing.
        const onCancel = (e: Event) => {
            e.preventDefault();
            close();
        };
        // A click on the dialog element itself is a click on the backdrop: the panel fills the rest.
        const onClick = (e: MouseEvent) => {
            if (e.target === dialog) close();
        };
        dialog.addEventListener("keydown", onKeyDown);
        dialog.addEventListener("cancel", onCancel);
        dialog.addEventListener("click", onClick);

        return () => {
            dialog.removeEventListener("keydown", onKeyDown);
            dialog.removeEventListener("cancel", onCancel);
            dialog.removeEventListener("click", onClick);
            if (typeof dialog.close === "function") {
                if (dialog.open) dialog.close();
            } else {
                dialog.removeAttribute("open");
            }
            if (trigger?.isConnected) trigger.focus();
        };
    }, [open, returnFocusRef]);

    return (
        <dialog ref={ref} className="ms-more-sheet" aria-labelledby={titleId}>
            <div className="ms-more-sheet__panel">
                <div className="ms-more-sheet__grip" aria-hidden="true" />
                <div className="ms-more-sheet__head">
                    <div>
                        <p className="ms-more-sheet__eyebrow">Menu</p>
                        <h2 className="ms-more-sheet__title" id={titleId}>More</h2>
                    </div>
                    <button type="button" className="ms-more-sheet__close" aria-label="Close" data-autofocus onClick={onClose}>
                        <X aria-hidden="true" />
                    </button>
                </div>

                <div className="ms-more-sheet__body">
                    {groupPages(pages).map(({ group, pages: items }) => (
                        <section key={group} className="ms-more-sheet__group" aria-label={group}>
                            <p className="ms-more-sheet__group-title" aria-hidden="true">{group}</p>
                            <ul className="ms-more-sheet__list">
                                {items.map((page) => {
                                    const Icon = page.icon;
                                    const itemBadge = badges[page.key] ?? null;
                                    return (
                                        <li key={page.key}>
                                            <PageLink
                                                page={page}
                                                current={isCurrentPage(page, pathname)}
                                                className="ms-more-sheet__item"
                                                onNavigate={onClose}
                                            >
                                                <Icon className="ms-more-sheet__icon" aria-hidden="true" />
                                                <span>{page.label}</span>
                                                {itemBadge ? (
                                                    <>
                                                        <span className="ms-more-sheet__badge" aria-hidden="true">{itemBadge}</span>
                                                        <span className="ms-visually-hidden">{badgeLabel(page.key, itemBadge)}</span>
                                                    </>
                                                ) : null}
                                            </PageLink>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>

                <div className="ms-more-sheet__foot">
                    <PageLink
                        page={{ key: "settings", path: SETTINGS_PATH }}
                        current={inSettings}
                        className="ms-more-sheet__settings"
                        onNavigate={onClose}
                    >
                        <Settings aria-hidden="true" />
                        <span>Settings</span>
                    </PageLink>
                    <button type="button" className="ms-more-sheet__logout" onClick={() => { onClose(); onLogout(); }}>
                        <LogOut aria-hidden="true" />
                        <span>Log out</span>
                    </button>
                </div>
            </div>
        </dialog>
    );
}
