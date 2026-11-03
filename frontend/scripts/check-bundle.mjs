#!/usr/bin/env node
/**
 * Bundle size budget. Runs after `vite build` (it is part of `npm run build`) and fails the build
 * when the output in dist/ grows past a budget. Sizes are gzip (level 9), the way they travel.
 *
 *   entry JS      the script index.html loads, plus the chunks it imports statically
 *   CSS           every stylesheet in dist/, together
 *   page chunk    each lazy-loaded chunk (one per page, see src/app/pages.ts), on its own
 *   fonts         the latin .woff2 files, together (latin-ext is only fetched for those letters)
 *
 * Usage: node scripts/check-bundle.mjs [distDir]
 */
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const KB = 1024;
const BUDGETS = {
    entry: 130 * KB,
    css: 25 * KB,
    page: 40 * KB,
    fonts: 70 * KB,
};

const dist = path.resolve(process.argv[2] || "dist");
const assets = path.join(dist, "assets");
if (!fs.existsSync(path.join(dist, "index.html"))) {
    console.error(`check-bundle: ${dist}/index.html not found. Run vite build first.`);
    process.exit(1);
}

const gzipSize = (file) => gzipSync(fs.readFileSync(file), { level: 9 }).length;
const rel = (file) => path.relative(dist, file);
const fmt = (bytes) => `${(bytes / KB).toFixed(1)} kB`;

const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const entryScripts = [...html.matchAll(/<script[^>]+type="module"[^>]+src="\/?([^"]+)"/g)].map((m) => path.join(dist, m[1]));
const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/?([^"]+)"/g)].map((m) => path.join(dist, m[1]));

/** Static imports of a built chunk (`import ... from "./x.js"`), followed recursively. */
function staticGraph(start) {
    const seen = new Set();
    const queue = [...start];
    while (queue.length) {
        const file = queue.pop();
        if (seen.has(file) || !fs.existsSync(file)) continue;
        seen.add(file);
        const code = fs.readFileSync(file, "utf8");
        for (const m of code.matchAll(/(?:^|[;\s}])import\s*(?:[\w*{}\s,$]+from\s*)?["'](\.\/[^"']+\.js)["']/g)) {
            queue.push(path.join(path.dirname(file), m[1]));
        }
    }
    return seen;
}

const files = fs.readdirSync(assets).map((f) => path.join(assets, f));
const js = files.filter((f) => f.endsWith(".js"));
const entrySet = staticGraph([...entryScripts, ...preloads]);
const lazy = js.filter((f) => !entrySet.has(f));
const css = files.filter((f) => f.endsWith(".css"));
const fonts = files.filter((f) => f.endsWith(".woff2") && /-latin-(?!ext)/.test(path.basename(f)));

const rows = [];
let failed = false;
function check(label, detail, size, budget) {
    const ok = size <= budget;
    if (!ok) failed = true;
    rows.push([label, detail, fmt(size), fmt(budget), ok ? "ok" : "OVER"]);
}

const sum = (list) => list.reduce((n, f) => n + gzipSize(f), 0);
check("entry JS", [...entrySet].map(rel).join(", "), sum([...entrySet]), BUDGETS.entry);
check("CSS (all)", `${css.length} file(s)`, sum(css), BUDGETS.css);
check("fonts (latin woff2)", `${fonts.length} file(s)`, sum(fonts), BUDGETS.fonts);
for (const file of lazy.sort()) check("lazy chunk", rel(file), gzipSize(file), BUDGETS.page);

const head = ["Budget", "Files", "gzip", "Limit", ""];
const widths = head.map((h, i) => Math.min(60, Math.max(h.length, ...rows.map((r) => r[i].length))));
const line = (cells) => cells.map((c, i) => (c.length > widths[i] ? `${c.slice(0, widths[i] - 1)}…` : c.padEnd(widths[i]))).join("  ");
console.log(`\nBundle budget (${rel(dist) || "dist"}, gzip -9)`);
console.log(line(head));
console.log(widths.map((w) => "-".repeat(w)).join("  "));
for (const r of rows) console.log(line(r));

if (failed) {
    console.error("\ncheck-bundle: over budget. Split the code (lazy import) or raise the budget in scripts/check-bundle.mjs with a reason.");
    process.exit(1);
}
console.log("\ncheck-bundle: within budget.");
