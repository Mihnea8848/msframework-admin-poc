import { useCallback, useEffect, useState } from "react";
import {
    MessageSquare, Github, Chrome, CreditCard, Layers, Cloud,
    Zap, Mail, BarChart2, Bell, Phone, BookOpen, Trash2, Plus, X, Copy,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import { del, get, patch, post } from "../api/client";
import { formatDateTime } from "../utils/format";
import PageHeader from "../ui/PageHeader.jsx";
import Toggle from "../ui/Toggle.jsx";

const SERVICE_META = {
    slack:     { name: "Slack",           icon: MessageSquare, color: "#4A154B", category: "Messaging"    },
    github:    { name: "GitHub",          icon: Github,        color: "#24292e", category: "Development"  },
    google:    { name: "Google Workspace",icon: Chrome,        color: "#4285F4", category: "Productivity" },
    stripe:    { name: "Stripe",          icon: CreditCard,    color: "#635BFF", category: "Payments"     },
    jira:      { name: "Jira",            icon: Layers,        color: "#0052CC", category: "Project Mgmt" },
    aws:       { name: "AWS S3",          icon: Cloud,         color: "#FF9900", category: "Storage"      },
    zapier:    { name: "Zapier",          icon: Zap,           color: "#FF4A00", category: "Automation"   },
    sendgrid:  { name: "SendGrid",        icon: Mail,          color: "#1A82E2", category: "Email"        },
    datadog:   { name: "Datadog",         icon: BarChart2,     color: "#632CA6", category: "Monitoring"   },
    pagerduty: { name: "PagerDuty",       icon: Bell,          color: "#06AC38", category: "Alerting"     },
    twilio:    { name: "Twilio",          icon: Phone,         color: "#F22F46", category: "Messaging"    },
    notion:    { name: "Notion",          icon: BookOpen,      color: "#6b7568", category: "Productivity" },
};

const SERVICE_ORDER = Object.keys(SERVICE_META);

function StatusPill({ on, onLabel, offLabel }) {
    return (
        <span style={{
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
            background: on ? "rgba(45,216,129,0.12)" : "var(--panel-muted)",
            color: on ? "var(--success)" : "var(--muted)",
        }}>
            {on ? onLabel : offLabel}
        </span>
    );
}

export default function Connections() {
    const { user } = useAuth();
    const canManage = hasPermission(user, "CONNECTIONS_UPDATE");
    const canReadKeys = hasPermission(user, "API_KEY_READ");
    const canCreateKeys = hasPermission(user, "API_KEY_CREATE");
    const canRevokeKeys = hasPermission(user, "API_KEY_DELETE");

    const [services, setServices] = useState([]);
    const [webhooks, setWebhooks] = useState([]);
    const [apiKeys, setApiKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pending, setPending] = useState(null);

    const [showWHForm, setShowWHForm] = useState(false);
    const [whUrl, setWhUrl] = useState("");
    const [whError, setWhError] = useState(null);

    const [keyName, setKeyName] = useState("");
    const [newSecret, setNewSecret] = useState(null);
    const [copied, setCopied] = useState(false);
    const [keyToRevoke, setKeyToRevoke] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [conns, whs, keys] = await Promise.all([
                get("/api/connections"),
                get("/api/webhooks"),
                canReadKeys ? get("/api/keys") : Promise.resolve([]),
            ]);
            setServices(conns || []);
            setWebhooks(whs || []);
            setApiKeys(keys || []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [canReadKeys]);

    useEffect(() => { load(); }, [load]);

    async function run(key, action) {
        setPending(key);
        setError(null);
        try {
            await action();
        } catch (err) {
            setError(err.message);
        } finally {
            setPending(null);
        }
    }

    function replaceService(updated) {
        setServices((prev) => prev.map((s) => (s.serviceId === updated.serviceId ? updated : s)));
    }

    const sortedServices = SERVICE_ORDER.map((id) => {
        const svc = services.find((s) => s.serviceId === id);
        return { serviceId: id, connected: false, enabled: false, ...svc, ...SERVICE_META[id] };
    });

    const toggleConnection = (svc) => run(`svc:${svc.serviceId}`, async () => {
        const action = svc.connected ? "disconnect" : "connect";
        replaceService(await post(`/api/connections/${svc.serviceId}/${action}`));
    });

    const toggleEnabled = (svc) => run(`svc:${svc.serviceId}`, async () => {
        replaceService(await patch(`/api/connections/${svc.serviceId}/toggle`));
    });

    async function addWebhook(e) {
        e.preventDefault();
        setWhError(null);
        const url = whUrl.trim();
        if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url)) {
            setWhError("Enter a full http(s) URL, e.g. https://example.com/hooks/endpoint");
            return;
        }
        setPending("wh:new");
        try {
            const saved = await post("/api/webhooks", { url, events: ["*"] });
            setWebhooks((prev) => [saved, ...prev]);
            setWhUrl("");
            setShowWHForm(false);
        } catch (err) {
            setWhError(err.message);
        } finally {
            setPending(null);
        }
    }

    const toggleWebhook = (wh) => run(`wh:${wh.id}`, async () => {
        const updated = await patch(`/api/webhooks/${wh.id}/toggle`);
        setWebhooks((prev) => prev.map((w) => (w.id === wh.id ? updated : w)));
    });

    const removeWebhook = (wh) => run(`wh:${wh.id}`, async () => {
        await del(`/api/webhooks/${wh.id}`);
        setWebhooks((prev) => prev.filter((w) => w.id !== wh.id));
    });

    const generateKey = (e) => {
        e.preventDefault();
        return run("key:new", async () => {
            const saved = await post("/api/keys", { name: keyName.trim() || "API key" });
            const { secret, ...rest } = saved;
            setApiKeys((prev) => [rest, ...prev]);
            setNewSecret({ name: saved.name, secret });
            setCopied(false);
            setKeyName("");
        });
    };

    const revokeKey = (key) => run(`key:${key.id}`, async () => {
        await del(`/api/keys/${key.id}`);
        setApiKeys((prev) => prev.filter((k) => k.id !== key.id));
        setKeyToRevoke(null);
    });

    async function copySecret() {
        try {
            await navigator.clipboard.writeText(newSecret.secret);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    }

    return (
        <section className="workspace">
            <PageHeader
                breadcrumb="General / Connections"
                title="Connections"
                subtitle={canManage
                    ? "Manage external service integrations, webhooks, and API keys."
                    : "View external service integrations and webhooks. Ask an administrator to change them."}
            />

            {error && (
                <div className="inline-error page-banner" role="alert">
                    {error}{" "}
                    <button type="button" className="btn-secondary btn-small" onClick={load}>Reload</button>
                </div>
            )}

            <div className="workspace-section-title" style={{ marginBottom: 12 }}>Integrations</div>
            <div className="muted-note" style={{ marginBottom: 12 }}>
                Connection state is stored for each service; live API calls to these services are not implemented yet.
            </div>
            <div className="connections-grid">
                {sortedServices.map((svc) => {
                    const Icon = svc.icon;
                    const busy = pending === `svc:${svc.serviceId}`;
                    return (
                        <div key={svc.serviceId} className="integration-card">
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div className="integration-icon" style={{ background: svc.color + "22", color: svc.color }}>
                                    <Icon size={16} />
                                </div>
                                <div>
                                    <div className="integration-name">{svc.name}</div>
                                    <div className="integration-cat">{svc.category}</div>
                                </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <StatusPill
                                    on={svc.connected}
                                    onLabel={svc.enabled ? "Connected" : "Connected · paused"}
                                    offLabel="Not connected"
                                />
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
                                <div className="integration-footer">
                                    <button
                                        type="button"
                                        className="btn-secondary btn-small"
                                        onClick={() => toggleConnection(svc)}
                                        disabled={busy || loading}
                                    >
                                        {busy ? "…" : svc.connected ? "Disconnect" : "Connect"}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Webhooks */}
            <div style={{ marginTop: 32 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div className="workspace-section-title">Webhooks</div>
                    {canManage && (
                        <button
                            type="button"
                            className="btn-secondary btn-small"
                            onClick={() => { setShowWHForm((v) => !v); setWhError(null); }}
                        >
                            {showWHForm ? <X size={13} /> : <Plus size={13} />}
                            {showWHForm ? "Cancel" : "Add Webhook"}
                        </button>
                    )}
                </div>

                {showWHForm && (
                    <form onSubmit={addWebhook} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", gap: 10 }}>
                            <input
                                className="form-input"
                                style={{ flex: 1 }}
                                placeholder="https://your-server.com/hooks/endpoint"
                                value={whUrl}
                                onChange={(e) => setWhUrl(e.target.value)}
                                autoFocus
                                maxLength={255}
                            />
                            <button type="submit" className="btn-primary" disabled={pending === "wh:new"}>
                                {pending === "wh:new" ? "Adding…" : "Add"}
                            </button>
                        </div>
                        {whError && <div className="inline-error" style={{ marginTop: 8 }}>{whError}</div>}
                    </form>
                )}

                <div className="audit-list">
                    {webhooks.length === 0 && (
                        <div className="audit-row" style={{ color: "var(--muted)", fontSize: 13 }}>No webhooks configured.</div>
                    )}
                    {webhooks.map((wh) => {
                        const busy = pending === `wh:${wh.id}`;
                        return (
                            <div key={wh.id} className="audit-row" style={{ alignItems: "center" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted-strong)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {wh.url}
                                    </div>
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                        {(wh.events || "*").split(",").map((ev) => (
                                            <span key={ev} className="event-pill changed" style={{ fontSize: 10 }}>{ev === "*" ? "all events" : ev}</span>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                    <span style={{ fontSize: 11, color: "var(--muted)" }}>Last sent: {wh.lastTriggered || "never"}</span>
                                    <Toggle
                                        on={wh.active}
                                        disabled={!canManage || busy}
                                        onToggle={() => toggleWebhook(wh)}
                                        label={`${wh.active ? "Disable" : "Enable"} webhook ${wh.url}`}
                                    />
                                    {canManage && (
                                        <button
                                            type="button"
                                            onClick={() => removeWebhook(wh)}
                                            disabled={busy}
                                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex" }}
                                            aria-label={`Remove webhook ${wh.url}`}
                                            title="Remove webhook"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* API Keys */}
            {canReadKeys && (
                <div style={{ marginTop: 32 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
                        <div className="workspace-section-title">API Keys</div>
                        {canCreateKeys && (
                            <form onSubmit={generateKey} style={{ display: "flex", gap: 8 }}>
                                <input
                                    className="form-input"
                                    style={{ width: 200 }}
                                    placeholder="Key name (e.g. CI deploy)"
                                    value={keyName}
                                    onChange={(e) => setKeyName(e.target.value)}
                                    maxLength={60}
                                    aria-label="New API key name"
                                />
                                <button type="submit" className="btn-secondary btn-small" disabled={pending === "key:new"}>
                                    <Plus size={13} />
                                    {pending === "key:new" ? "Generating…" : "Generate New Key"}
                                </button>
                            </form>
                        )}
                    </div>

                    {newSecret && (
                        <div className="secret-box" role="status">
                            <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
                                Copy “{newSecret.name}” now. You won&apos;t be able to see it again.
                            </div>
                            <code>{newSecret.secret}</code>
                            <button type="button" className="btn-primary btn-small" onClick={copySecret}>
                                <Copy size={13} /> {copied ? "Copied" : "Copy"}
                            </button>
                            <button type="button" className="btn-secondary btn-small" onClick={() => setNewSecret(null)}>
                                Done
                            </button>
                        </div>
                    )}

                    <div className="audit-list">
                        {apiKeys.length === 0 && (
                            <div className="audit-row" style={{ color: "var(--muted)", fontSize: 13 }}>No API keys yet.</div>
                        )}
                        {apiKeys.map((key) => (
                            <div key={key.id} className="audit-row" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{key.name}</div>
                                    <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--accent)", letterSpacing: "0.04em" }}>
                                        {key.maskedDisplay}
                                    </div>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", flexShrink: 0 }}>
                                    <div>Created {formatDateTime(key.createdAt)}{key.createdBy ? ` by ${key.createdBy}` : ""}</div>
                                    <div>Last used {key.lastUsed || "never"}</div>
                                </div>
                                {canRevokeKeys && (
                                    keyToRevoke === key.id ? (
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <button type="button" className="btn-danger btn-small" onClick={() => revokeKey(key)} disabled={pending === `key:${key.id}`}>
                                                Confirm revoke
                                            </button>
                                            <button type="button" className="btn-secondary btn-small" onClick={() => setKeyToRevoke(null)}>
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button type="button" className="btn-danger btn-small" onClick={() => setKeyToRevoke(key.id)}>
                                            Revoke
                                        </button>
                                    )
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
