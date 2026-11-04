import { useEffect, useId, useRef } from "react";
import type { ComponentType, KeyboardEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { SETTINGS_TABS, settingsTabByKey } from "../../routes/navigation";
import type { SettingsTabKey } from "../../routes/navigation";
import PageHeader from "../../ui/PageHeader";
import AccountTab from "./AccountTab";
import AppearanceTab from "./AppearanceTab";
import OrganisationTab from "./OrganisationTab";
import SecurityTab from "./SecurityTab";
import "./settings.css";

const PANELS: Record<SettingsTabKey, ComponentType> = {
    account: AccountTab,
    security: SecurityTab,
    appearance: AppearanceTab,
    organisation: OrganisationTab,
};

const NEXT_KEYS: Record<string, (i: number, n: number) => number> = {
    ArrowRight: (i, n) => (i + 1) % n,
    ArrowLeft: (i, n) => (i - 1 + n) % n,
    Home: () => 0,
    End: (_, n) => n - 1,
};

/**
 * Settings (/settings/:tab), opened from the top bar: Account, Security, Appearance and
 * Organisation. Each tab is a real link with its own URL, so tabs can be bookmarked and shared.
 * They also behave as a tab list: one Tab stop, and the arrow keys, Home and End move between
 * tabs (opening each one, as the URL changes with it).
 */
export default function Settings() {
    const { tab } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
    const baseId = useId();
    const current = settingsTabByKey(tab);
    const first = SETTINGS_TABS[0];
    const currentIndex = SETTINGS_TABS.findIndex((t) => t.key === current?.key);

    // On a narrow screen the tab row scrolls: keep the selected tab in view.
    useEffect(() => {
        tabRefs.current[currentIndex]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }, [currentIndex]);

    if (!current) return first ? <Navigate to={first.path} replace /> : null;
    const Panel = PANELS[current.key];

    function onKeyDown(e: KeyboardEvent<HTMLAnchorElement>, index: number) {
        const step = NEXT_KEYS[e.key];
        if (!step) return;
        e.preventDefault();
        const next = step(index, SETTINGS_TABS.length);
        const target = SETTINGS_TABS[next];
        if (!target) return;
        navigate(target.path, { replace: true });
        tabRefs.current[next]?.focus();
    }

    return (
        <section className="ms-settings">
            <PageHeader
                eyebrow="Settings"
                title={current.label}
                description={
                    current.key === "organisation"
                        ? "Settings that apply to everyone at Multimedia Entertainment Hub."
                        : `Your own settings${user ? `, signed in as ${user.fullName || user.email}` : ""}.`
                }
            />

            <div className="ms-settings__tabs" role="tablist" aria-label="Settings">
                {SETTINGS_TABS.map((t, i) => {
                    const selected = t.key === current.key;
                    const Icon = t.icon;
                    return (
                        <Link
                            key={t.key}
                            ref={(el) => { tabRefs.current[i] = el; }}
                            to={t.path}
                            id={`${baseId}-tab-${t.key}`}
                            className="ms-settings__tab"
                            role="tab"
                            aria-selected={selected}
                            aria-controls={`${baseId}-panel`}
                            tabIndex={selected ? 0 : -1}
                            onKeyDown={(e) => onKeyDown(e, i)}
                        >
                            <Icon className="ms-settings__tab-icon" aria-hidden="true" />
                            <span>{t.label}</span>
                        </Link>
                    );
                })}
            </div>

            <div
                className="ms-settings__panel"
                id={`${baseId}-panel`}
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-${current.key}`}
            >
                <Panel key={current.key} />
            </div>
        </section>
    );
}
