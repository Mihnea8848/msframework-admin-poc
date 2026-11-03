import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import { get, put } from "../api/client";
import { readStorage, writeStorage } from "../utils/storage";
import PageHeader from "../ui/PageHeader";

const IANA_ZONES = [
    { label: "UTC",               tz: "UTC"                    },
    { label: "London",            tz: "Europe/London"          },
    { label: "Paris",             tz: "Europe/Paris"           },
    { label: "Berlin",            tz: "Europe/Berlin"          },
    { label: "Helsinki",          tz: "Europe/Helsinki"        },
    { label: "Bucharest",         tz: "Europe/Bucharest"       },
    { label: "Moscow",            tz: "Europe/Moscow"          },
    { label: "Istanbul",          tz: "Europe/Istanbul"        },
    { label: "Dubai",             tz: "Asia/Dubai"             },
    { label: "Karachi",           tz: "Asia/Karachi"           },
    { label: "Mumbai",            tz: "Asia/Kolkata"           },
    { label: "Bangkok",           tz: "Asia/Bangkok"           },
    { label: "Singapore",         tz: "Asia/Singapore"         },
    { label: "Tokyo",             tz: "Asia/Tokyo"             },
    { label: "Seoul",             tz: "Asia/Seoul"             },
    { label: "Sydney",            tz: "Australia/Sydney"       },
    { label: "Auckland",          tz: "Pacific/Auckland"       },
    { label: "Honolulu",          tz: "Pacific/Honolulu"       },
    { label: "Los Angeles",       tz: "America/Los_Angeles"    },
    { label: "Denver",            tz: "America/Denver"         },
    { label: "Chicago",           tz: "America/Chicago"        },
    { label: "New York",          tz: "America/New_York"       },
    { label: "Toronto",           tz: "America/Toronto"        },
    { label: "São Paulo",         tz: "America/Sao_Paulo"      },
    { label: "Buenos Aires",      tz: "America/Argentina/Buenos_Aires" },
    { label: "Mexico City",       tz: "America/Mexico_City"    },
    { label: "Bogotá",            tz: "America/Bogota"         },
    { label: "Johannesburg",      tz: "Africa/Johannesburg"    },
    { label: "Cairo",             tz: "Africa/Cairo"           },
    { label: "Lagos",             tz: "Africa/Lagos"           },
];

const DEFAULT_CLOCKS = [
    { label: "UTC", tz: "UTC" },
    { label: "New York", tz: "America/New_York" },
    { label: "London", tz: "Europe/London" },
    { label: "Paris", tz: "Europe/Paris" },
    { label: "Tokyo", tz: "Asia/Tokyo" },
    { label: "Sydney", tz: "Australia/Sydney" },
];

function withIds(clocks) {
    return clocks.map((c, i) => ({ ...c, id: `${c.tz}-${c.label}-${i}` }));
}

function getOffset(tz) {
    try {
        const fmt = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "shortOffset" });
        const parts = fmt.formatToParts(new Date());
        const offset = parts.find((p) => p.type === "timeZoneName")?.value || "UTC";
        return offset === "GMT" ? "UTC+0" : offset.replace("GMT", "UTC");
    } catch {
        return "UTC";
    }
}

function getTime(tz, now) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).format(now);
}

function getDate(tz, now) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        weekday: "short",
        month: "short",
        day: "numeric",
    }).format(now);
}

function getBizStatus(tz, now) {
    const hour = parseInt(
        new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(now),
        10
    );
    if (hour >= 9 && hour < 17) return "open";
    if (hour === 8 || hour === 17) return "edge";
    return "closed";
}

const BIZ_COLOR = { open: "var(--success)", edge: "var(--status-warn-fg)", closed: "var(--muted)" };
const BIZ_TITLE = { open: "Business hours", edge: "Near opening/closing", closed: "Outside business hours" };

function ClockCard({ entry, onRemove, now, removable }) {
    const biz = getBizStatus(entry.tz, now);
    return (
        <div className="timezone-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{entry.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                        className="biz-dot"
                        style={{ background: BIZ_COLOR[biz] }}
                        title={BIZ_TITLE[biz]}
                    />
                    {removable && (
                        <button
                            type="button"
                            onClick={() => onRemove(entry.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2, display: "flex", lineHeight: 1 }}
                            aria-label={`Remove ${entry.label}`}
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>
            </div>
            <div className="clock-display">{getTime(entry.tz, now)}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{getDate(entry.tz, now)}</div>
            <div style={{ marginTop: 8 }}>
                <span className="timezone-offset">{getOffset(entry.tz)}</span>
            </div>
        </div>
    );
}

export default function Timezones() {
    const { user } = useAuth();
    const canEdit = hasPermission(user, "TIMEZONES_UPDATE");

    const [now, setNow] = useState(() => new Date());
    const [clocks, setClocks] = useState(() => withIds(DEFAULT_CLOCKS));
    const [orgTz, setOrgTz] = useState(() => readStorage("orgTimezone", "UTC"));
    const [savedTz, setSavedTz] = useState(null);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [addLabel, setAddLabel] = useState("");
    const [addTz, setAddTz] = useState("UTC");

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        let alive = true;
        Promise.all([get("/api/settings/orgTimezone"), get("/api/settings/worldClocks")])
            .then(([tzSetting, clockSetting]) => {
                if (!alive) return;
                if (tzSetting?.value) {
                    setOrgTz(tzSetting.value);
                    setSavedTz(tzSetting.value);
                    writeStorage("orgTimezone", tzSetting.value);
                }
                if (clockSetting?.value) {
                    try {
                        const parsed = JSON.parse(clockSetting.value);
                        if (Array.isArray(parsed)) setClocks(withIds(parsed));
                    } catch {
                        // keep defaults
                    }
                }
            })
            .catch((err) => { if (alive) setError(err.message); });
        return () => { alive = false; };
    }, []);

    function flash(text) {
        setMessage(text);
        setTimeout(() => setMessage(null), 2500);
    }

    async function saveClocks(next) {
        setBusy(true);
        setError(null);
        try {
            const payload = next.map(({ label, tz }) => ({ label, tz }));
            await put("/api/settings/worldClocks", { value: JSON.stringify(payload) });
            setClocks(withIds(payload));
            flash("World clocks saved for everyone in the organisation.");
            return true;
        } catch (err) {
            setError(err.message);
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function saveOrgTz() {
        setBusy(true);
        setError(null);
        try {
            const saved = await put("/api/settings/orgTimezone", { value: orgTz });
            setSavedTz(saved.value);
            writeStorage("orgTimezone", saved.value);
            flash(`Default timezone set to ${saved.value}.`);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function addClock(e) {
        e.preventDefault();
        const label = addLabel.trim();
        if (!label) return;
        if (await saveClocks([...clocks, { label, tz: addTz }])) {
            setAddLabel("");
            setAddTz("UTC");
        }
    }

    function removeClock(id) {
        saveClocks(clocks.filter((c) => c.id !== id));
    }

    return (
        <section className="workspace">
            <PageHeader
                breadcrumb="General / Timezones"
                title="Timezones"
                subtitle="Monitor local times across your organization's locations."
            />

            {error && <div className="inline-error page-banner" role="alert">{error}</div>}
            {message && <div className="inline-success page-banner" role="status">{message}</div>}

            <div className="timezone-grid">
                {clocks.map((entry) => (
                    <ClockCard key={entry.id} entry={entry} onRemove={removeClock} now={now} removable={canEdit && !busy} />
                ))}
                {clocks.length === 0 && <div className="empty-state">No clocks configured.</div>}
            </div>

            {canEdit && (
                <div style={{ marginTop: 28 }}>
                    <div className="workspace-section-title" style={{ marginBottom: 12 }}>Add a Timezone</div>
                    <form onSubmit={addClock} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <input
                            className="form-input"
                            style={{ width: 180 }}
                            placeholder="City label (e.g. Dubai)"
                            value={addLabel}
                            maxLength={40}
                            onChange={(e) => setAddLabel(e.target.value)}
                        />
                        <select className="form-select" style={{ width: 240 }} value={addTz} onChange={(e) => setAddTz(e.target.value)}>
                            {IANA_ZONES.map((z) => (
                                <option key={z.tz} value={z.tz}>{z.label} — {z.tz}</option>
                            ))}
                        </select>
                        <button
                            type="submit"
                            className="btn-primary"
                            style={{ display: "flex", alignItems: "center", gap: 6 }}
                            disabled={!addLabel.trim() || busy || clocks.length >= 24}
                        >
                            <Plus size={14} />
                            Add
                        </button>
                        <button type="button" className="btn-secondary" disabled={busy} onClick={() => saveClocks(DEFAULT_CLOCKS)}>
                            Reset to defaults
                        </button>
                    </form>
                </div>
            )}

            <div style={{ marginTop: 28 }}>
                <div className="workspace-section-title" style={{ marginBottom: 12 }}>Organization Default</div>
                <div className="settings-card" style={{ maxWidth: 480 }}>
                    <div>
                        <div className="settings-card-title">Default Timezone</div>
                        <div className="settings-card-sub">
                            The organisation&apos;s reference timezone{savedTz ? ` (currently ${savedTz})` : " (not set yet)"}.
                        </div>
                    </div>
                    {canEdit ? (
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <select
                                className="form-select"
                                style={{ flex: 1, minWidth: 200 }}
                                value={orgTz}
                                onChange={(e) => setOrgTz(e.target.value)}
                            >
                                {!IANA_ZONES.some((z) => z.tz === orgTz) && <option value={orgTz}>{orgTz}</option>}
                                {IANA_ZONES.map((z) => (
                                    <option key={z.tz} value={z.tz}>{z.label} — {z.tz}</option>
                                ))}
                            </select>
                            <button type="button" className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }} onClick={saveOrgTz} disabled={busy || orgTz === savedTz}>
                                Save
                            </button>
                        </div>
                    ) : (
                        <div className="muted-note">Only administrators can change the organisation settings.</div>
                    )}
                </div>
            </div>
        </section>
    );
}
