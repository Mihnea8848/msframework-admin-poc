import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import { PAGES, groupPages } from "../routes/navigation";
import "./quick-actions.css";

type QuickActionsProps = {
    open: boolean;
    onClose: () => void;
};

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * The Quick Actions palette (Ctrl/Cmd+K or `/`, opened by AppShell): a search box over every page
 * the user may open. Arrow keys move the selection, Enter opens it, Escape or the backdrop
 * closes the palette, and focus returns to whatever had it before. A native modal <dialog>;
 * where showModal() is missing (jsdom) it uses the open attribute with its own focus trap.
 * It is mounted only while open, so the query starts empty every time.
 */
export default function QuickActions({ open, onClose }: QuickActionsProps) {
    return open ? <Palette onClose={onClose} /> : null;
}

function Palette({ onClose }: { onClose: () => void }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [focusedIdx, setFocusedIdx] = useState(0);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const onCloseRef = useRef(onClose);
    const listId = useId();
    const titleId = useId();

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    const allowed = useMemo(() => PAGES.filter((p) => hasPermission(user, p.permission)), [user]);

    const q = query.trim().toLowerCase();
    const filtered = q
        ? allowed.filter((r) => r.label.toLowerCase().includes(q) || r.path.toLowerCase().includes(q))
        : allowed;
    const groups = groupPages(filtered);
    // The options in display order (grouped), so the arrow keys follow what is on screen.
    const ordered = groups.flatMap((g) => g.pages);
    const active = ordered[focusedIdx];
    const optionId = (key: string) => `${listId}-${key}`;

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return undefined;
        const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (typeof dialog.showModal === "function") {
            if (!dialog.open) dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }
        inputRef.current?.focus();

        const close = () => onCloseRef.current();
        // Native Escape: keep React state in charge of closing.
        const onCancel = (e: Event) => {
            e.preventDefault();
            close();
        };
        // A press on the dialog element itself is on the backdrop: the panel fills the rest.
        const onMouseDown = (e: MouseEvent) => {
            if (e.target === dialog) close();
        };
        dialog.addEventListener("cancel", onCancel);
        dialog.addEventListener("mousedown", onMouseDown);

        return () => {
            dialog.removeEventListener("cancel", onCancel);
            dialog.removeEventListener("mousedown", onMouseDown);
            if (typeof dialog.close === "function") {
                if (dialog.open) dialog.close();
            } else {
                dialog.removeAttribute("open");
            }
            if (trigger?.isConnected) trigger.focus();
        };
    }, []);

    // Keep the selected option in view while moving through a long list.
    useEffect(() => {
        if (!active) return;
        document.getElementById(optionId(active.key))?.scrollIntoView?.({ block: "nearest" });
    });

    function go(path: string) {
        navigate(path);
        onClose();
    }

    function handleKey(e: ReactKeyboardEvent<HTMLDialogElement>) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setFocusedIdx((i) => Math.min(i + 1, ordered.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setFocusedIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && active) {
            e.preventDefault();
            go(active.path);
        } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        } else if (e.key === "Tab") {
            const dialog = dialogRef.current;
            if (!dialog) return;
            const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
            const head = items[0];
            const tail = items[items.length - 1];
            if (!head || !tail) return;
            if (e.shiftKey && document.activeElement === head) {
                e.preventDefault();
                tail.focus();
            } else if (!e.shiftKey && document.activeElement === tail) {
                e.preventDefault();
                head.focus();
            }
        }
    }

    let runningIdx = 0;

    return (
        <dialog ref={dialogRef} className="ms-palette" aria-labelledby={titleId} onKeyDown={handleKey}>
            <div className="ms-palette__panel">
                <h2 className="ms-visually-hidden" id={titleId}>Quick actions</h2>
                <div className="ms-palette__search">
                    <Search className="ms-palette__search-icon" aria-hidden="true" />
                    <label className="ms-visually-hidden" htmlFor={`${listId}-q`}>Search pages</label>
                    <input
                        ref={inputRef}
                        id={`${listId}-q`}
                        className="ms-palette__input"
                        type="text"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls={listId}
                        aria-autocomplete="list"
                        aria-activedescendant={active ? optionId(active.key) : undefined}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Search pages…"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setFocusedIdx(0); }}
                    />
                    {query && (
                        <button
                            type="button"
                            className="ms-palette__clear"
                            onClick={() => { setQuery(""); setFocusedIdx(0); inputRef.current?.focus(); }}
                        >
                            Clear
                        </button>
                    )}
                </div>

                <div className="ms-palette__results">
                    {filtered.length === 0 && (
                        <p className="ms-palette__empty" role="status">No pages match &ldquo;{query}&rdquo;</p>
                    )}
                    <ul className="ms-palette__list" id={listId} role="listbox" aria-label="Pages">
                        {groups.map(({ group, pages }) => (
                            <li key={group} role="presentation">
                                <ul className="ms-palette__group" role="group" aria-labelledby={`${listId}-g-${group}`}>
                                    <li className="ms-palette__group-label" id={`${listId}-g-${group}`} role="presentation">{group}</li>
                                    {pages.map((item) => {
                                        const idx = runningIdx++;
                                        const Icon = item.icon;
                                        return (
                                            // Keyboard use goes through the combobox (aria-activedescendant).
                                            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                                            <li
                                                key={item.path}
                                                id={optionId(item.key)}
                                                className="ms-palette__option"
                                                role="option"
                                                aria-selected={focusedIdx === idx}
                                                onMouseEnter={() => setFocusedIdx(idx)}
                                                onClick={() => go(item.path)}
                                            >
                                                <span className="ms-palette__option-icon" aria-hidden="true"><Icon /></span>
                                                <span className="ms-palette__option-label">{item.label}</span>
                                                <span className="ms-palette__option-path">{item.path}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="ms-palette__foot" aria-hidden="true">
                    <span><kbd className="ms-palette__kbd">↑↓</kbd> navigate</span>
                    <span><kbd className="ms-palette__kbd">↵</kbd> open</span>
                    <span><kbd className="ms-palette__kbd">Esc</kbd> close</span>
                </div>
            </div>
        </dialog>
    );
}
