import { useState } from "react";
import type { ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import type { AccentKey, Density, Motion, ThemePreference } from "../theme/appearance";
import Button from "../ui/Button";
import PageHeader from "../ui/PageHeader";
import "../ui/surface.css";
import "./appearance.css";

interface Option<T extends string> {
    value: T;
    label: string;
    hint: string;
    Icon?: LucideIcon;
}

const THEME_OPTIONS: Option<ThemePreference>[] = [
    { value: "dark", label: "Dark", Icon: Moon, hint: "The default" },
    { value: "light", label: "Light", Icon: Sun, hint: "Light surfaces" },
    { value: "system", label: "System", Icon: Monitor, hint: "Follows your device" },
];

const DENSITY_OPTIONS: Option<Density>[] = [
    { value: "comfortable", label: "Comfortable", hint: "More space around rows and panels" },
    { value: "compact", label: "Compact", hint: "Fits more on the screen" },
];

const MOTION_OPTIONS: Option<Motion>[] = [
    { value: "full", label: "Full", hint: "Transitions and animations" },
    { value: "reduced", label: "Reduced", hint: "No animation" },
];

// Every chip shows a live token (see appearance.css), so the preview follows the theme and accent.
const PREVIEW_CHIPS = [
    { key: "canvas", label: "Canvas" },
    { key: "surface", label: "Surface" },
    { key: "raised", label: "Raised" },
    { key: "primary", label: "Primary" },
    { key: "accent", label: "Accent" },
    { key: "success", label: "Success" },
    { key: "warning", label: "Warning" },
    { key: "danger", label: "Danger" },
] as const;

function OptionGroup<T extends string>({ labelId, options, value, onChange }: {
    labelId: string;
    options: Option<T>[];
    value: T;
    onChange: (next: T) => void;
}) {
    return (
        <div className="ms-appearance__options" role="group" aria-labelledby={labelId}>
            {options.map(({ value: optionValue, label, hint, Icon }) => (
                <button
                    key={optionValue}
                    type="button"
                    className="ms-appearance__option"
                    aria-pressed={value === optionValue}
                    onClick={() => onChange(optionValue)}
                >
                    {Icon ? <Icon className="ms-appearance__option-icon" aria-hidden="true" /> : null}
                    <span className="ms-appearance__option-label">{label}</span>
                    <span className="ms-appearance__option-hint">{hint}</span>
                </button>
            ))}
        </div>
    );
}

function Section({ id, title, sub, children }: { id: string; title: string; sub: ReactNode; children: ReactNode }) {
    return (
        <section className="ms-panel ms-appearance__section" aria-labelledby={id}>
            <div className="ms-panel__head">
                <h2 className="ms-panel__title" id={id}>{title}</h2>
            </div>
            <div className="ms-appearance__body">
                <p className="ms-appearance__sub">{sub}</p>
                {children}
            </div>
        </section>
    );
}

export default function Appearance() {
    const [theme, setTheme] = useState(readThemePreference);
    const [accent, setAccentState] = useState(readAccent);
    const [density, setDensityState] = useState(readDensity);
    const [motion, setMotionState] = useState(readMotion);
    const osReducesMotion = systemPrefersReducedMotion();

    function handleTheme(next: ThemePreference) {
        setTheme(next);
        setThemePreference(next);
    }

    function handleAccent(next: AccentKey) {
        setAccentState(next);
        setAccent(next);
    }

    function handleDensity(next: Density) {
        setDensityState(next);
        setDensity(next);
    }

    function handleMotion(next: Motion) {
        setMotionState(next);
        setMotion(next);
    }

    return (
        <section className="ms-appearance">
            <PageHeader
                eyebrow="General"
                title="Appearance"
                description="Personalise the look and feel. Changes apply at once and are saved in this browser."
            />

            <div className="ms-appearance__grid">
                <Section id="appearance-theme" title="Theme" sub="Dark is the default. System follows the light or dark setting of your device.">
                    <OptionGroup labelId="appearance-theme" options={THEME_OPTIONS} value={theme} onChange={handleTheme} />
                </Section>

                <Section id="appearance-accent" title="Accent colour" sub="Colours buttons, links, the current page marker and the focus ring.">
                    <div className="ms-appearance__accents" role="group" aria-labelledby="appearance-accent">
                        {ACCENTS.map((key) => (
                            <button
                                key={key}
                                type="button"
                                className="ms-appearance__accent"
                                aria-pressed={accent === key}
                                onClick={() => handleAccent(key)}
                            >
                                <span className={`ms-appearance__swatch ms-appearance__swatch--${key}`} aria-hidden="true" />
                                <span>{ACCENT_LABELS[key]}</span>
                            </button>
                        ))}
                    </div>
                </Section>

                <Section id="appearance-density" title="Density" sub="Controls the spacing of rows, panels and controls.">
                    <OptionGroup labelId="appearance-density" options={DENSITY_OPTIONS} value={density} onChange={handleDensity} />
                </Section>

                <Section
                    id="appearance-motion"
                    title="Motion"
                    sub={`Defaults to your device setting, which is currently ${osReducesMotion ? "reduced" : "full"} motion.`}
                >
                    <OptionGroup labelId="appearance-motion" options={MOTION_OPTIONS} value={motion} onChange={handleMotion} />
                </Section>

                <Section id="appearance-preview" title="Preview" sub="The current palette, taken from the live colour tokens.">
                    <div className="ms-appearance__palette">
                        {PREVIEW_CHIPS.map((chip) => (
                            <div key={chip.key} className={`ms-appearance__chip ms-appearance__chip--${chip.key}`}>
                                {chip.label}
                            </div>
                        ))}
                    </div>
                    <div className="ms-appearance__sample">
                        <Button variant="primary">Primary</Button>
                        <Button>Secondary</Button>
                        <span className="ms-appearance__link">Accent link</span>
                    </div>
                </Section>
            </div>
        </section>
    );
}
