import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
    BarChart2, Bell, BookOpen, Chrome, CircleCheck, CircleMinus, CirclePause, Cloud, Copy, CreditCard,
    Github, KeyRound, Layers, Mail, MessageSquare, Phone, Plus, Trash2, X, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import { del, get, patch, post } from "../api/client";
import type { ApiKeyDto, ServiceConnection, Webhook } from "../api/types";
import { formatDateTime } from "../utils/format";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Dialog, { DialogBody, DialogFooter } from "../ui/Dialog";
import PageHeader from "../ui/PageHeader";
import Toggle from "../ui/Toggle";
import "../ui/field.css";
import "../ui/list.css";
import "../ui/surface.css";
import "./connections.css";

const SERVICE_META: Record<string, { name: string; icon: LucideIcon; category: string }> = {
    slack: { name: "Slack", icon: MessageSquare, category: "Messaging" },
    github: { name: "GitHub", icon: Github, category: "Development" },
    google: { name: "Google Workspace", icon: Chrome, category: "Productivity" },
    stripe: { name: "Stripe", icon: CreditCard, category: "Payments" },
    jira: { name: "Jira", icon: Layers, category: "Project Mgmt" },
    aws: { name: "AWS S3", icon: Cloud, category: "Storage" },
    zapier: { name: "Zapier", icon: Zap, category: "Automation" },
    sendgrid: { name: "SendGrid", icon: Mail, category: "Email" },
    datadog: { name: "Datadog", icon: BarChart2, category: "Monitoring" },
    pagerduty: { name: "PagerDuty", icon: Bell, category: "Alerting" },
    twilio: { name: "Twilio", icon: Phone, category: "Messaging" },
    notion: { name: "Notion", icon: BookOpen, category: "Productivity" },
};

const SERVICE_ORDER = Object.keys(SERVICE_META);

/** The scopes a key can be given (ApiKeyCreateRequest), with what each lets an integration do. */
const KEY_SCOPES: readonly { scope: string; label: string; hint: string }[] = [
    { scope: "ingest:checkins", label: "Push KPI check-ins", hint: "Lets an integration push KPI check-ins (POST /api/ingest/checkins)." },
];

const scopeLabel = (scope: string) => KEY_SCOPES.find((s) => s.scope === scope)?.label ?? scope;

const INGEST_EXAMPLE = [
    "curl -X POST https://<your-msframework-host>/api/ingest/checkins \\",
    "  -H \"Authorization: Bearer <API key>\" \\",
    "  -H \"Content-Type: application/json\" \\",
    "  -d '{\"checkins\": [{\"goalId\": 13, \"date\": \"2026-11-02\", \"value\": 48, \"note\": \"Sprint 22\"}]}'",
].join("\n");

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

function ConnectionPill({ connected, enabled }: { connected: boolean; enabled: boolean }) {
    if (!connected) {
        return <span className="ms-status ms-status--neutral"><CircleMinus aria-hidden="true" />Not connected</span>;
    }
    if (!enabled) {
        return <span className="ms-status ms-status--warn"><CirclePause aria-hidden="true" />Connected · paused</span>;
    }
    return <span className="ms-status ms-status--ok"><CircleCheck aria-hidden="true" />Connected</span>;
}

export default function Connections() {
    const { user } = useAuth();
    const canManage = hasPermission(user, "CONNECTIONS_UPDATE");
    const canReadKeys = hasPermission(user, "API_KEY_READ");
    const canCreateKeys = hasPermission(user, "API_KEY_CREATE");
    const canRevokeKeys = hasPermission(user, "API_KEY_DELETE");

    const [services, setServices] = useState<ServiceConnection[]>([]);
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [apiKeys, setApiKeys] = useState<ApiKeyDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState<string | null>(null);

    const [showWHForm, setShowWHForm] = useState(false);
    const [whUrl, setWhUrl] = useState("");
    const [whError, setWhError] = useState<string | null>(null);

    const [keyName, setKeyName] = useState("");
    const [keyScopes, setKeyScopes] = useState<string[]>([]);
    const [keyDialog, setKeyDialog] = useState(false);
    const [newSecret, setNewSecret] = useState<{ name: string; secret: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const [keyToRevoke, setKeyToRevoke] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [conns, whs, keys] = await Promise.all([
                get<ServiceConnection[]>("/api/connections"),
                get<Webhook[]>("/api/webhooks"),
                canReadKeys ? get<ApiKeyDto[]>("/api/keys") : Promise.resolve([]),
            ]);
            setServices(conns || []);
            setWebhooks(whs || []);
            setApiKeys(keys || []);
            setError(null);
        } catch (err) {
            setError(messageOf(err));
        } finally {
            setLoading(false);
        }
    }, [canReadKeys]);

    useEffect(() => { load(); }, [load]);

    async function run(key: string, action: () => Promise<void>) {
        setPending(key);
        setError(null);
        try {
            await action();
        } catch (err) {
            setError(messageOf(err));
        } finally {
            setPending(null);
        }
    }

    function replaceService(updated: ServiceConnection) {
        setServices((prev) => prev.map((s) => (s.serviceId === updated.serviceId ? updated : s)));
    }

    const sortedServices = SERVICE_ORDER.map((id) => {
        const svc = services.find((s) => s.serviceId === id);
        return { serviceId: id, connected: false, enabled: false, ...svc, ...(SERVICE_META[id] as (typeof SERVICE_META)[string]) };
    });
    type ServiceRow = (typeof sortedServices)[number];

    const toggleConnection = (svc: ServiceRow) => run(`svc:${svc.serviceId}`, async () => {
        const action = svc.connected ? "disconnect" : "connect";
        replaceService(await post<ServiceConnection>(`/api/connections/${svc.serviceId}/${action}`));
    });

    const toggleEnabled = (svc: ServiceRow) => run(`svc:${svc.serviceId}`, async () => {
        replaceService(await patch<ServiceConnection>(`/api/connections/${svc.serviceId}/toggle`));
    });

    async function addWebhook(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setWhError(null);
        const url = whUrl.trim();
        if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url)) {
            setWhError("Enter a full http(s) URL, e.g. https://example.com/hooks/endpoint");
            return;
        }
        setPending("wh:new");
        try {
            const saved = await post<Webhook>("/api/webhooks", { url, events: ["*"] });
            setWebhooks((prev) => [saved, ...prev]);
            setWhUrl("");
            setShowWHForm(false);
        } catch (err) {
            setWhError(messageOf(err));
        } finally {
            setPending(null);
        }
    }

    const toggleWebhook = (wh: Webhook) => run(`wh:${wh.id}`, async () => {
        const updated = await patch<Webhook>(`/api/webhooks/${wh.id}/toggle`);
        setWebhooks((prev) => prev.map((w) => (w.id === wh.id ? updated : w)));
    });

    const removeWebhook = (wh: Webhook) => run(`wh:${wh.id}`, async () => {
        await del(`/api/webhooks/${wh.id}`);
        setWebhooks((prev) => prev.filter((w) => w.id !== wh.id));
    });

    const generateKey = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        return run("key:new", async () => {
            const saved = await post<ApiKeyDto>("/api/keys", { name: keyName.trim() || "API key", scopes: keyScopes });
            const { secret, ...rest } = saved;
            setApiKeys((prev) => [rest, ...prev]);
            setNewSecret({ name: saved.name, secret: secret ?? "" });
            setCopied(false);
            setKeyName("");
            setKeyScopes([]);
            setKeyDialog(false);
        });
    };

    const revokeKey = (key: ApiKeyDto) => run(`key:${key.id}`, async () => {
        await del(`/api/keys/${key.id}`);
        setApiKeys((prev) => prev.filter((k) => k.id !== key.id));
        setKeyToRevoke(null);
    });

    async function copySecret() {
        if (!newSecret) return;
        try {
            await navigator.clipboard.writeText(newSecret.secret);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    }

    return (
        <section className="ms-connections">
            <PageHeader
                eyebrow="Operations"
                title="Connections"
                description={canManage
                    ? "Manage external service integrations, webhooks, and API keys."
                    : "View external service integrations and webhooks. Ask an administrator to change them."}
            />

            {error && (
                <Alert tone="danger" role="alert" className="ms-notice">
                    <span>{error}</span>
                    <Button size="sm" onClick={load}>Reload</Button>
                </Alert>
            )}

            <section className="ms-connections__section" aria-labelledby="conn-integrations">
                <div className="ms-connections__head">
                    <h2 className="ms-connections__title" id="conn-integrations">Integrations</h2>
                </div>
                <p className="ms-connections__note">
                    Connection state is stored for each service; live API calls to these services are not implemented yet.
                </p>
                <ul className="ms-connections__grid">
                    {sortedServices.map((svc) => {
                        const Icon = svc.icon;
                        const busy = pending === `svc:${svc.serviceId}`;
                        return (
                            <li key={svc.serviceId} className="ms-cut ms-connections__card">
                                <div className="ms-connections__service">
                                    <span className="ms-connections__icon" aria-hidden="true"><Icon /></span>
                                    <div className="ms-connections__service-text">
                                        <h3 className="ms-connections__name">{svc.name}</h3>
                                        <p className="ms-connections__cat">{svc.category}</p>
                                    </div>
                                </div>
                                <div className="ms-connections__state">
                                    <ConnectionPill connected={svc.connected} enabled={svc.enabled} />
                                    {svc.connected && (
                                        <Toggle
                                            on={svc.enabled}
                                            disabled={!canManage || busy}
                                            onToggle={() => toggleEnabled(svc)}
                                            label={`${svc.enabled ? "Pause" : "Resume"} ${svc.name}`}
                                        />
                                    )}
                                </div>
                                {canManage && (
                                    <div className="ms-connections__foot">
                                        <Button size="sm" onClick={() => toggleConnection(svc)} disabled={busy || loading}>
                                            {busy ? "…" : svc.connected ? "Disconnect" : "Connect"}
                                        </Button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section className="ms-panel ms-connections__section" aria-labelledby="conn-webhooks">
                <div className="ms-panel__head">
                    <h2 className="ms-panel__title" id="conn-webhooks">Webhooks</h2>
                    {canManage && (
                        <Button
                            size="sm"
                            icon={showWHForm ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
                            onClick={() => { setShowWHForm((v) => !v); setWhError(null); }}
                        >
                            {showWHForm ? "Cancel" : "Add Webhook"}
                        </Button>
                    )}
                </div>

                {showWHForm && (
                    <form onSubmit={addWebhook} className="ms-connections__form">
                        <div className="ms-field">
                            <label className="ms-field__label" htmlFor="wh-url">Endpoint URL</label>
                            <div className="ms-connections__inline">
                                <input
                                    id="wh-url"
                                    className="ms-input"
                                    placeholder="https://your-server.com/hooks/endpoint"
                                    value={whUrl}
                                    onChange={(e) => setWhUrl(e.target.value)}
                                    maxLength={255}
                                    aria-invalid={whError ? true : undefined}
                                />
                                <Button type="submit" variant="primary" disabled={pending === "wh:new"}>
                                    {pending === "wh:new" ? "Adding…" : "Add"}
                                </Button>
                            </div>
                        </div>
                        {whError && <Alert tone="danger" role="alert">{whError}</Alert>}
                    </form>
                )}

                <ul className="ms-connections__list">
                    {webhooks.length === 0 && <li className="ms-connections__empty">No webhooks configured.</li>}
                    {webhooks.map((wh) => {
                        const busy = pending === `wh:${wh.id}`;
                        return (
                            <li key={wh.id} className="ms-connections__row">
                                <div className="ms-connections__row-main">
                                    <p className="ms-connections__url">{wh.url}</p>
                                    <div className="ms-connections__events">
                                        {(wh.events || "*").split(",").map((ev) => (
                                            <span key={ev} className="ms-tag">{ev === "*" ? "all events" : ev}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="ms-connections__row-side">
                                    <span className="ms-connections__meta">Last sent: {wh.lastTriggered || "never"}</span>
                                    <Toggle
                                        on={wh.active}
                                        disabled={!canManage || busy}
                                        onToggle={() => toggleWebhook(wh)}
                                        label={`${wh.active ? "Disable" : "Enable"} webhook ${wh.url}`}
                                    />
                                    {canManage && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="ms-connections__remove"
                                            onClick={() => removeWebhook(wh)}
                                            disabled={busy}
                                            aria-label={`Remove webhook ${wh.url}`}
                                            title="Remove webhook"
                                            icon={<Trash2 aria-hidden="true" />}
                                        />
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </section>

            {canReadKeys && (
                <section className="ms-panel ms-connections__section" aria-labelledby="conn-keys">
                    <div className="ms-panel__head ms-connections__keys-head">
                        <h2 className="ms-panel__title" id="conn-keys">API Keys</h2>
                        {canCreateKeys && (
                            <Button size="sm" icon={<Plus aria-hidden="true" />} onClick={() => { setError(null); setKeyDialog(true); }}>
                                Generate New Key
                            </Button>
                        )}
                    </div>

                    {newSecret && (
                        <div className="ms-connections__secret" role="status">
                            <p className="ms-connections__secret-title">
                                Copy “{newSecret.name}” now. You won&apos;t be able to see it again.
                            </p>
                            <code className="ms-connections__code">{newSecret.secret}</code>
                            <div className="ms-connections__secret-actions">
                                <Button size="sm" variant="primary" icon={<Copy aria-hidden="true" />} onClick={copySecret}>
                                    {copied ? "Copied" : "Copy"}
                                </Button>
                                <Button size="sm" onClick={() => setNewSecret(null)}>Done</Button>
                            </div>
                        </div>
                    )}

                    <ul className="ms-connections__list">
                        {apiKeys.length === 0 && <li className="ms-connections__empty">No API keys yet.</li>}
                        {apiKeys.map((key) => (
                            <li key={key.id} className="ms-connections__row">
                                <div className="ms-connections__row-main">
                                    <p className="ms-connections__key-name">{key.name}</p>
                                    <p className="ms-connections__masked">{key.maskedDisplay}</p>
                                    <div className="ms-connections__events">
                                        {(key.scopes ?? []).length === 0
                                            ? <span className="ms-tag">No scopes</span>
                                            : (key.scopes ?? []).map((sc) => <span key={sc} className="ms-tag" title={sc}>{scopeLabel(sc)}</span>)}
                                    </div>
                                </div>
                                <div className="ms-connections__key-meta">
                                    <p>Created {formatDateTime(key.createdAt)}{key.createdBy ? ` by ${key.createdBy}` : ""}</p>
                                    <p>Last used {key.lastUsed || "never"}</p>
                                </div>
                                {canRevokeKeys && (
                                    keyToRevoke === key.id ? (
                                        <div className="ms-connections__row-side">
                                            <Button size="sm" variant="danger" onClick={() => revokeKey(key)} disabled={pending === `key:${key.id}`}>
                                                Confirm revoke
                                            </Button>
                                            <Button size="sm" onClick={() => setKeyToRevoke(null)}>Cancel</Button>
                                        </div>
                                    ) : (
                                        <Button size="sm" variant="ghost" className="ms-connections__remove" onClick={() => setKeyToRevoke(key.id)}>
                                            Revoke
                                        </Button>
                                    )
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="ms-panel ms-connections__section" aria-labelledby="conn-ingest">
                <div className="ms-panel__head">
                    <h2 className="ms-panel__title" id="conn-ingest">Push KPI values from your tools</h2>
                </div>
                <div className="ms-connections__help">
                    <p>
                        A build server, a support desk or a spreadsheet script can record goal check-ins for you. Generate an API key
                        with the <strong>Push KPI check-ins</strong> scope, then send the values with the goal&apos;s id. Up to 500
                        check-ins per request; invalid ones are skipped and reported by their position.
                    </p>
                    <pre className="ms-connections__code ms-connections__curl">{INGEST_EXAMPLE}</pre>
                </div>
            </section>

            {keyDialog && (
                <Dialog eyebrow="API keys" title="Generate an API key" description="The key is shown once, right after it is created."
                    onClose={() => setKeyDialog(false)} busy={pending === "key:new"}>
                    <form onSubmit={generateKey}>
                        <DialogBody>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="key-name">Name</label>
                                <input id="key-name" data-autofocus className="ms-input" placeholder="e.g. CI metrics" value={keyName}
                                    onChange={(e) => setKeyName(e.target.value)} maxLength={60} />
                            </div>
                            <fieldset className="ms-connections__scopes">
                                <legend className="ms-field__label">What may it do?</legend>
                                {KEY_SCOPES.map((sc) => (
                                    <label key={sc.scope} className="ms-connections__scope" htmlFor={`scope-${sc.scope}`}>
                                        <input id={`scope-${sc.scope}`} type="checkbox" checked={keyScopes.includes(sc.scope)}
                                            onChange={(e) => setKeyScopes((list) => (e.target.checked ? [...list, sc.scope] : list.filter((x) => x !== sc.scope)))} />
                                        <span className="ms-connections__scope-text">
                                            {sc.label} <code>{sc.scope}</code>
                                            <span className="ms-connections__scope-hint">{sc.hint}</span>
                                        </span>
                                    </label>
                                ))}
                                <p className="ms-field__hint">Without a scope the key cannot call any ingest endpoint.</p>
                            </fieldset>
                            {error && <Alert tone="danger" role="alert">{error}</Alert>}
                        </DialogBody>
                        <DialogFooter>
                            <Button onClick={() => setKeyDialog(false)} disabled={pending === "key:new"}>Cancel</Button>
                            <Button type="submit" variant="primary" icon={<KeyRound aria-hidden="true" />} disabled={pending === "key:new"}>
                                {pending === "key:new" ? "Generating…" : "Generate key"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Dialog>
            )}
        </section>
    );
}
