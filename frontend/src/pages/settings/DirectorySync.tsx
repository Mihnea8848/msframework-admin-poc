import { useEffect, useId, useState } from "react";
import { CircleCheck, CircleMinus, CirclePlus, Link2, PencilLine, RefreshCw, UserX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { hasPermission } from "../../auth/permissions";
import {
    getDirectoryMapping, getDirectoryStatus, previewDirectorySync, resetDirectoryMapping, runDirectorySync,
    saveDirectoryMapping,
} from "../../api/directory";
import type {
    DirectoryAction, DirectoryChange, DirectoryMapping, DirectoryMappingState, DirectoryStatus, DirectorySyncResult,
} from "../../api/directory";
import { formatDateTime } from "../../utils/format";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import { describeField, groupChanges, pendingCount, skipReasons, summarize } from "./directorySync";
import type { ChangeGroup } from "./directorySync";
import "../../ui/field.css";
import "../../ui/list.css";
import "../../ui/surface.css";
import "./directory-sync.css";

const ICONS: Record<DirectoryAction, LucideIcon> = {
    create: CirclePlus,
    link: Link2,
    update: PencilLine,
    deactivate: UserX,
    skip: CircleMinus,
    unchanged: CircleCheck,
};

function message(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/**
 * Settings > Organisation: "Sync from Authentik". Shows whether the directory is configured,
 * previews the changes a sync would make (grouped by kind), applies them, and shows the group
 * mapping. Rendered only for DIRECTORY_SYNC (admins); the backend enforces it as well.
 */
export default function DirectorySync() {
    const { user } = useAuth();
    if (!hasPermission(user, "DIRECTORY_SYNC")) return null;
    return <DirectorySyncPanel />;
}

type Busy = "preview" | "apply" | null;

function DirectorySyncPanel() {
    const titleId = useId();
    const [status, setStatus] = useState<DirectoryStatus | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [result, setResult] = useState<DirectorySyncResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<Busy>(null);

    useEffect(() => {
        let alive = true;
        getDirectoryStatus()
            .then((s) => alive && setStatus(s))
            .catch((err: unknown) => alive && setStatusError(message(err)));
        return () => {
            alive = false;
        };
    }, []);

    async function run(kind: "preview" | "apply") {
        setBusy(kind);
        setError(null);
        try {
            const next = kind === "preview" ? await previewDirectorySync() : await runDirectorySync();
            setResult(next);
            if (kind === "apply") setStatus(await getDirectoryStatus());
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(null);
        }
    }

    const canApply = result?.dryRun === true && pendingCount(result.counts) > 0;

    return (
        <section className="ms-panel ms-dirsync" aria-labelledby={titleId}>
            <div className="ms-panel__head">
                <h2 className="ms-panel__title ms-dirsync__title" id={titleId}>
                    Directory sync <span className="ms-tag">Authentik</span>
                </h2>
            </div>
            <div className="ms-dirsync__body">
                {statusError && <Alert tone="danger" role="alert">Could not load the directory status: {statusError}</Alert>}
                {!status && !statusError && <p className="ms-dirsync__sub" role="status">Loading…</p>}
                {status && <StatusFacts status={status} />}

                {status?.configured && (
                    <>
                        <p className="ms-dirsync__sub">
                            Staff in the mapped Authentik groups are created or updated here; people who leave those
                            groups are deactivated and signed out. Accounts created in MSFramework are never changed.
                            New users have no password until they use “Forgot password” or an admin sends a reset link.
                        </p>
                        <div className="ms-dirsync__actions">
                            <Button
                                icon={<RefreshCw aria-hidden="true" />}
                                onClick={() => void run("preview")}
                                disabled={busy !== null}
                            >
                                {busy === "preview" ? "Reading Authentik…" : "Preview changes"}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => void run("apply")}
                                disabled={busy !== null || !canApply}
                            >
                                {busy === "apply" ? "Syncing…" : "Apply"}
                            </Button>
                        </div>
                    </>
                )}

                {error && <Alert tone="danger" role="alert">{error}</Alert>}
                {result && <SyncResult result={result} />}

                {status && <MappingView />}
            </div>
        </section>
    );
}

function StatusFacts({ status }: { status: DirectoryStatus }) {
    if (!status.configured) {
        return (
            <Alert tone="info">
                Directory sync is off. To turn it on, set <code>AUTHENTIK_URL</code> (for example
                {" "}<code>https://auth.mehstudios.net</code>) and either <code>AUTHENTIK_TOKEN</code> or
                {" "}<code>AUTHENTIK_TOKEN_FILE</code> (a file holding a token that can read users and groups) on the
                backend, then restart it. <code>scripts/dev-run.sh</code> does this when
                {" "}<code>~/.config/mehstudios/authentik-token</code> exists.
            </Alert>
        );
    }
    const last = status.lastSyncCounts;
    return (
        <dl className="ms-dirsync__facts">
            <dt>Server</dt>
            <dd>{status.host ?? "Invalid AUTHENTIK_URL"}</dd>
            <dt>Token</dt>
            <dd>
                {status.tokenSource === "file" ? "From AUTHENTIK_TOKEN_FILE"
                    : status.tokenSource === "env" ? "From AUTHENTIK_TOKEN" : "Not set"}
            </dd>
            <dt>Linked users</dt>
            <dd>{status.linkedUsers}</dd>
            <dt>Last sync</dt>
            <dd>
                {status.lastSyncAt
                    ? `${formatDateTime(status.lastSyncAt)}${status.lastSyncBy ? ` by ${status.lastSyncBy}` : ""}`
                    : "Never"}
                {last && <span className="ms-dirsync__sub"> · {summarize(last)}</span>}
            </dd>
        </dl>
    );
}

function SyncResult({ result }: { result: DirectorySyncResult }) {
    const groups = groupChanges(result.changes);
    const reasons = skipReasons(result.changes);
    const pending = pendingCount(result.counts);
    return (
        <div className="ms-dirsync__result">
            <Alert tone={result.dryRun ? "info" : "ok"} role="status">
                <strong>{result.dryRun ? "Preview" : "Sync applied"}</strong>
                {" "}({result.directoryUsers} people in Authentik): {summarize(result.counts)}.
                {result.dryRun && (pending > 0 ? " Nothing has changed yet: review the list, then Apply." : " Everything is up to date.")}
                {!result.dryRun && result.sessionsRevoked > 0 && ` ${result.sessionsRevoked} session(s) ended.`}
            </Alert>
            {reasons.length > 0 && (
                <ul className="ms-dirsync__reasons" aria-label="Why people were skipped">
                    {reasons.map((r) => (
                        <li key={r.reason} className="ms-status ms-status--neutral">{r.reason}: {r.count}</li>
                    ))}
                </ul>
            )}
            {groups.map((group) => <Group key={group.action} group={group} />)}
        </div>
    );
}

function Group({ group }: { group: ChangeGroup }) {
    const Icon = ICONS[group.action];
    const detailed = group.action !== "skip" && group.action !== "unchanged";
    return (
        <details className="ms-dirsync__group" open={group.open}>
            <summary className="ms-dirsync__summary">
                <span className={`ms-status ms-status--${group.tone}`}>
                    <Icon aria-hidden="true" />
                    {group.title}
                </span>
                <span className="ms-dirsync__count">{group.items.length}</span>
            </summary>
            <div className="ms-table-wrap">
                <table className="ms-table ms-dirsync__table">
                    <thead>
                        <tr>
                            <th scope="col">Person</th>
                            {detailed && <th scope="col">Role</th>}
                            {detailed && <th scope="col">Department</th>}
                            <th scope="col">{detailed ? "Changes" : "Reason"}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {group.items.map((c) => <Row key={`${c.externalId ?? ""}-${c.userId ?? ""}`} change={c} detailed={detailed} />)}
                    </tbody>
                </table>
            </div>
        </details>
    );
}

function Row({ change, detailed }: { change: DirectoryChange; detailed: boolean }) {
    return (
        <tr>
            <td>
                <div className="ms-dirsync__person">{change.name ?? change.username ?? "Unnamed"}</div>
                <div className="ms-table__muted ms-dirsync__email">{change.email || change.username || "No email"}</div>
            </td>
            {detailed && <td>{change.role ? <span className="ms-role">{change.role}</span> : "—"}</td>}
            {detailed && <td>{change.department ?? <span className="ms-table__muted">None</span>}</td>}
            <td>
                {change.reason && <div>{change.reason}</div>}
                {detailed && change.fields.length > 0 && (
                    <ul className="ms-dirsync__fields">
                        {change.fields.map((f) => <li key={f.field + (f.from ?? "") + (f.to ?? "")}>{describeField(f)}</li>)}
                    </ul>
                )}
                {change.notes.map((n) => <div key={n} className="ms-dirsync__note">{n}</div>)}
                {change.applied === false && <div className="ms-dirsync__note">Not applied</div>}
            </td>
        </tr>
    );
}

/** The group mapping as JSON: read it, or edit and save it (validated by the backend). */
function MappingView() {
    const fieldId = useId();
    const [state, setState] = useState<DirectoryMappingState | null>(null);
    const [draft, setDraft] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    function load() {
        if (state) return;
        getDirectoryMapping().then(setState).catch((err: unknown) => setError(message(err)));
    }

    async function save(action: "save" | "reset") {
        setSaving(true);
        setError(null);
        try {
            let next: DirectoryMappingState;
            if (action === "reset") {
                next = await resetDirectoryMapping();
            } else {
                let parsed: DirectoryMapping;
                try {
                    parsed = JSON.parse(draft ?? "") as DirectoryMapping;
                } catch {
                    setError("The mapping is not valid JSON.");
                    return;
                }
                next = await saveDirectoryMapping(parsed);
            }
            setState(next);
            setDraft(null);
        } catch (err) {
            setError(message(err));
        } finally {
            setSaving(false);
        }
    }

    const json = state ? JSON.stringify(state.mapping, null, 2) : "";
    return (
        <details className="ms-dirsync__group" onToggle={(e) => e.currentTarget.open && load()}>
            <summary className="ms-dirsync__summary">
                <span className="ms-dirsync__mapping-title">Group mapping</span>
                {state && <span className="ms-tag">{state.custom ? "Custom" : "Defaults"}</span>}
            </summary>
            <div className="ms-dirsync__mapping">
                <p className="ms-dirsync__sub">
                    Only members of <code>staffGroups</code> are imported. The highest role wins (admin, then manager,
                    then member). <code>departments</code> maps a group to a department name; the first match wins, and
                    an empty name gives no department. A name ending in <code>*</code> matches every group that starts
                    with the rest. Changes apply from the next preview.
                </p>
                {error && <Alert tone="danger" role="alert">{error}</Alert>}
                {!state && !error && <p className="ms-dirsync__sub" role="status">Loading…</p>}
                {state && draft === null && <pre className="ms-dirsync__json">{json}</pre>}
                {state && draft !== null && (
                    <div className="ms-field">
                        <label className="ms-field__label" htmlFor={fieldId}>Mapping (JSON)</label>
                        <textarea
                            id={fieldId}
                            className="ms-input ms-dirsync__editor"
                            value={draft}
                            spellCheck={false}
                            onChange={(e) => setDraft(e.target.value)}
                        />
                    </div>
                )}
                {state && (
                    <div className="ms-dirsync__actions">
                        {draft === null ? (
                            <>
                                <Button size="sm" onClick={() => setDraft(json)}>Edit</Button>
                                {state.custom && (
                                    <Button size="sm" variant="ghost" disabled={saving} onClick={() => void save("reset")}>
                                        Restore defaults
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                <Button size="sm" variant="ghost" disabled={saving} onClick={() => setDraft(null)}>Cancel</Button>
                                <Button size="sm" variant="primary" disabled={saving} onClick={() => void save("save")}>
                                    {saving ? "Saving…" : "Save mapping"}
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </details>
    );
}
