import { useEffect } from "react";
import { createPortal } from "react-dom";

/** Centered dialog. Closes on Escape or backdrop click unless `busy`. */
export default function Modal({ title, subtitle, onClose, busy = false, maxWidth = 440, children }) {
    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape" && !busy) onClose();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose, busy]);

    return createPortal(
        <div
            className="modal-overlay"
            onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
        >
            <div className="modal-panel" style={{ maxWidth }} role="dialog" aria-modal="true" aria-label={title}>
                {title && <h2 className="modal-title">{title}</h2>}
                {subtitle && <p className="modal-subtitle">{subtitle}</p>}
                {children}
            </div>
        </div>,
        document.body
    );
}

export function ModalActions({ children }) {
    return <div className="modal-actions">{children}</div>;
}
