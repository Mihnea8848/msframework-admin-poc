import { CircleCheck, CircleMinus } from "lucide-react";
import "./list.css";

/** A user's status as a pill: Active (with a tick) or Inactive. Never colour alone. */
export default function StatusPill({ status }: { status: string | null | undefined }) {
    const label = status || "Active";
    const active = label === "Active";
    const Icon = active ? CircleCheck : CircleMinus;
    return (
        <span className={`ms-status ms-status--${active ? "ok" : "neutral"}`}>
            <Icon aria-hidden="true" />
            {label}
        </span>
    );
}
