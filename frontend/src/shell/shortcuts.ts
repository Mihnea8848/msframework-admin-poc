/** True on macOS and iOS, where the Quick Actions shortcut is Cmd+K. */
export function isApplePlatform(): boolean {
    if (typeof navigator === "undefined") return false;
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
        || navigator.platform
        || navigator.userAgent;
    return /mac|iphone|ipad|ipod/i.test(platform);
}

/** The key hint shown next to Quick actions. */
export function shortcutLabel(): string {
    return isApplePlatform() ? "⌘K" : "Ctrl K";
}

/** Inputs where "/" is typed, not a shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Cmd/Ctrl+K anywhere, or "/" outside a text field, opens Quick Actions. */
export function isQuickActionsShortcut(e: KeyboardEvent): boolean {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") return true;
    return e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target);
}
