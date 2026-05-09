import { useEffect, useState } from "react";
import {
    MessageSquare, Github, Chrome, CreditCard, Layers, Cloud,
    Zap, Mail, BarChart2, Bell, Phone, BookOpen, Trash2, Plus, X,
} from "lucide-react";

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

function Toggle({ on, onToggle, disabled }) {
    return (
        <div
            className={`toggle-switch${on ? " on" : ""}${disabled ? " disabled" : ""}`}
            onClick={disabled ? undefined : onToggle}
            role="switch"
            aria-checked={on}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => !disabled && e.key === "Enter" && onToggle()}
        >
            <div className="toggle-knob" />
        </div>
    );
}

async function apiFetch(path, options = {}) {
    const res = await fetch(path, { credentials: "include", ...options });
    if (!res.ok) throw new Error(`${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

export default function Connections() {
    const [services, setServices]     = useState([]);
    const [webhooks, setWebhooks]     = useState([]);
    const [apiKeys, setApiKeys]       = useState([]);
    const [showWHForm, setShowWHForm] = useState(false);
    const [whUrl, setWhUrl]           = useState("");
    const [generated, setGenerated]   = useState(false);

    useEffect(() => {
        Promise.all([
            apiFetch("/api/connections"),
            apiFetch("/api/webhooks"),
            apiFetch("/api/keys"),
        ]).then(([conns, whs, keys]) => {
            setServices(conns || []);
            setWebhooks(whs || []);
            setApiKeys(keys || []);
        }).catch(() => {});
    }, []);

    function sortedServices() {
        return SERVICE_ORDER.map((id) => {
            const svc = services.find((s) => s.serviceId === id);
            return svc ? { ...svc, ...SERVICE_META[id] } : { serviceId: id, connected: false, enabled: false, ...SERVICE_META[id] };
        });
    }

    async function toggleService(svc) {
        const action = svc.connected ? "disconnect" : "connect";
        try {
            const updated = await apiFetch(`/api/connections/${svc.serviceId}/${action}`, { method: "POST" });
            setServices((prev) => {
                const idx = prev.findIndex((s) => s.serviceId === svc.serviceId);
                if (idx === -1) return [...prev, updated];
                const next = [...prev];
                next[idx] = updated;
                return next;
            });
        } catch { /* optimistic: leave state unchanged on error */ }
    }

    async function removeWebhook(id) {
        await apiFetch(`/api/webhooks/${id}`, { method: "DELETE" }).catch(() => {});
        setWebhooks((prev) => prev.filter((w) => w.id !== id));
    }

    async function addWebhook(e) {
        e.preventDefault();
        if (!whUrl) return;
        try {
            const saved = await apiFetch("/api/webhooks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: whUrl, events: ["*"] }),
            });
            setWebhooks((prev) => [saved, ...prev]);
            setWhUrl("");
            setShowWHForm(false);
        } catch { /* ignore */ }
    }

    async function generateKey() {
        try {
            const saved = await apiFetch("/api/keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "New API Key" }),
            });
            setApiKeys((prev) => [saved, ...prev]);
            setGenerated(true);
            setTimeout(() => setGenerated(false), 3000);
        } catch { /* ignore */ }
    }

    async function revokeKey(id) {
        await apiFetch(`/api/keys/${id}`, { method: "DELETE" }).catch(() => {});
        setApiKeys((prev) => prev.filter((k) => k.id !== id));
    }

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">General / Connections</div>
                    <div className="workspace-title-row">
                        <h1>Connections</h1>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Manage external service integrations, webhooks, and API keys.
                    </p>
                </div>
            </div>

            {/* Integrations */}
            <div className="workspace-section-title" style={{ marginBottom: 12 }}>Integrations</div>
            <div className="connections-grid">
                {sortedServices().map((svc) => {
                    const Icon = svc.icon;
                    return (
                        <div key={svc.serviceId} className="integration-card">
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div
                                    className="integration-icon"
                                    style={{ background: svc.color + "22", color: svc.color }}
                                >
                                    <Icon size={16} />
                                </div>
                                <div>
                                    <div className="integration-name">{svc.name}</div>
                                    <div className="integration-cat">{svc.category}</div>
                                </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                                    background: svc.connected ? "rgba(45,216,129,0.12)" : "var(--panel-muted)",
                                    color: svc.connected ? "var(--success)" : "var(--muted)",
                                }}>
                                    {svc.connected ? "Connected" : "Not connected"}
                                </span>
                                {svc.connected && (
                                    <Toggle on={svc.enabled} onToggle={() => {
                                        apiFetch(`/api/connections/${svc.serviceId}/toggle`, { method: "PATCH" })
                                            .then((updated) => setServices((prev) => prev.map((s) => s.serviceId === svc.serviceId ? updated : s)))
                                            .catch(() => {});
                                    }} />
                                )}
                            </div>

                            <div className="integration-footer">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ fontSize: 12, padding: "6px 14px" }}
                                    onClick={() => toggleService(svc)}
                                >
                                    {svc.connected ? "Disconnect" : "Connect"}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Webhooks */}
            <div style={{ marginTop: 32 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div className="workspace-section-title">Webhooks</div>
                    <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}
                        onClick={() => setShowWHForm((v) => !v)}
                    >
                        {showWHForm ? <X size={13} /> : <Plus size={13} />}
                        {showWHForm ? "Cancel" : "Add Webhook"}
                    </button>
                </div>

                {showWHForm && (
                    <form onSubmit={addWebhook} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                        <input
                            className="form-input"
                            style={{ flex: 1 }}
                            placeholder="https://your-server.com/hooks/endpoint"
                            value={whUrl}
                            onChange={(e) => setWhUrl(e.target.value)}
                        />
                        <button type="submit" className="btn-primary" style={{ fontSize: 12, padding: "0 18px" }}>
                            Add
                        </button>
                    </form>
                )}

                <div className="audit-list">
                    {webhooks.length === 0 && (
                        <div className="audit-row" style={{ color: "var(--muted)", fontSize: 13 }}>No webhooks configured.</div>
                    )}
                    {webhooks.map((wh) => (
                        <div key={wh.id} className="audit-row" style={{ alignItems: "center" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted-strong)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {wh.url}
                                </div>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {(wh.events || "").split(",").map((ev) => (
                                        <span key={ev} className="event-pill changed" style={{ fontSize: 10 }}>{ev}</span>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                <span style={{ fontSize: 11, color: "var(--muted)" }}>{wh.lastTriggered || "never"}</span>
                                <span style={{
                                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                                    background: wh.active ? "rgba(45,216,129,0.12)" : "var(--panel-muted)",
                                    color: wh.active ? "var(--success)" : "var(--muted)",
                                }}>
                                    {wh.active ? "active" : "disabled"}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeWebhook(wh.id)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex" }}
                                    aria-label="Remove webhook"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* API Keys */}
            <div style={{ marginTop: 32 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div className="workspace-section-title">API Keys</div>
                    <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}
                        onClick={generateKey}
                    >
                        <Plus size={13} />
                        Generate New Key
                    </button>
                </div>

                {generated && (
                    <div className="inline-success" style={{ marginBottom: 10 }}>New API key generated successfully.</div>
                )}

                <div className="audit-list">
                    {apiKeys.map((key) => (
                        <div key={key.id} className="audit-row" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{key.name}</div>
                                <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--accent)", letterSpacing: "0.04em" }}>
                                    {key.maskedDisplay}
                                </div>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", flexShrink: 0 }}>
                                <div>Created {key.createdAt ? key.createdAt.slice(0, 10) : "—"}</div>
                                <div>Last used {key.lastUsed || "never"}</div>
                            </div>
                            <button
                                type="button"
                                className="btn-secondary"
                                style={{ fontSize: 12, padding: "6px 14px", color: "var(--danger)", borderColor: "rgba(255,106,95,0.3)", flexShrink: 0 }}
                                onClick={() => revokeKey(key.id)}
                            >
                                Revoke
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
