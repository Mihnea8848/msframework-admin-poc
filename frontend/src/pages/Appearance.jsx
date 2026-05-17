import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

const ACCENTS = [
    { label: "Lime", dark: "#d2ff72", light: "#7ab800" },
    { label: "Sky", dark: "#28beef", light: "#0078c8" },
    { label: "Violet", dark: "#a78bfa", light: "#6c32db" },
    { label: "Rose", dark: "#fb7185", light: "#cb3a77" },
    { label: "Amber", dark: "#fbbf24", light: "#d97706" },
    { label: "Cyan", dark: "#67e8f9", light: "#0891b2" },
];

function getStoredTheme() {
    return localStorage.getItem("theme") || "dark";
}

function getStoredAccentLabel() {
    return localStorage.getItem("accentLabel") || "Lime";
}

function getStoredDensity() {
    return localStorage.getItem("density") || "comfortable";
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
}

function applyAccent(accent, theme) {
    const val = theme === "light" ? accent.light : accent.dark;
    document.documentElement.style.setProperty("--accent", val);
    localStorage.setItem("accent", val);
    localStorage.setItem("accentLabel", accent.label);
}

function applyDensity(density) {
    document.documentElement.dataset.density = density;
    localStorage.setItem("density", density);
}

export default function Appearance() {
    const [theme, setTheme] = useState(getStoredTheme);
    const [accentLabel, setAccentLabel] = useState(getStoredAccentLabel);
    const [density, setDensity] = useState(getStoredDensity);

    function handleTheme(t) {
        setTheme(t);
        applyTheme(t);
        const acc = ACCENTS.find((a) => a.label === accentLabel) || ACCENTS[0];
        applyAccent(acc, t);
    }

    function handleAccent(acc) {
        setAccentLabel(acc.label);
        applyAccent(acc, theme);
    }

    function handleDensity(d) {
        setDensity(d);
        applyDensity(d);
    }

    useEffect(() => {
        applyDensity(density);
    }, [density]);

    const currentAccent = ACCENTS.find((a) => a.label === accentLabel) || ACCENTS[0];
    const previewAccent = theme === "light" ? currentAccent.light : currentAccent.dark;

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">General / Appearance</div>
                    <div className="workspace-title-row">
                        <h1>Appearance</h1>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        Personalise the look and feel. Changes are saved automatically.
                    </p>
                </div>
            </div>

            {/* Theme */}
            <div className="appearance-section">
                <div className="appearance-section-title">Theme</div>
                <div className="appearance-section-sub">Choose between dark and light mode.</div>
                <div className="theme-toggle-row">
                    <button
                        type="button"
                        className={`theme-option${theme === "dark" ? " selected" : ""}`}
                        onClick={() => handleTheme("dark")}
                    >
                        <Moon size={20} />
                        Dark
                    </button>
                    <button
                        type="button"
                        className={`theme-option${theme === "light" ? " selected" : ""}`}
                        onClick={() => handleTheme("light")}
                    >
                        <Sun size={20} />
                        Light
                    </button>
                </div>
            </div>

            {/* Accent colour */}
            <div className="appearance-section">
                <div className="appearance-section-title">Accent Colour</div>
                <div className="appearance-section-sub">Sets the primary highlight colour throughout the UI.</div>
                <div className="accent-swatches">
                    {ACCENTS.map((acc) => (
                        <button
                            key={acc.label}
                            type="button"
                            className={`accent-swatch${accentLabel === acc.label ? " selected" : ""}`}
                            style={{ background: theme === "light" ? acc.light : acc.dark }}
                            title={acc.label}
                            onClick={() => handleAccent(acc)}
                        />
                    ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                    Selected: <strong style={{ color: "var(--text)" }}>{accentLabel}</strong>
                </div>
            </div>

            {/* Density */}
            <div className="appearance-section">
                <div className="appearance-section-title">Density</div>
                <div className="appearance-section-sub">Control the spacing of UI elements.</div>
                <div className="density-row">
                    {["comfortable", "compact"].map((d) => (
                        <button
                            key={d}
                            type="button"
                            className={`density-option${density === d ? " selected" : ""}`}
                            onClick={() => handleDensity(d)}
                        >
                            {d.charAt(0).toUpperCase() + d.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Live preview */}
            <div className="appearance-section">
                <div className="appearance-section-title">Preview</div>
                <div className="appearance-section-sub">A preview of the current palette.</div>
                <div className="preview-palette">
                    {[
                        { label: "BG", bg: "var(--bg)" },
                        { label: "Panel", bg: "var(--panel)" },
                        { label: "Accent", bg: previewAccent },
                        { label: "Success", bg: "var(--success)" },
                        { label: "Danger", bg: "var(--danger)" },
                        { label: "Muted", bg: "var(--muted)" },
                    ].map((chip) => (
                        <div key={chip.label} className="palette-chip" style={{ background: chip.bg }}>
                            <span className="palette-chip-label" style={{ color: chip.label === "BG" || chip.label === "Panel" ? "var(--muted)" : "#fff" }}>
                                {chip.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
