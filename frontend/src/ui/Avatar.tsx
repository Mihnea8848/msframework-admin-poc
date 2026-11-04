import { initialsOf } from "../utils/format";
import "./avatar.css";

type AvatarProps = {
    name: string | null | undefined;
    /** "sm" 28px (lists), "md" 32px (tables, the default), "lg" 72px (a profile header). */
    size?: "sm" | "md" | "lg";
    className?: string;
};

/** A person's initials in a square tile. Decorative: put the name in text next to it. */
export default function Avatar({ name, size = "md", className }: AvatarProps) {
    return (
        <span className={`ms-avatar ms-avatar--${size}${className ? ` ${className}` : ""}`} aria-hidden="true">
            {initialsOf(name, "U")}
        </span>
    );
}
