import type { ComponentType } from "react";
import type { PageKey } from "../routes/navigation";

type PageModule = { default: ComponentType };
type PageLoader = () => Promise<PageModule>;

/** A page with its own chunk: every sidebar page, plus Settings (one chunk for all its tabs). */
export type LoaderKey = PageKey | "settings";

/**
 * The code of every page inside the shell. Each `import()` is its own chunk, loaded by the
 * router when the page is first opened (see routes.tsx) and prefetched before that: when its
 * navigation link is hovered or focused, and for all permitted pages once the browser is idle.
 *
 * Calling a loader twice is free: the browser keeps the module after the first import.
 */
export const PAGE_LOADERS: Record<LoaderKey, PageLoader> = {
    home: () => import("../pages/HomePage"),
    dashboard: () => import("../pages/dashboard/Dashboard"),
    activity: () => import("../pages/Notifications"),
    // The audit log is the same feed as Activity for now, under its own title (same chunk).
    audit: () => import("../pages/Notifications").then((m) => ({ default: m.AuditLog })),
    users: () => import("../pages/UserManagement"),
    departments: () => import("../pages/Departments"),
    payments: () => import("../pages/Payments"),
    import: () => import("../pages/ImportData"),
    export: () => import("../pages/ExportData"),
    database: () => import("../pages/DatabasePage"),
    connections: () => import("../pages/Connections"),
    security: () => import("../pages/Security"),
    timezones: () => import("../pages/Timezones"),
    docs: () => import("../pages/Documentation"),
    settings: () => import("../pages/settings/Settings"),
};

const requested = new Set<LoaderKey>();

/** Starts loading a page's chunk, once. Failures are ignored: the router retries on navigation. */
export function prefetchPage(key: LoaderKey): void {
    if (requested.has(key)) return;
    requested.add(key);
    PAGE_LOADERS[key]().catch(() => requested.delete(key));
}

type IdleWindow = Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
};

/** Runs `cb` when the browser is idle (`requestIdleCallback`, or a short timeout where it is missing). */
export function whenIdle(cb: () => void): () => void {
    const w = window as IdleWindow;
    if (w.requestIdleCallback && w.cancelIdleCallback) {
        const id = w.requestIdleCallback(cb, { timeout: 4000 });
        return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(cb, 200);
    return () => window.clearTimeout(id);
}

/**
 * Prefetches the given pages one at a time, each in its own idle period, so prefetching never
 * competes with the page the user is looking at. Returns a function that stops it.
 */
export function prefetchWhenIdle(keys: readonly LoaderKey[]): () => void {
    const queue = keys.filter((k) => !requested.has(k));
    let cancel: () => void = () => {};
    const next = () => {
        const key = queue.shift();
        if (!key) return;
        cancel = whenIdle(() => {
            prefetchPage(key);
            next();
        });
    };
    next();
    return () => cancel();
}
