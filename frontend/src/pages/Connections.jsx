import { useState } from "react";
import {
    MessageSquare, Github, Chrome, CreditCard, Layers, Cloud,
    Zap, Mail, BarChart2, Bell, Phone, BookOpen, Trash2, Plus, X,
} from "lucide-react";

const INITIAL_SERVICES = [
    { id: "slack",     name: "Slack",             icon: MessageSquare, color: "#4A154B", category: "Messaging",     connected: true  },
    { id: "github",    name: "GitHub",             icon: Github,        color: "#24292e", category: "Development",   connected: true  },
    { id: "google",    name: "Google Workspace",   icon: Chrome,        color: "#4285F4", category: "Productivity",  connected: true  },
    { id: "stripe",    name: "Stripe",             icon: CreditCard,    color: "#635BFF", category: "Payments",      connected: true  },
    { id: "jira",      name: "Jira",               icon: Layers,        color: "#0052CC", category: "Project Mgmt",  connected: false },
    { id: "aws",       name: "AWS S3",             icon: Cloud,         color: "#FF9900", category: "Storage",       connected: false },
    { id: "zapier",    name: "Zapier",             icon: Zap,           color: "#FF4A00", category: "Automation",    connected: false },
    { id: "sendgrid",  name: "SendGrid",           icon: Mail,          color: "#1A82E2", category: "Email",         connected: false },
    { id: "datadog",   name: "Datadog",            icon: BarChart2,     color: "#632CA6", category: "Monitoring",    connected: false },
    { id: "pagerduty", name: "PagerDuty",          icon: Bell,          color: "#06AC38", category: "Alerting",      connected: false },
    { id: "twilio",    name: "Twilio",             icon: Phone,         color: "#F22F46", category: "Messaging",     connected: false },
    { id: "notion",    name: "Notion",             icon: BookOpen,      color: "#000000", category: "Productivity",  connected: false },
];

const INITIAL_WEBHOOKS = [
    { id: 1, url: "https://hooks.example.com/events/a8f2c",   events: ["user.created", "user.deleted"], lastTriggered: "12m ago",  active: true  },
    { id: 2, url: "https://hooks.example.com/events/b91de",   events: ["dept.created"],                 lastTriggered: "2h ago",   active: true  },
    { id: 3, url: "https://hooks.internal/security-log",      events: ["auth.failed", "role.changed"],  lastTriggered: "1d ago",   active: false },
    { id: 4, url: "https://hooks.example.com/events/notify",  events: ["export.generated"],             lastTriggered: "3d ago",   active: true  },
];

const INITIAL_KEYS = [
    { id: 1, name: "Production API Key",    created: "2026-01-10", lastUsed: "2026-05-09", masked: "sk_live_••••••••••••••••Xk2f" },
    { id: 2, name: "CI / CD Pipeline",      created: "2026-02-14", lastUsed: "2026-05-08", masked: "sk_live_••••••••••••••••P7nt" },
    { id: 3, name: "Analytics Integration", created: "2026-03-01", lastUsed: "2026-04-22", masked: "sk_live_••••••••••••••••Wq3m" },
];

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

export default function Connections() {
    const [services, setServices]     = useState(INITIAL_SERVICES);
    const [webhooks, setWebhooks]     = useState(INITIAL_WEBHOOKS);
    const [apiKeys, setApiKeys]       = useState(INITIAL_KEYS);
    const [showWHForm, setShowWHForm] = useState(false);
    const [whUrl, setWhUrl]           = useState("");
    const [generated, setGenerated]   = useState(false);

    function toggleService(id) {
        setServices((prev) =>
            prev.map((s) => s.id === id ? { ...s, connected: !s.connected } : s)
        );
    }

    function removeWebhook(id) {
        setWebhooks((prev) => prev.filter((w) => w.id !== id));
    }

    function addWebhook(e) {
        e.preventDefault();
        if (!whUrl) return;
        setWebhooks((prev) => [
            { id: Date.now(), url: whUrl, events: ["*"], lastTriggered: "never", active: true },
            ...prev,
        ]);
        setWhUrl("");
        setShowWHForm(false);
    }

    function revokeKey(id) {
        setApiKeys((prev) => prev.filter((k) => k.id !== id));
    }

    function generateKey() {
        const rand = Math.random().toString(36).slice(-4).toUpperCase();
        setApiKeys((prev) => [
            { id: Date.now(), name: "New API Key", created: new Date().toISOString().slice(0, 10), lastUsed: "never", masked: `sk_live_••••••••••••••••${rand}` },
            ...prev,
        ]);
        setGenerated(true);
        setTimeout(() => setGenerated(false), 3000);
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
                {services.map((svc) => {
                    const Icon = svc.icon;
                    return (
                        <div key={svc.id} className="integration-card">
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
                                    <Toggle on={svc.connected} onToggle={() => toggleService(svc.id)} />
                                )}
                            </div>

                            <div className="integration-footer">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ fontSize: 12, padding: "6px 14px" }}
                                    onClick={() => toggleService(svc.id)}
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
                                    {wh.events.map((ev) => (
                                        <span key={ev} className="event-pill changed" style={{ fontSize: 10 }}>{ev}</span>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                <span style={{ fontSize: 11, color: "var(--muted)" }}>{wh.lastTriggered}</span>
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
                                    {key.masked}
                                </div>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", flexShrink: 0 }}>
                                <div>Created {key.created}</div>
                                <div>Last used {key.lastUsed}</div>
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
