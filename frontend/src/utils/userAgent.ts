/**
 * A small User-Agent parser for the Sessions page: just enough to tell a person which browser
 * and device a session belongs to ("Firefox on Windows"). It is a hint, never a security
 * decision: any client can send any User-Agent.
 */

export type DeviceKind = "desktop" | "mobile" | "tablet" | "unknown";

export interface ParsedUserAgent {
    /** "Chrome", "Firefox", "Safari", "Edge", "Opera", "Samsung Internet", "curl", ... or null. */
    browser: string | null;
    /** "Windows", "macOS", "Linux", "Android", "iOS", "iPadOS", "ChromeOS", ... or null. */
    os: string | null;
    device: DeviceKind;
    /** One line for people: "Chrome on Windows", "Safari on iPhone", "Unknown device". */
    label: string;
}

/** Checked in order: Edge and Opera also say "Chrome", and Chrome also says "Safari". */
const BROWSERS: readonly [RegExp, string][] = [
    [/\bEdg(?:e|A|iOS)?\//, "Edge"],
    [/\b(?:OPR|Opera)\//, "Opera"],
    [/\bSamsungBrowser\//, "Samsung Internet"],
    [/\bVivaldi\//, "Vivaldi"],
    [/\bYaBrowser\//, "Yandex"],
    [/\b(?:Firefox|FxiOS)\//, "Firefox"],
    [/\b(?:Chrome|CriOS|Chromium)\//, "Chrome"],
    [/\bVersion\/[\d.]+.*\bSafari\//, "Safari"],
    [/\bcurl\//, "curl"],
    [/\bPostmanRuntime\//, "Postman"],
];

function browserOf(ua: string): string | null {
    // Automated browsers (screenshots, tests) are worth recognising.
    if (/\bHeadlessChrome\//.test(ua)) return "Headless Chrome";
    return BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
}

function osOf(ua: string): string | null {
    if (/\biPad\b/.test(ua)) return "iPadOS";
    if (/\b(?:iPhone|iPod)\b/.test(ua)) return "iOS";
    if (/\bAndroid\b/.test(ua)) return "Android";
    if (/\bCrOS\b/.test(ua)) return "ChromeOS";
    if (/\bWindows\b/.test(ua)) return "Windows";
    if (/\bMac OS X\b|\bMacintosh\b/.test(ua)) return "macOS";
    if (/\bLinux\b|\bX11\b/.test(ua)) return "Linux";
    return null;
}

function deviceOf(ua: string, os: string | null): DeviceKind {
    if (/\biPad\b|\bTablet\b/.test(ua) || (os === "Android" && !/\bMobile\b/.test(ua))) return "tablet";
    if (/\bMobi(?:le)?\b|\biPhone\b|\biPod\b/.test(ua)) return "mobile";
    if (os) return "desktop";
    return "unknown";
}

/** Where the label says "on ...": the phone's name reads better than its OS. */
function placeOf(ua: string, os: string | null, device: DeviceKind): string | null {
    if (/\biPhone\b/.test(ua)) return "iPhone";
    if (/\biPad\b/.test(ua)) return "iPad";
    if (os === "Android") return device === "tablet" ? "Android tablet" : "Android phone";
    return os;
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
    const ua = (userAgent ?? "").trim();
    if (!ua) return { browser: null, os: null, device: "unknown", label: "Unknown device" };

    const browser = browserOf(ua);
    const os = osOf(ua);
    const device = deviceOf(ua, os);
    const place = placeOf(ua, os, device);

    let label: string;
    if (browser && place) label = `${browser} on ${place}`;
    else if (browser) label = browser;
    else if (place) label = `Browser on ${place}`;
    else label = "Unknown device";

    return { browser, os, device, label };
}
