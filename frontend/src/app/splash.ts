/**
 * The start-up splash is plain HTML in index.html (#ms-splash, styled by app/splash.css), so
 * it shows from the first paint, before any JavaScript runs. React removes it once the first
 * /api/auth/me call has answered and the first page is ready (RootLayout.tsx).
 */
import "./splash.css";

export const SPLASH_ID = "ms-splash";

/** Fades the splash out and removes it. Safe to call more than once, or when there is none. */
export function hideSplash(doc: Document = document): void {
    const el = doc.getElementById(SPLASH_ID);
    if (!el || el.dataset.state === "done") return;
    el.dataset.state = "done";
    const remove = () => el.remove();
    el.addEventListener("transitionend", remove, { once: true });
    // transitionend never fires when the duration is 0 (reduced motion) or the tab is hidden.
    window.setTimeout(remove, 400);
}
