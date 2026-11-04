import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { hasPermission } from "../../auth/permissions";
import { get } from "../../api/client";
import type { OrgSetting } from "../../api/types";
import { formatDateTime } from "../../utils/format";
import Alert from "../../ui/Alert";
import "../../ui/field.css";
import "../../ui/surface.css";
import "./account.css";

type Clock = { label: string; tz: string };

type OrgState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; timezone: OrgSetting | null; clocks: Clock[] };

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

/**
 * Settings > Organisation: the organisation-wide settings the app has today (the organisation
 * timezone and the world clocks, both edited on the Timezones page). More arrive later.
 */
export default function OrganisationTab() {
    const { user } = useAuth();
    const [state, setState] = useState<OrgState>({ status: "loading" });
    const canOpenTimezones = hasPermission(user, "TIMEZONES_READ");
    const canEdit = hasPermission(user, "TIMEZONES_UPDATE");

    useEffect(() => {
        let alive = true;
        Promise.all([get<OrgSetting | null>("/api/settings/orgTimezone"), get<OrgSetting | null>("/api/settings/worldClocks")])
            .then(([timezone, clocks]) => {
                if (!alive) return;
                setState({ status: "ready", timezone, clocks: parseClocks(clocks) });
            })
            .catch((err: unknown) => {
                if (alive) setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
            });
        return () => {
            alive = false;
        };
    }, []);

    return (
        <div className="ms-account">
            <div className="ms-account__grid">
                <section className="ms-panel" aria-labelledby="org-general">
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id="org-general">Organisation</h2>
                    </div>
                    <div className="ms-account__body">
                        <dl className="ms-account__facts">
                            <dt>Name</dt>
                            <dd>Multimedia Entertainment Hub</dd>
                            <dt>Domain</dt>
                            <dd>mehstudios.net</dd>
                        </dl>
                        <p className="ms-account__sub">More organisation-wide settings arrive soon.</p>
                    </div>
                </section>

                <section className="ms-panel" aria-labelledby="org-time">
                    <div className="ms-panel__head">
                        <h2 className="ms-panel__title" id="org-time">Time</h2>
                    </div>
                    <div className="ms-account__body">
                        {state.status === "loading" && <p className="ms-account__sub" role="status">Loading…</p>}
                        {state.status === "error" && <Alert tone="danger" role="alert">Could not load the settings: {state.message}</Alert>}
                        {state.status === "ready" && (
                            <dl className="ms-account__facts">
                                <dt>Timezone</dt>
                                <dd>
                                    {state.timezone?.value ?? "Not set (UTC)"}
                                    {state.timezone?.updatedAt ? (
                                        <span className="ms-account__sub"> · changed {formatDateTime(state.timezone.updatedAt)}</span>
                                    ) : null}
                                </dd>
                                <dt>World clocks</dt>
                                <dd>
                                    {state.clocks.length === 0
                                        ? "The default set"
                                        : state.clocks.map((c) => c.label).join(", ")}
                                </dd>
                            </dl>
                        )}
                        <p className="ms-account__sub">
                            {canOpenTimezones ? (
                                <>
                                    {canEdit ? "Change them" : "See them"} on the <Link className="ms-link" to="/timezones">Timezones</Link> page.
                                </>
                            ) : (
                                "An administrator sets these on the Timezones page."
                            )}
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}
