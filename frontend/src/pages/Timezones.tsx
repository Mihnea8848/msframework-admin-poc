import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import { get, put } from "../api/client";
import type { OrgSetting } from "../api/types";
import { readStorage, writeStorage } from "../utils/storage";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import PageHeader from "../ui/PageHeader";
import "../ui/field.css";
import "../ui/list.css";
import "../ui/surface.css";
import "./timezones.css";

interface Clock {
    label: string;
    tz: string;
}

interface ClockEntry extends Clock {
    id: string;
}

const IANA_ZONES: Clock[] = [
    { label: "UTC", tz: "UTC" },
    { label: "London", tz: "Europe/London" },
    { label: "Paris", tz: "Europe/Paris" },
    { label: "Berlin", tz: "Europe/Berlin" },
    { label: "Helsinki", tz: "Europe/Helsinki" },
    { label: "Bucharest", tz: "Europe/Bucharest" },
    { label: "Moscow", tz: "Europe/Moscow" },
    { label: "Istanbul", tz: "Europe/Istanbul" },
    { label: "Dubai", tz: "Asia/Dubai" },
    { label: "Karachi", tz: "Asia/Karachi" },
    { label: "Mumbai", tz: "Asia/Kolkata" },
    { label: "Bangkok", tz: "Asia/Bangkok" },
    { label: "Singapore", tz: "Asia/Singapore" },
    { label: "Tokyo", tz: "Asia/Tokyo" },
    { label: "Seoul", tz: "Asia/Seoul" },
    { label: "Sydney", tz: "Australia/Sydney" },
    { label: "Auckland", tz: "Pacific/Auckland" },
    { label: "Honolulu", tz: "Pacific/Honolulu" },
    { label: "Los Angeles", tz: "America/Los_Angeles" },
    { label: "Denver", tz: "America/Denver" },
    { label: "Chicago", tz: "America/Chicago" },
    { label: "New York", tz: "America/New_York" },
    { label: "Toronto", tz: "America/Toronto" },
    { label: "São Paulo", tz: "America/Sao_Paulo" },
    { label: "Buenos Aires", tz: "America/Argentina/Buenos_Aires" },
    { label: "Mexico City", tz: "America/Mexico_City" },
    { label: "Bogotá", tz: "America/Bogota" },
    { label: "Johannesburg", tz: "Africa/Johannesburg" },
    { label: "Cairo", tz: "Africa/Cairo" },
    { label: "Lagos", tz: "Africa/Lagos" },
];

const DEFAULT_CLOCKS: Clock[] = [
    { label: "UTC", tz: "UTC" },
    { label: "New York", tz: "America/New_York" },
    { label: "London", tz: "Europe/London" },
    { label: "Paris", tz: "Europe/Paris" },
    { label: "Tokyo", tz: "Asia/Tokyo" },
    { label: "Sydney", tz: "Australia/Sydney" },
];

function withIds(clocks: Clock[]): ClockEntry[] {
    return clocks.map((c, i) => ({ ...c, id: `${c.tz}-${c.label}-${i}` }));
}

function getOffset(tz: string) {
    try {
        const fmt = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "shortOffset" });
        const parts = fmt.formatToParts(new Date());
        const offset = parts.find((p) => p.type === "timeZoneName")?.value || "UTC";
        return offset === "GMT" ? "UTC+0" : offset.replace("GMT", "UTC");
    } catch {
        return "UTC";
    }
}

function getTime(tz: string, now: Date) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).format(now);
}

function getDate(tz: string, now: Date) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        weekday: "short",
        month: "short",
        day: "numeric",
    }).format(now);
}

type Biz = "open" | "edge" | "closed";

function getBizStatus(tz: string, now: Date): Biz {
    const hour = parseInt(
        new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(now),
        10
    );
    if (hour >= 9 && hour < 17) return "open";
    if (hour === 8 || hour === 17) return "edge";
    return "closed";
}

const BIZ_TITLE: Record<Biz, string> = { open: "Business hours", edge: "Near opening/closing", closed: "Outside business hours" };

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

function ClockCard({ entry, onRemove, now, removable }: {
    entry: ClockEntry;
    onRemove: (id: string) => void;
    now: Date;
    removable: boolean;
}) {
    const biz = getBizStatus(entry.tz, now);
    return (
        <li className="ms-cut ms-timezones__card">
            <div className="ms-timezones__card-head">
                <h3 className="ms-timezones__city">{entry.label}</h3>
                <span className={`ms-timezones__biz ms-timezones__biz--${biz}`} title={BIZ_TITLE[biz]}>
                    <span className="ms-timezones__dot" aria-hidden="true" />
                    <span className="ms-visually-hidden">{BIZ_TITLE[biz]}</span>
                </span>
                {removable && (
                    <button type="button" className="ms-timezones__remove" onClick={() => onRemove(entry.id)} aria-label={`Remove ${entry.label}`}>
                        <X aria-hidden="true" />
                    </button>
                )}
            </div>
            <p className="ms-timezones__time">{getTime(entry.tz, now)}</p>
            <p className="ms-timezones__date">{getDate(entry.tz, now)}</p>
            <span className="ms-tag ms-timezones__offset">{getOffset(entry.tz)}</span>
        </li>
    );
}

export default function Timezones() {
    const { user } = useAuth();
    const canEdit = hasPermission(user, "TIMEZONES_UPDATE");

    const [now, setNow] = useState(() => new Date());
    const [clocks, setClocks] = useState<ClockEntry[]>(() => withIds(DEFAULT_CLOCKS));
    const [orgTz, setOrgTz] = useState(() => readStorage("orgTimezone", "UTC"));
    const [savedTz, setSavedTz] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [addLabel, setAddLabel] = useState("");
    const [addTz, setAddTz] = useState("UTC");

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        let alive = true;
        Promise.all([get<OrgSetting>("/api/settings/orgTimezone"), get<OrgSetting>("/api/settings/worldClocks")])
            .then(([tzSetting, clockSetting]) => {
                if (!alive) return;
                if (tzSetting?.value) {
                    setOrgTz(tzSetting.value);
                    setSavedTz(tzSetting.value);
                    writeStorage("orgTimezone", tzSetting.value);
                }
                if (clockSetting?.value) {
                    try {
                        const parsed: unknown = JSON.parse(clockSetting.value);
                        if (Array.isArray(parsed)) setClocks(withIds(parsed as Clock[]));
                    } catch {
                        // keep defaults
                    }
                }
            })
            .catch((err: unknown) => { if (alive) setError(messageOf(err)); });
        return () => { alive = false; };
    }, []);

    function flash(text: string) {
        setMessage(text);
        setTimeout(() => setMessage(null), 2500);
    }

    async function saveClocks(next: Clock[]) {
        setBusy(true);
        setError(null);
        try {
            const payload = next.map(({ label, tz }) => ({ label, tz }));
            await put("/api/settings/worldClocks", { value: JSON.stringify(payload) });
            setClocks(withIds(payload));
            flash("World clocks saved for everyone in the organisation.");
            return true;
        } catch (err) {
            setError(messageOf(err));
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function saveOrgTz() {
        setBusy(true);
        setError(null);
        try {
            const saved = await put<OrgSetting>("/api/settings/orgTimezone", { value: orgTz });
            setSavedTz(saved.value);
            if (saved.value) writeStorage("orgTimezone", saved.value);
            flash(`Default timezone set to ${saved.value}.`);
        } catch (err) {
            setError(messageOf(err));
        } finally {
            setBusy(false);
        }
    }

    async function addClock(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const label = addLabel.trim();
        if (!label) return;
        if (await saveClocks([...clocks, { label, tz: addTz }])) {
            setAddLabel("");
            setAddTz("UTC");
        }
    }

    function removeClock(id: string) {
        saveClocks(clocks.filter((c) => c.id !== id));
    }

    return (
        <section className="ms-timezones">
            <PageHeader
                eyebrow="General"
                title="Timezones"
                description="Monitor local times across your organization's locations."
            />

            {error && <Alert tone="danger" role="alert" className="ms-notice">{error}</Alert>}
            {message && <Alert tone="ok" role="status" className="ms-notice">{message}</Alert>}

            {clocks.length === 0 ? (
                <div className="ms-empty"><p>No clocks configured.</p></div>
            ) : (
                <ul className="ms-timezones__grid">
                    {clocks.map((entry) => (
                        <ClockCard key={entry.id} entry={entry} onRemove={removeClock} now={now} removable={canEdit && !busy} />
                    ))}
                </ul>
            )}

            <div className="ms-timezones__panels">
                {canEdit && (
                    <section className="ms-panel" aria-labelledby="tz-add">
                        <div className="ms-panel__head">
                            <h2 className="ms-panel__title" id="tz-add">Add a Timezone</h2>
                        </div>
                        <form onSubmit={addClock} className="ms-timezones__form">
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="tz-label">City label</label>
                                <input id="tz-label" className="ms-input" placeholder="City label (e.g. Dubai)" value={addLabel} maxLength={40}
                                    onChange={(e) => setAddLabel(e.target.value)} />
                            </div>
                            <div className="ms-field">
                                <label className="ms-field__label" htmlFor="tz-zone">Timezone</label>
                                <div className="ms-select">
                                    <select id="tz-zone" className="ms-input" value={addTz} onChange={(e) => setAddTz(e.target.value)}>
                                        {IANA_ZONES.map((z) => (
                                            <option key={z.tz} value={z.tz}>{z.label} — {z.tz}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="ms-timezones__actions">
                                <Button type="submit" variant="primary" icon={<Plus aria-hidden="true" />} disabled={!addLabel.trim() || busy || clocks.length >= 24}>
                                    Add
                                </Button>
                                <Button disabled={busy} onClick={() => saveClocks(DEFAULT_CLOCKS)}>Reset to defaults</Button>
                            </div>
                        </form>
                    </section>
                )}

                <section className="ms-panel" aria-labelledby="tz-default">
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id="tz-default">Organization Default</h2>
                    </div>
                    <div className="ms-timezones__form">
                        <p className="ms-timezones__sub">
                            <strong>Default Timezone.</strong> The organisation&apos;s reference timezone{savedTz ? ` (currently ${savedTz})` : " (not set yet)"}.
                        </p>
                        {canEdit ? (
                            <div className="ms-timezones__inline">
                                <div className="ms-select">
                                    <select className="ms-input" value={orgTz} onChange={(e) => setOrgTz(e.target.value)} aria-label="Default timezone">
                                        {!IANA_ZONES.some((z) => z.tz === orgTz) && <option value={orgTz}>{orgTz}</option>}
                                        {IANA_ZONES.map((z) => (
                                            <option key={z.tz} value={z.tz}>{z.label} — {z.tz}</option>
                                        ))}
                                    </select>
                                </div>
                                <Button variant="primary" onClick={saveOrgTz} disabled={busy || orgTz === savedTz}>Save</Button>
                            </div>
                        ) : (
                            <p className="ms-timezones__sub">Only administrators can change the organisation settings.</p>
                        )}
                    </div>
                </section>
            </div>
        </section>
    );
}
