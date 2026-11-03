import type { ReactNode } from "react";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import "./alert.css";

export type AlertTone = "ok" | "info" | "warn" | "danger";

const ICONS = { ok: CircleCheck, info: Info, warn: TriangleAlert, danger: TriangleAlert } as const;

type AlertProps = {
    tone: AlertTone;
    children: ReactNode;
    /** "alert" for errors that appear after an action; "status" for polite notices. */
    role?: "alert" | "status";
    className?: string;
};

/** A one-block message with a status colour and icon (notices, server errors). */
export default function Alert({ tone, children, role, className }: AlertProps) {
    const Icon = ICONS[tone];
    return (
        <div className={`ms-alert ms-alert--${tone}${className ? ` ${className}` : ""}`} role={role}>
            <Icon className="ms-alert__icon" aria-hidden="true" />
            <div className="ms-alert__body">{children}</div>
        </div>
    );
}
