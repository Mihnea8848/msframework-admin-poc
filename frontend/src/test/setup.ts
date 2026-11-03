// Runs before every test file (see `test.setupFiles` in vite.config.js).
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Node 25+ has its own `localStorage` and `sessionStorage` globals, which are undefined unless
// Node runs with --localstorage-file, and Vitest does not replace globals that Node already
// defines. Always point them at jsdom's storage (without reading Node's getter, which warns)
// so tests get a working Storage on every Node version.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
if (dom) {
    for (const name of ["localStorage", "sessionStorage"] as const) {
        Object.defineProperty(globalThis, name, { get: () => dom.window[name], configurable: true });
    }
}

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
    cleanup();
});
