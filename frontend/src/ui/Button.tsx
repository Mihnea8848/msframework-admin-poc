import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "md" | "sm";
    /** Stretch to the width of the container. */
    full?: boolean;
    /** An icon (usually a lucide-react element) shown before the label. */
    icon?: ReactNode;
};

/**
 * The Chevron button. The <button> carries the focus ring; the inner face carries the clipped
 * shape, so the ring is never cut off by clip-path.
 */
export default function Button({
    variant = "secondary",
    size = "md",
    full = false,
    icon,
    className,
    children,
    type = "button",
    ...rest
}: ButtonProps) {
    const classes = ["ms-btn", `ms-btn--${variant}`];
    if (size === "sm") classes.push("ms-btn--sm");
    if (full) classes.push("ms-btn--full");
    if (className) classes.push(className);
    return (
        <button type={type} className={classes.join(" ")} {...rest}>
            <span className="ms-btn__face">
                {icon}
                {children}
            </span>
        </button>
    );
}
