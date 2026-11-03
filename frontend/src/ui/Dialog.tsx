import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import "./dialog.css";

type DialogProps = {
    title: ReactNode;
    /** Small label above the title ("Users", "Delete user"). */
    eyebrow?: ReactNode;
    /** A line under the title. */
    description?: ReactNode;
    onClose: () => void;
    /** While true, Escape, the backdrop and the close button do nothing. */
    busy?: boolean;
    /** "sm" for confirmations, "md" (default) for forms. */
    size?: "sm" | "md";
    /** "danger" colours the eyebrow for destructive confirmations. */
    tone?: "default" | "danger";
    children: ReactNode;
};

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * A modal dialog on the native <dialog> element, mounted while it is open. Below 768px it is a
 * bottom sheet. Escape, the backdrop and the close button call `onClose` (unless `busy`); focus
 * goes to the first `[data-autofocus]` element (or the first field) and returns to the element
 * that had it when the dialog closes. Where showModal() is missing (jsdom) it uses the `open`
 * attribute with its own focus trap. Put `DialogBody` and `DialogFooter` inside (a form may
 * wrap both).
 */
export default function Dialog({ title, eyebrow, description, onClose, busy = false, size = "md", tone = "default", children }: DialogProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const descId = useId();
    const onCloseRef = useRef(onClose);
    const busyRef = useRef(busy);

    useEffect(() => {
        onCloseRef.current = onClose;
        busyRef.current = busy;
    }, [onClose, busy]);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return undefined;
        const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (typeof dialog.showModal === "function") {
            if (!dialog.open) dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }
        const first = dialog.querySelector<HTMLElement>("[data-autofocus]")
            ?? dialog.querySelector<HTMLElement>(".ms-dialog__body input:not([disabled]), .ms-dialog__body select:not([disabled])");
        first?.focus();

        const requestClose = () => {
            if (!busyRef.current) onCloseRef.current();
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                requestClose();
            } else if (e.key === "Tab") {
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
        };
        const onCancel = (e: Event) => {
            e.preventDefault();
            requestClose();
        };
        // A click on the <dialog> itself is a click on the backdrop: the panel covers the rest.
        const onClick = (e: MouseEvent) => {
            if (e.target === dialog) requestClose();
        };
        dialog.addEventListener("keydown", onKeyDown);
        dialog.addEventListener("cancel", onCancel);
        dialog.addEventListener("click", onClick);
        return () => {
            dialog.removeEventListener("keydown", onKeyDown);
            dialog.removeEventListener("cancel", onCancel);
            dialog.removeEventListener("click", onClick);
            if (typeof dialog.close === "function" && dialog.open) dialog.close();
            else dialog.removeAttribute("open");
            if (trigger?.isConnected) trigger.focus();
        };
    }, []);

    return (
        <dialog
            ref={ref}
            className={`ms-dialog ms-dialog--${size}${tone === "danger" ? " ms-dialog--danger" : ""}`}
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
        >
            <div className="ms-dialog__panel">
                <span className="ms-dialog__grip" aria-hidden="true" />
                <div className="ms-dialog__head">
                    <div className="ms-dialog__heading">
                        {eyebrow ? <p className="ms-dialog__eyebrow">{eyebrow}</p> : null}
                        <h2 className="ms-dialog__title" id={titleId}>{title}</h2>
                        {description ? <p className="ms-dialog__desc" id={descId}>{description}</p> : null}
                    </div>
                    <button type="button" className="ms-dialog__close" onClick={() => { if (!busy) onClose(); }} disabled={busy} aria-label="Close">
                        <X aria-hidden="true" />
                    </button>
                </div>
                <div className="ms-dialog__stripe" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
                {children}
            </div>
        </dialog>
    );
}

export function DialogBody({ children }: { children: ReactNode }) {
    return <div className="ms-dialog__body">{children}</div>;
}

export function DialogFooter({ children }: { children: ReactNode }) {
    return <div className="ms-dialog__foot">{children}</div>;
}
