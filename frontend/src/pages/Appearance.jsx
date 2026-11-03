import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
    ACCENTS,
    ACCENT_LABELS,
    readAccent,
    readDensity,
    readMotion,
    readThemePreference,
    setAccent,
    setDensity,
    setMotion,
    setThemePreference,
    systemPrefersReducedMotion,
} from "../theme/appearance";

const THEME_OPTIONS = [
    { value: "dark", label: "Dark", Icon: Moon, hint: "The default" },
    { value: "light", label: "Light", Icon: Sun, hint: "Light surfaces" },
    { value: "system", label: "System", Icon: Monitor, hint: "Follows your device" },
];

const DENSITY_OPTIONS = [
    { value: "comfortable", label: "Comfortable", hint: "More space around rows and panels" },
    { value: "compact", label: "Compact", hint: "Fits more on the screen" },
];

const MOTION_OPTIONS = [
    { value: "full", label: "Full", hint: "Transitions and animations" },
    { value: "reduced", label: "Reduced", hint: "No animation" },
];

// Every chip shows a live token, so the preview follows the theme and accent.
const PREVIEW_CHIPS = [
    { label: "Canvas", bg: "var(--canvas)", fg: "var(--text-secondary)" },
    { label: "Surface", bg: "var(--surface-1)", fg: "var(--text-secondary)" },
    { label: "Raised", bg: "var(--surface-2)", fg: "var(--text-secondary)" },
    { label: "Primary", bg: "var(--primary)", fg: "var(--on-primary)" },
    { label: "Accent", bg: "var(--surface-1)", fg: "var(--accent-text)" },
    { label: "Success", bg: "var(--status-ok-bg)", fg: "var(--status-ok-fg)" },
    { label: "Warning", bg: "var(--status-warn-bg)", fg: "var(--status-warn-fg)" },
    { label: "Danger", bg: "var(--danger-solid)", fg: "var(--on-danger)" },
];

function OptionGroup({ labelId, options, value, onChange, className, optionClass }) {
    return (
        <div className={className} role="group" aria-labelledby={labelId}>
            {options.map(({ value: optionValue, label, hint, Icon }) => (
                <button
                    key={optionValue}
                    type="button"
                    className={`${optionClass}${value === optionValue ? " selected" : ""}`}
                    aria-pressed={value === optionValue}
                    onClick={() => onChange(optionValue)}
                >
                    {Icon ? <Icon size={20} aria-hidden="true" /> : null}
                    <span>{label}</span>
                    <span className="option-hint">{hint}</span>
                </button>
            ))}
        </div>
    );
}

export default function Appearance() {
    const [theme, setTheme] = useState(readThemePreference);
    const [accent, setAccentState] = useState(readAccent);
    const [density, setDensityState] = useState(readDensity);
    const [motion, setMotionState] = useState(readMotion);
    const osReducesMotion = systemPrefersReducedMotion();

    function handleTheme(next) {
        setTheme(next);
        setThemePreference(next);
    }

    function handleAccent(next) {
        setAccentState(next);
        setAccent(next);
    }

    function handleDensity(next) {
        setDensityState(next);
        setDensity(next);
    }

    function handleMotion(next) {
        setMotionState(next);
        setMotion(next);
    }

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">General / Appearance</div>
                    <div className="workspace-title-row">
                        <h1>Appearance</h1>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Personalise the look and feel. Changes apply at once and are saved in this browser.
                    </p>
                </div>
            </div>

            <div className="appearance-section">
                <h2 className="appearance-section-title" id="appearance-theme">Theme</h2>
                <p className="appearance-section-sub">Dark is the default. System follows the light or dark setting of your device.</p>
                <OptionGroup
                    labelId="appearance-theme"
                    className="theme-toggle-row"
                    optionClass="theme-option"
                    options={THEME_OPTIONS}
                    value={theme}
                    onChange={handleTheme}
                />
            </div>

            <div className="appearance-section">
                <h2 className="appearance-section-title" id="appearance-accent">Accent colour</h2>
                <p className="appearance-section-sub">Colours buttons, links, the current page marker and the focus ring.</p>
                <div className="accent-swatches" role="group" aria-labelledby="appearance-accent">
                    {ACCENTS.map((key) => (
                        <button
                            key={key}
                            type="button"
                            className={`accent-option${accent === key ? " selected" : ""}`}
                            aria-pressed={accent === key}
                            onClick={() => handleAccent(key)}
                        >
                            <span className="accent-swatch" style={{ background: `var(--accent-${key}-line)` }} aria-hidden="true" />
                            <span>{ACCENT_LABELS[key]}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="appearance-section">
                <h2 className="appearance-section-title" id="appearance-density">Density</h2>
                <p className="appearance-section-sub">Controls the spacing of rows, panels and controls.</p>
                <OptionGroup
                    labelId="appearance-density"
                    className="density-row"
                    optionClass="density-option"
                    options={DENSITY_OPTIONS}
                    value={density}
                    onChange={handleDensity}
                />
            </div>

            <div className="appearance-section">
                <h2 className="appearance-section-title" id="appearance-motion">Motion</h2>
                <p className="appearance-section-sub">
                    Defaults to your device setting, which is currently {osReducesMotion ? "reduced" : "full"} motion.
                </p>
                <OptionGroup
                    labelId="appearance-motion"
                    className="density-row"
                    optionClass="density-option"
                    options={MOTION_OPTIONS}
                    value={motion}
                    onChange={handleMotion}
                />
            </div>

            <div className="appearance-section">
                <h2 className="appearance-section-title">Preview</h2>
                <p className="appearance-section-sub">The current palette, taken from the live colour tokens.</p>
                <div className="preview-palette">
                    {PREVIEW_CHIPS.map((chip) => (
                        <div key={chip.label} className="palette-chip" style={{ background: chip.bg }}>
                            <span className="palette-chip-label" style={{ color: chip.fg }}>{chip.label}</span>
                        </div>
                    ))}
                </div>
                <div className="preview-sample">
                    <button type="button" className="btn-primary">Primary</button>
                    <button type="button" className="btn-secondary">Secondary</button>
                    <span className="preview-link">Accent link</span>
                </div>
            </div>
        </section>
    );
}
