/**
 * Page transitions.
 *
 * When motion is on (`data-motion="full"` on <html>) and the browser has the View Transitions
 * API, navigation links pass react-router's `viewTransition` flag: the router wraps the update
 * in `document.startViewTransition`, and only <main> (view-transition-name: page) fades and
 * rises (shell/view-transitions.css). Everywhere else, and for navigations that did not use a
 * view transition, the shell replays a CSS enter animation on <main> instead (AppShell.tsx).
 * With reduced motion every duration token is 0, so both are instant.
 */

/** True when navigations should use a view transition right now. Read at click time. */
export function viewTransitionsEnabled(): boolean {
    if (typeof document === "undefined") return false;
    return document.documentElement.dataset.motion === "full" && typeof document.startViewTransition === "function";
}

let lastNavigationUsedViewTransition = false;

/** Called by the router subscriber (router.tsx) after every navigation. */
export function recordNavigation(usedViewTransition: boolean): void {
    lastNavigationUsedViewTransition = usedViewTransition && typeof document.startViewTransition === "function";
}

/** Whether the navigation that produced the current location ran as a view transition. */
export function lastNavigationWasViewTransition(): boolean {
    return lastNavigationUsedViewTransition;
}
