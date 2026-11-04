import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { hasPermission } from "../../auth/permissions";
import { get } from "../../api/client";
import { fetchOrgSettings, saveOrgSettings } from "../../api/security";
import type { OrgSettingsDto } from "../../api/security";
import type { OrgSetting } from "../../api/types";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import Toggle from "../../ui/Toggle";
import {
    PASSWORD_MIN_LENGTH_CEILING, PASSWORD_MIN_LENGTH_FLOOR, formatTimeout, orgChanges, toOrgForm, validateOrgForm,
} from "./orgSettingsForm";
import type { OrgForm, OrgFormErrors } from "./orgSettingsForm";
import TimezonePicker from "./TimezonePicker";
import DirectorySync from "./DirectorySync";
import "../../ui/field.css";
import "../../ui/surface.css";
import "./account.css";

type Clock = { label: string; tz: string };

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

function parseClocks(setting: OrgSetting | null): Clock[] {
    if (!setting?.value) return [];
    try {
        const parsed: unknown = JSON.parse(setting.value);
        return Array.isArray(parsed)
            ? parsed.filter((c): c is Clock => typeof c?.label === "string" && typeof c?.tz === "string")
            : [];
    } catch {
        return [];
    }
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
    if (!message) return null;
    return (
        <p className="ms-field__error" id={id}>
            <TriangleAlert aria-hidden="true" />
            <span>{message}</span>
        </p>
    );
}

/** The world clocks panel: they are edited on the Timezones page. */
function WorldClocks() {
    const { user } = useAuth();
    const canOpenTimezones = hasPermission(user, "TIMEZONES_READ");
    const canEdit = hasPermission(user, "TIMEZONES_UPDATE");
    const [clocks, setClocks] = useState<Clock[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        get<OrgSetting | null>("/api/settings/worldClocks")
            .then((setting) => { if (alive) setClocks(parseClocks(setting)); })
            .catch((err: unknown) => { if (alive) setError(messageOf(err)); });
        return () => { alive = false; };
    }, []);

    return (
        <section className="ms-panel" aria-labelledby="org-clocks">
            <div className="ms-panel__head">
                <h2 className="ms-panel__title" id="org-clocks">World clocks</h2>
            </div>
            <div className="ms-account__body">
                {error && <Alert tone="danger" role="alert">Could not load the clocks: {error}</Alert>}
                {!error && clocks === null && <p className="ms-account__sub" role="status">Loading…</p>}
                {clocks && (
                    <p className="ms-account__sub">
                        {clocks.length === 0 ? "The default set of clocks." : clocks.map((c) => c.label).join(", ")}
                    </p>
                )}
                <p className="ms-account__sub">
                    {canOpenTimezones ? (
                        <>{canEdit ? "Change them" : "See them"} on the <Link className="ms-link" to="/timezones">Timezones</Link> page.</>
                    ) : (
                        "An administrator sets these on the Timezones page."
                    )}
                </p>
            </div>
        </section>
    );
}

/**
 * Settings > Organisation: company name, self-registration, the minimum password length and
 * the default timezone (GET/PUT /api/org/settings), and the session timeout, which the server
 * sets. Editable with ORG_SETTINGS_MANAGE, read only for everyone else.
 */
export default function OrganisationTab() {
    const { user } = useAuth();
    const canEdit = hasPermission(user, "ORG_SETTINGS_MANAGE");
    const [saved, setSaved] = useState<OrgSettingsDto | null>(null);
    const [form, setForm] = useState<OrgForm | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [errors, setErrors] = useState<OrgFormErrors>({});
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);

    useEffect(() => {
        let alive = true;
        fetchOrgSettings()
            .then((dto) => {
                if (!alive) return;
                setSaved(dto);
                setForm(toOrgForm(dto));
            })
            .catch((err: unknown) => { if (alive) setLoadError(messageOf(err)); });
        return () => { alive = false; };
    }, []);

    const changes = saved && form ? orgChanges(saved, form) : {};
    const dirty = Object.keys(changes).length > 0;

    function update<K extends keyof OrgForm>(key: K, value: OrgForm[K]) {
        setForm((f) => (f ? { ...f, [key]: value } : f));
        setErrors((e) => ({ ...e, [key]: undefined }));
        setMessage(null);
    }

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!form || !saved || !canEdit || busy) return;
        const found = validateOrgForm(form);
        setErrors(found);
        if (Object.keys(found).length > 0) return;
        if (!dirty) return;
        setBusy(true);
        setMessage(null);
        try {
            const next = await saveOrgSettings(changes);
            setSaved(next);
            setForm(toOrgForm(next));
            setMessage({ tone: "ok", text: "Organisation settings saved." });
        } catch (err) {
            setMessage({ tone: "danger", text: messageOf(err) });
        } finally {
            setBusy(false);
        }
    }

    const readOnly = !canEdit;

    return (
        <div className="ms-account">
            <div className="ms-account__grid ms-account__grid--wide">
                <form className="ms-panel ms-account__card" onSubmit={onSubmit} aria-labelledby="org-general" noValidate>
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id="org-general">Organisation</h2>
                        {readOnly && <span className="ms-tag">Read only</span>}
                    </div>
                    <div className="ms-account__body">
                        {loadError && <Alert tone="danger" role="alert">Could not load the settings: {loadError}</Alert>}
                        {!loadError && !form && <p className="ms-account__sub" role="status">Loading…</p>}
                        {form && saved && (
                            <>
                                {readOnly && (
                                    <p className="ms-account__sub">Only administrators can change these settings.</p>
                                )}
                                <div className="ms-field">
                                    <label className="ms-field__label" htmlFor="org-name">Company name</label>
                                    <input id="org-name" className="ms-input" value={form.companyName} maxLength={120}
                                        disabled={readOnly} aria-invalid={errors.companyName ? true : undefined}
                                        aria-describedby={errors.companyName ? "org-name-error" : undefined}
                                        onChange={(e) => update("companyName", e.target.value)} />
                                    <FieldError id="org-name-error" message={errors.companyName} />
                                </div>

                                <div className="ms-account__switch">
                                    <div className="ms-account__row-text">
                                        <span className="ms-field__label" id="org-registration">Registration open</span>
                                        <p className="ms-account__sub" id="org-registration-hint">
                                            {form.registrationEnabled
                                                ? "People can request access from the sign-in page. An administrator approves each request."
                                                : "The sign-in page hides Request access. Administrators create accounts."}
                                        </p>
                                    </div>
                                    <Toggle on={form.registrationEnabled} disabled={readOnly}
                                        label="Registration open"
                                        onToggle={() => update("registrationEnabled", !form.registrationEnabled)} />
                                </div>

                                <div className="ms-field">
                                    <label className="ms-field__label" htmlFor="org-min-length">Minimum password length</label>
                                    <input id="org-min-length" className="ms-input ms-account__number" type="number" inputMode="numeric"
                                        min={PASSWORD_MIN_LENGTH_FLOOR} max={PASSWORD_MIN_LENGTH_CEILING} step={1}
                                        value={form.passwordMinLength} disabled={readOnly}
                                        aria-invalid={errors.passwordMinLength ? true : undefined}
                                        aria-describedby={errors.passwordMinLength ? "org-min-length-error" : "org-min-length-hint"}
                                        onChange={(e) => update("passwordMinLength", e.target.value)} />
                                    {errors.passwordMinLength ? (
                                        <FieldError id="org-min-length-error" message={errors.passwordMinLength} />
                                    ) : (
                                        <p className="ms-field__hint" id="org-min-length-hint">
                                            {PASSWORD_MIN_LENGTH_FLOOR} to {PASSWORD_MIN_LENGTH_CEILING} characters. Applies to new passwords; existing ones keep working.
                                        </p>
                                    )}
                                </div>

                                <div className="ms-field">
                                    <label className="ms-field__label" htmlFor="org-timezone">Default timezone</label>
                                    <TimezonePicker id="org-timezone" value={form.defaultTimezone} disabled={readOnly}
                                        invalid={Boolean(errors.defaultTimezone)}
                                        describedBy={errors.defaultTimezone ? "org-timezone-error" : "org-timezone-hint"}
                                        onChange={(zone) => update("defaultTimezone", zone)} />
                                    {errors.defaultTimezone ? (
                                        <FieldError id="org-timezone-error" message={errors.defaultTimezone} />
                                    ) : (
                                        <p className="ms-field__hint" id="org-timezone-hint">
                                            {form.defaultTimezone ? "Used for dates across the studio." : "Not set: times show in UTC."}
                                        </p>
                                    )}
                                </div>

                                <dl className="ms-account__facts">
                                    <dt>Session timeout</dt>
                                    <dd>
                                        {formatTimeout(saved.sessionTimeoutMinutes)} without activity
                                        <span className="ms-account__note">Set by the server (SESSION_TIMEOUT), not here.</span>
                                    </dd>
                                </dl>

                                {message && <Alert tone={message.tone} role={message.tone === "ok" ? "status" : "alert"}>{message.text}</Alert>}
                                {canEdit && (
                                    <div className="ms-account__actions">
                                        <Button type="button" variant="ghost" disabled={!dirty || busy}
                                            onClick={() => { setForm(toOrgForm(saved)); setErrors({}); setMessage(null); }}>
                                            Discard
                                        </Button>
                                        <Button type="submit" variant="primary" disabled={!dirty || busy}>
                                            {busy ? "Saving…" : "Save changes"}
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </form>

                <WorldClocks />
            </div>
            <DirectorySync />
        </div>
    );
}
