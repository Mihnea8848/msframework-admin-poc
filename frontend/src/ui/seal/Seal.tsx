import type { SealKey } from "./seals";
import { SEAL_ICONS } from "./seals";
import "./seal.css";

/** The small round seal shown next to a department name. Decorative; `null` draws an empty ring. */
export function SealMini({ seal }: { seal: SealKey | null }) {
    if (!seal) return <span className="ms-seal-mini ms-seal-mini--empty" aria-hidden="true" />;
    const Icon = SEAL_ICONS[seal];
    return (
        <span className="ms-seal-mini" data-seal={seal} aria-hidden="true">
            <Icon />
        </span>
    );
}
