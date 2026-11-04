/**
 * Pure helpers for the directory sync panel (DirectorySync.tsx): grouping the planned changes,
 * describing field changes and summarising the counts. Tested in directorySync.test.ts.
 */
import type {
    DirectoryAction, DirectoryChange, DirectoryFieldChange, DirectorySyncCounts,
} from "../../api/directory";

export interface ChangeGroup {
    action: DirectoryAction;
    title: string;
    /** Shown open; skipped and unchanged people start collapsed. */
    open: boolean;
    tone: "ok" | "info" | "warn" | "danger" | "neutral";
    items: DirectoryChange[];
}

const GROUPS: readonly Omit<ChangeGroup, "items">[] = [
    { action: "create", title: "New users", open: true, tone: "ok" },
    { action: "link", title: "Linked to existing users", open: true, tone: "info" },
    { action: "update", title: "Updated", open: true, tone: "warn" },
    { action: "deactivate", title: "Deactivated", open: true, tone: "danger" },
    { action: "skip", title: "Skipped", open: false, tone: "neutral" },
    { action: "unchanged", title: "Unchanged", open: false, tone: "neutral" },
];

function sortKey(change: DirectoryChange): string {
    return (change.name ?? change.username ?? change.email ?? "").toLocaleLowerCase();
}

/** The changes in display order: one group per action that has people, each sorted by name. */
export function groupChanges(changes: readonly DirectoryChange[]): ChangeGroup[] {
    return GROUPS.map((group) => ({
        ...group,
        items: changes
            .filter((c) => c.action === group.action)
            .slice()
            .sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
    })).filter((group) => group.items.length > 0);
}

/** Skip reasons with how many people each applies to, most common first. */
export function skipReasons(changes: readonly DirectoryChange[]): { reason: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const change of changes) {
        if (change.action !== "skip") continue;
        const reason = change.reason ?? "No reason given";
        counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

const FIELD_LABELS: Record<DirectoryFieldChange["field"], string> = {
    name: "Name",
    email: "Email",
    username: "Authentik user name",
    status: "Status",
    role: "Role",
    department: "Department",
    manages: "Manages",
};

/** "Role: MEMBER → MANAGER", "Manages: none → Development". */
export function describeField(change: DirectoryFieldChange): string {
    const label = FIELD_LABELS[change.field] ?? change.field;
    return `${label}: ${change.from ?? "none"} → ${change.to ?? "none"}`;
}

/** How many people would actually change (not skipped or unchanged). */
export function pendingCount(counts: DirectorySyncCounts): number {
    return counts.created + counts.linked + counts.updated + counts.deactivated;
}

/** "2 new, 1 updated, 6 skipped": only the non-zero counts, or "No changes". */
export function summarize(counts: DirectorySyncCounts): string {
    const parts: [number, string][] = [
        [counts.created, "new"],
        [counts.linked, "linked"],
        [counts.updated, "updated"],
        [counts.deactivated, "deactivated"],
        [counts.skipped, "skipped"],
        [counts.unchanged, "unchanged"],
    ];
    const text = parts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`).join(", ");
    return text || "No changes";
}
