/**
 * WCAG contrast check for the colour tokens. It reads the token CSS, resolves the var() chains
 * for every theme x accent and theme x seal, and fails (and with it CI) when a pair falls
 * short: 4.5:1 for text, 3:1 for the focus ring, control borders and seal outlines.
 *
 * The parser is deliberately small. The colour token files are flat lists of
 * `selector { --name: value; }` blocks with selectors built from :root and [data-x="y"];
 * anything else makes the test fail loudly instead of being misread.
 */
import { describe, expect, it } from "vitest";
import primitivesCss from "./primitives.css?raw";
import semanticDarkCss from "./semantic-dark.css?raw";
import semanticLightCss from "./semantic-light.css?raw";
import accentsCss from "./accents.css?raw";
import sealsCss from "./seals.css?raw";

const THEMES = ["dark", "light"] as const;
const ACCENTS = ["cyan", "cobalt", "violet", "jade", "gold", "silver"] as const;
const SEALS = [
    "administration",
    "development",
    "quality-control",
    "external-affairs",
    "human-resources",
    "ethics-regulations",
    "engineering-innovation",
    "director",
] as const;

const TEXT = 4.5;
const NON_TEXT = 3;

/** Surfaces that text and controls sit on. */
const SURFACES = ["--canvas", "--surface-1", "--surface-2", "--surface-3", "--field"];

type Context = Record<string, string>;
type Rule = { attrs: Context; specificity: number; order: number; decls: Record<string, string> };
type Rgba = { r: number; g: number; b: number; a: number };

// ---- Parsing ---------------------------------------------------------------------------

const SELECTOR = /^(:root)?((?:\[data-[a-z-]+="[a-z-]+"\])*)$/;
const ATTRIBUTE = /\[data-([a-z-]+)="([a-z-]+)"\]/g;

function parseRules(css: string, file: string, start: number): Rule[] {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
    if (source.includes("@")) throw new Error(`${file}: at-rules are not supported in colour token files`);
    const rules: Rule[] = [];
    const block = /([^{}]+)\{([^{}]*)\}/g;
    let match: RegExpExecArray | null;
    let order = start;
    while ((match = block.exec(source)) !== null) {
        const decls: Record<string, string> = {};
        for (const line of (match[2] ?? "").split(";")) {
            const colon = line.indexOf(":");
            if (colon < 0) continue;
            const name = line.slice(0, colon).trim();
            if (name.startsWith("--")) decls[name] = line.slice(colon + 1).trim();
        }
        for (const raw of (match[1] ?? "").split(",")) {
            const selector = raw.trim();
            const parts = SELECTOR.exec(selector);
            if (!parts || selector === "") throw new Error(`${file}: unsupported selector "${selector}"`);
            const attrs: Context = {};
            for (const [, key, value] of (parts[2] ?? "").matchAll(ATTRIBUTE)) attrs[key as string] = value as string;
            const specificity = (parts[1] ? 1 : 0) + Object.keys(attrs).length;
            rules.push({ attrs, specificity, order: order++, decls });
        }
    }
    return rules;
}

const RULES = [
    ["primitives.css", primitivesCss],
    ["semantic-dark.css", semanticDarkCss],
    ["semantic-light.css", semanticLightCss],
    ["accents.css", accentsCss],
    ["seals.css", sealsCss],
].reduce<Rule[]>((all, [file, css]) => all.concat(parseRules(css as string, file as string, all.length)), []);

/** The custom properties in effect for an element with these data-* attributes. */
function tokensFor(context: Context): Record<string, string> {
    const applicable = RULES.filter((rule) => Object.entries(rule.attrs).every(([k, v]) => context[k] === v));
    applicable.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
    return Object.assign({}, ...applicable.map((rule) => rule.decls));
}

function resolve(tokens: Record<string, string>, name: string, seen: string[] = []): string {
    if (seen.includes(name)) throw new Error(`var() cycle: ${[...seen, name].join(" -> ")}`);
    const value = tokens[name];
    if (value === undefined) throw new Error(`${name} is not defined`);
    return value.replace(/var\((--[a-z0-9-]+)\)/g, (_, ref: string) => resolve(tokens, ref, [...seen, name]));
}

function parseColor(value: string, name: string): Rgba {
    const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
    if (hex) {
        const n = parseInt(hex[1] as string, 16);
        const a = hex[2] ? parseInt(hex[2], 16) / 255 : 1;
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
    }
    const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+)(%?))?\s*\)$/.exec(value);
    if (rgb) {
        const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]) / (rgb[5] ? 100 : 1);
        return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: alpha };
    }
    throw new Error(`${name} resolves to "${value}", which this test cannot measure`);
}

// ---- Contrast --------------------------------------------------------------------------

function over(top: Rgba, bottom: Rgba): Rgba {
    const mix = (t: number, b: number) => t * top.a + b * (1 - top.a);
    return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

function luminance({ r, g, b }: Rgba): number {
    const channel = (c: number) => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(tokens: Record<string, string>, fg: string, bg: string): number {
    const canvas = parseColor(resolve(tokens, "--canvas"), "--canvas");
    const background = over(parseColor(resolve(tokens, bg), bg), canvas);
    const foreground = over(parseColor(resolve(tokens, fg), fg), background);
    const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [number, number];
    return (light + 0.05) / (dark + 0.05);
}

type Pair = [fg: string, bg: string, min: number];

/** Every pair below its minimum, as readable lines. */
function failures(context: Context, pairs: Pair[]): string[] {
    const tokens = tokensFor(context);
    return pairs
        .map(([fg, bg, min]) => ({ fg, bg, min, ratio: contrast(tokens, fg, bg) }))
        .filter(({ ratio, min }) => ratio < min)
        .map(({ fg, bg, min, ratio }) => `${fg} on ${bg}: ${ratio.toFixed(2)}:1, needs ${min}:1`);
}

const on = (fgs: string[], bgs: string[], min: number): Pair[] =>
    fgs.flatMap((fg) => bgs.map((bg): Pair => [fg, bg, min]));

// ---- Pairs -----------------------------------------------------------------------------

const THEME_ACCENT_PAIRS: Record<string, Pair[]> = {
    "text on surfaces": on(["--text-primary", "--text-secondary", "--text-tertiary"], SURFACES, TEXT),
    "status text on surfaces": on(
        ["--status-ok-fg", "--status-warn-fg", "--status-danger-fg", "--status-info-fg"],
        SURFACES,
        TEXT,
    ),
    "on-primary on primary": [
        ["--on-primary", "--primary", TEXT],
        ["--on-primary", "--primary-hover", TEXT],
        ["--on-danger", "--danger-solid", TEXT],
        ["--on-danger", "--danger-solid-hover", TEXT],
    ],
    "accent text on surfaces": on(["--accent-text"], SURFACES, TEXT),
    "focus ring and control borders": on(["--focus-ring", "--border-control"], SURFACES, NON_TEXT),
};

const THEME_SEAL_PAIRS: Record<string, Pair[]> = {
    "seal text on surfaces": on(["--seal-text"], SURFACES, TEXT),
    "seal outline on surfaces": on(["--seal-border"], SURFACES, NON_TEXT),
    "seal glyph on its fill": [["--seal-fg", "--seal", NON_TEXT]],
};

// ---- Tests -----------------------------------------------------------------------------

describe("token contrast", () => {
    describe.each(THEMES)("%s theme", (theme) => {
        describe.each(ACCENTS)("accent %s", (accent) => {
            it.each(Object.keys(THEME_ACCENT_PAIRS))("%s", (group) => {
                expect(failures({ theme, accent }, THEME_ACCENT_PAIRS[group] ?? [])).toEqual([]);
            });
        });

        describe.each(SEALS)("seal %s", (seal) => {
            it.each(Object.keys(THEME_SEAL_PAIRS))("%s", (group) => {
                expect(failures({ theme, seal }, THEME_SEAL_PAIRS[group] ?? [])).toEqual([]);
            });
        });
    });

    it("measures a known pair correctly (white on black is 21:1)", () => {
        const tokens = { "--canvas": "#000000", "--a": "#FFFFFF", "--b": "var(--canvas)" };
        expect(contrast(tokens, "--a", "--b")).toBeCloseTo(21, 5);
    });

    it("composites translucent text over its surface", () => {
        const tokens = { "--canvas": "#000000", "--half": "rgb(255 255 255 / 50%)", "--bg": "#000000" };
        // 50% white over black is about #808080 (4.0:1 against black, after gamma)
        expect(contrast(tokens, "--half", "--bg")).toBeGreaterThan(3.9);
        expect(contrast(tokens, "--half", "--bg")).toBeLessThan(5.4);
    });

    it("reads every theme, accent and seal from the token files", () => {
        for (const theme of THEMES) {
            for (const accent of ACCENTS) {
                expect(resolve(tokensFor({ theme, accent }), "--accent-text")).toMatch(/^#/);
            }
            for (const seal of SEALS) {
                expect(resolve(tokensFor({ theme, seal }), "--seal-text")).toMatch(/^#/);
            }
        }
    });
});
