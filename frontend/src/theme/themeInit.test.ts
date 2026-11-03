import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import themeInitSource from "../../public/theme-init.js?raw";
import {
    readMotion,
    readThemePreference,
    resolveTheme,
    setAccent,
    setDensity,
    setMotion,
    setThemePreference,
} from "./appearance";

const root = document.documentElement;
const ATTRIBUTES = ["data-theme", "data-accent", "data-density", "data-motion", "style"];

/** Pretend the OS reports these media queries as matching. */
function stubMedia(matching: string[]) {
    vi.stubGlobal("matchMedia", (query: string) => ({
        matches: matching.includes(query),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    }));
}

function runThemeInit() {
    new Function(themeInitSource)();
}

function attrs() {
    return {
        theme: root.getAttribute("data-theme"),
        accent: root.getAttribute("data-accent"),
        density: root.getAttribute("data-density"),
        motion: root.getAttribute("data-motion"),
    };
}

beforeEach(() => {
    window.localStorage.clear();
    ATTRIBUTES.forEach((name) => root.removeAttribute(name));
    stubMedia([]);
});

afterEach(() => {
    window.localStorage.clear();
    ATTRIBUTES.forEach((name) => root.removeAttribute(name));
});

describe("public/theme-init.js", () => {
    it("defaults to dark, cyan, comfortable and full motion", () => {
        runThemeInit();
        expect(attrs()).toEqual({ theme: "dark", accent: "cyan", density: "comfortable", motion: "full" });
    });

    it("applies the saved preferences", () => {
        window.localStorage.setItem("theme", "light");
        window.localStorage.setItem("accentKey", "jade");
        window.localStorage.setItem("density", "compact");
        window.localStorage.setItem("motion", "reduced");
        runThemeInit();
        expect(attrs()).toEqual({ theme: "light", accent: "jade", density: "compact", motion: "reduced" });
    });

    it("resolves the system theme with matchMedia", () => {
        window.localStorage.setItem("theme", "system");
        stubMedia(["(prefers-color-scheme: light)"]);
        runThemeInit();
        expect(attrs().theme).toBe("light");

        stubMedia([]);
        runThemeInit();
        expect(attrs().theme).toBe("dark");
    });

    it("follows the OS motion setting until the user chooses", () => {
        stubMedia(["(prefers-reduced-motion: reduce)"]);
        runThemeInit();
        expect(attrs().motion).toBe("reduced");

        window.localStorage.setItem("motion", "full");
        runThemeInit();
        expect(attrs().motion).toBe("full");
    });

    it("ignores unknown stored values", () => {
        window.localStorage.setItem("theme", "sepia");
        window.localStorage.setItem("accentKey", "lime");
        window.localStorage.setItem("density", "tiny");
        window.localStorage.setItem("motion", "slow");
        runThemeInit();
        expect(attrs()).toEqual({ theme: "dark", accent: "cyan", density: "comfortable", motion: "full" });
    });

    it.each([
        ["Sky", "#28beef", "cyan"],
        ["Cyan", "#67e8f9", "cyan"],
        ["Violet", "#a78bfa", "violet"],
        ["Amber", "#d97706", "gold"],
        ["Lime", "#d2ff72", "cyan"],
        ["Rose", "#fb7185", "cyan"],
        [null, "#6c32db", "violet"],
        [null, "#123456", "cyan"],
    ])("migrates the old accent %s / %s to %s and removes the old keys", (label, hex, expected) => {
        if (label) window.localStorage.setItem("accentLabel", label);
        window.localStorage.setItem("accent", hex);
        runThemeInit();
        expect(attrs().accent).toBe(expected);
        expect(window.localStorage.getItem("accentKey")).toBe(expected);
        expect(window.localStorage.getItem("accent")).toBeNull();
        expect(window.localStorage.getItem("accentLabel")).toBeNull();
    });

    it("keeps a valid new accent and still removes the old keys", () => {
        window.localStorage.setItem("accentKey", "gold");
        window.localStorage.setItem("accentLabel", "Violet");
        window.localStorage.setItem("accent", "#a78bfa");
        runThemeInit();
        expect(attrs().accent).toBe("gold");
        expect(window.localStorage.getItem("accent")).toBeNull();
    });

    it("never sets inline styles, which would beat the tokens", () => {
        window.localStorage.setItem("accent", "#d2ff72");
        runThemeInit();
        expect(root.getAttribute("style")).toBeNull();
    });

    it("still sets every attribute when storage throws", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("denied");
        });
        vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
            throw new Error("denied");
        });
        expect(runThemeInit).not.toThrow();
        expect(attrs()).toEqual({ theme: "dark", accent: "cyan", density: "comfortable", motion: "full" });
    });
});

describe("theme/appearance", () => {
    it("writes the new keys and updates <html> at once", () => {
        setThemePreference("light");
        setAccent("violet");
        setDensity("compact");
        setMotion("reduced");
        expect(attrs()).toEqual({ theme: "light", accent: "violet", density: "compact", motion: "reduced" });
        expect(window.localStorage.getItem("theme")).toBe("light");
        expect(window.localStorage.getItem("accentKey")).toBe("violet");
        expect(window.localStorage.getItem("density")).toBe("compact");
        expect(window.localStorage.getItem("motion")).toBe("reduced");
    });

    it("stores the system preference but sets the resolved theme", () => {
        stubMedia(["(prefers-color-scheme: light)"]);
        setThemePreference("system");
        expect(readThemePreference()).toBe("system");
        expect(attrs().theme).toBe("light");
        expect(resolveTheme("system")).toBe("light");
    });

    it("reads the OS motion setting when nothing is stored", () => {
        stubMedia(["(prefers-reduced-motion: reduce)"]);
        expect(readMotion()).toBe("reduced");
    });
});
