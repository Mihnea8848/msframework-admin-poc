import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

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

const DEFAULTS = [
    { id: "utc",     label: "UTC",      tz: "UTC",                 removable: false },
    { id: "ny",      label: "New York", tz: "America/New_York",    removable: false },
    { id: "london",  label: "London",   tz: "Europe/London",       removable: false },
    { id: "paris",   label: "Paris",    tz: "Europe/Paris",        removable: false },
    { id: "tokyo",   label: "Tokyo",    tz: "Asia/Tokyo",          removable: false },
    { id: "sydney",  label: "Sydney",   tz: "Australia/Sydney",    removable: false },
];

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

const BIZ_COLOR = { open: "var(--success)", edge: "#f0a832", closed: "var(--muted)" };
const BIZ_TITLE = { open: "Business hours", edge: "Near opening/closing", closed: "Outside business hours" };

function ClockCard({ entry, onRemove, now }) {
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
                    {entry.removable && (
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
    const [now, setNow]           = useState(new Date());
    const [clocks, setClocks]     = useState(DEFAULTS);
    const [orgTz, setOrgTz]       = useState(() => localStorage.getItem("orgTimezone") || "UTC");
    const [savedMsg, setSavedMsg] = useState(false);
    const [addLabel, setAddLabel] = useState("");
    const [addTz, setAddTz]       = useState("UTC");

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        fetch("/api/settings/orgTimezone", { credentials: "include" })
            .then((r) => { if (r.ok) return r.json(); })
            .then((data) => { if (data?.value) { setOrgTz(data.value); localStorage.setItem("orgTimezone", data.value); } })
            .catch(() => {});
    }, []);

    function saveOrgTz() {
        localStorage.setItem("orgTimezone", orgTz);
        fetch("/api/settings/orgTimezone", {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: orgTz }),
        }).catch(() => {});
        setSavedMsg(true);
        setTimeout(() => setSavedMsg(false), 2000);
    }

    function addClock(e) {
        e.preventDefault();
        if (!addLabel.trim()) return;
        setClocks((prev) => [
            ...prev,
            { id: `custom-${Date.now()}`, label: addLabel.trim(), tz: addTz, removable: true },
        ]);
        setAddLabel("");
        setAddTz("UTC");
    }

    function removeClock(id) {
        setClocks((prev) => prev.filter((c) => c.id !== id));
    }

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">General / Timezones</div>
                    <div className="workspace-title-row">
                        <h1>Timezones</h1>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Monitor local times across your organization's locations.
                    </p>
                </div>
            </div>

            {/* Clock grid */}
            <div className="timezone-grid">
                {clocks.map((entry) => (
                    <ClockCard key={entry.id} entry={entry} onRemove={removeClock} now={now} />
                ))}
            </div>

            {/* Add timezone */}
            <div style={{ marginTop: 28 }}>
                <div className="workspace-section-title" style={{ marginBottom: 12 }}>Add a Timezone</div>
                <form onSubmit={addClock} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                        className="form-input"
                        style={{ width: 180 }}
                        placeholder="City label (e.g. Dubai)"
                        value={addLabel}
                        onChange={(e) => setAddLabel(e.target.value)}
                    />
                    <select
                        className="form-select"
                        style={{ width: 220 }}
                        value={addTz}
                        onChange={(e) => setAddTz(e.target.value)}
                    >
                        {IANA_ZONES.map((z) => (
                            <option key={z.tz} value={z.tz}>{z.label} — {z.tz}</option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        className="btn-primary"
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                        disabled={!addLabel.trim()}
                    >
                        <Plus size={14} />
                        Add
                    </button>
                </form>
            </div>

            {/* Organization default */}
            <div style={{ marginTop: 28 }}>
                <div className="workspace-section-title" style={{ marginBottom: 12 }}>Organization Default</div>
                <div className="settings-card" style={{ maxWidth: 480 }}>
                    <div>
                        <div className="settings-card-title">Default Timezone</div>
                        <div className="settings-card-sub">Used when displaying timestamps across the platform.</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <select
                            className="form-select"
                            style={{ flex: 1, minWidth: 200 }}
                            value={orgTz}
                            onChange={(e) => setOrgTz(e.target.value)}
                        >
                            {IANA_ZONES.map((z) => (
                                <option key={z.tz} value={z.tz}>{z.label} — {z.tz}</option>
                            ))}
                        </select>
                        <button type="button" className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }} onClick={saveOrgTz}>
                            Save
                        </button>
                    </div>
                    {savedMsg && <div className="inline-success">Default timezone saved.</div>}
                </div>
            </div>
        </section>
    );
}
