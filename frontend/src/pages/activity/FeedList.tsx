import type { ReactNode } from "react";
import type { AuditEventDto } from "../../api/types";
import { relTime, formatDateTime } from "../../utils/format";
import { auditMeta } from "../../utils/auditTypes";
import type { AuditTypeMeta } from "../../utils/auditTypes";
import { useReveal } from "../../ui/useReveal";
import "../../ui/list.css";
import "../../ui/surface.css";
import "./activity.css";

type Tone = "ok" | "warn" | "danger" | "info" | "neutral";

/** The status tone behind an event type's colour token, for the icon tile. */
function toneOf(meta: AuditTypeMeta): Tone {
    const match = /--status-(ok|warn|danger|info)-fg/.exec(meta.color);
    return (match?.[1] as Tone | undefined) ?? "neutral";
}

interface FeedListProps {
    events: readonly AuditEventDto[];
    /** Rows get the reveal animation once this is true (after the first load). */
    ready: boolean;
    /** Events that get the "New" edge and tag (Activity: notable events since the last visit). */
    isNew?: (event: AuditEventDto) => boolean;
    /** Who did it, as shown on the row (for example "You" on Activity). Defaults to the actor's email. */
    actorLabel?: (event: AuditEventDto) => ReactNode;
}

/** The event rows shared by Activity and the Audit log: icon tile, type, actor, text and time. */
export default function FeedList({ events, ready, isNew: isNewEvent, actorLabel }: FeedListProps) {
    const reveal = useReveal(ready);
    return (
        <ol className="ms-panel ms-feed">
            {events.map((ev, i) => {
                const meta = auditMeta(ev.eventType);
                const isNew = isNewEvent ? isNewEvent(ev) : false;
                return (
                    <li key={ev.id} {...reveal(i, `ms-feed__item${isNew ? " ms-feed__item--new" : ""}`)}>
                        <span className={`ms-feed__icon ms-feed__icon--${toneOf(meta)}`} aria-hidden="true"><meta.Icon /></span>
                        <div className="ms-feed__body">
                            <p className="ms-feed__top">
                                <span className="ms-feed__type">{meta.label}</span>
                                {isNew && <span className="ms-feed__new">New</span>}
                                <span className="ms-feed__actor">{actorLabel ? actorLabel(ev) : ev.actorEmail}</span>
                            </p>
                            <p className="ms-feed__text">{ev.description}</p>
                        </div>
                        <time className="ms-feed__time" dateTime={ev.createdAt} title={formatDateTime(ev.createdAt)}>{relTime(ev.createdAt)}</time>
                    </li>
                );
            })}
        </ol>
    );
}
