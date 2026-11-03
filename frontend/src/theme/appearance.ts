/**
 * Appearance preferences: theme, accent, density and motion. They are stored in localStorage
 * and applied as data-* attributes on <html>, where the token CSS (src/styles/tokens) picks
 * them up. Never set colours as inline styles: they would beat the tokens.
 *
 * public/theme-init.js applies the same preferences before the first paint. Keep the keys,
 * values and defaults here in sync with it.
 */
import { readStorage, writeStorage } from "../utils/storage";

export const THEMES = ["dark", "light", "system"] as const;
export const ACCENTS = ["cyan", "cobalt", "violet", "jade", "gold", "silver"] as const;
export const DENSITIES = ["comfortable", "compact"] as const;
export const MOTIONS = ["full", "reduced"] as const;

export type ThemePreference = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;
export type AccentKey = (typeof ACCENTS)[number];
export type Density = (typeof DENSITIES)[number];
export type Motion = (typeof MOTIONS)[number];

/** localStorage keys */
export const STORAGE_KEYS = {
    theme: "theme",
    accent: "accentKey",
    density: "density",
    motion: "motion",
} as const;

export const DEFAULT_THEME: ThemePreference = "dark";
export const DEFAULT_ACCENT: AccentKey = "cyan";
export const DEFAULT_DENSITY: Density = "comfortable";

export const ACCENT_LABELS: Record<AccentKey, string> = {
    cyan: "Cyan",
    cobalt: "Cobalt",
    violet: "Violet",
    jade: "Jade",
    gold: "Gold",
    silver: "Silver",
};

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
    return typeof value === "string" && (list as readonly string[]).includes(value);
}

function mediaMatches(query: string): boolean {
    try {
        return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
    } catch {
        return false;
    }
}

export function systemPrefersLight(): boolean {
    return mediaMatches("(prefers-color-scheme: light)");
}

export function systemPrefersReducedMotion(): boolean {
    return mediaMatches("(prefers-reduced-motion: reduce)");
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
    if (preference === "system") return systemPrefersLight() ? "light" : "dark";
    return preference;
}

export function readThemePreference(): ThemePreference {
    const value = readStorage(STORAGE_KEYS.theme);
    return isOneOf(THEMES, value) ? value : DEFAULT_THEME;
}

export function readAccent(): AccentKey {
    const value = readStorage(STORAGE_KEYS.accent);
    return isOneOf(ACCENTS, value) ? value : DEFAULT_ACCENT;
}

export function readDensity(): Density {
    const value = readStorage(STORAGE_KEYS.density);
    return isOneOf(DENSITIES, value) ? value : DEFAULT_DENSITY;
}

/** The stored motion choice, or the OS setting when the user has not chosen. */
export function readMotion(): Motion {
    const value = readStorage(STORAGE_KEYS.motion);
    if (isOneOf(MOTIONS, value)) return value;
    return systemPrefersReducedMotion() ? "reduced" : "full";
}

function root(): HTMLElement {
    return document.documentElement;
}

export function setThemePreference(preference: ThemePreference): void {
    writeStorage(STORAGE_KEYS.theme, preference);
    root().dataset.theme = resolveTheme(preference);
}

export function setAccent(accent: AccentKey): void {
    writeStorage(STORAGE_KEYS.accent, accent);
    root().dataset.accent = accent;
}

export function setDensity(density: Density): void {
    writeStorage(STORAGE_KEYS.density, density);
    root().dataset.density = density;
}

export function setMotion(motion: Motion): void {
    writeStorage(STORAGE_KEYS.motion, motion);
    root().dataset.motion = motion;
}
