import { describe, expect, it } from "vitest";
import { parseUserAgent } from "./userAgent";

const UA = {
    chromeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    edgeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.68",
    firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
    safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
    safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    chromeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
    safariIpad: "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
    chromeAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    androidTablet: "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    samsung: "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
    operaMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0",
    chromebook: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    headless: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
    curl: "curl/8.10.1",
};

describe("parseUserAgent", () => {
    it.each([
        [UA.chromeWindows, "Chrome", "Windows", "desktop", "Chrome on Windows"],
        [UA.edgeWindows, "Edge", "Windows", "desktop", "Edge on Windows"],
        [UA.firefoxLinux, "Firefox", "Linux", "desktop", "Firefox on Linux"],
        [UA.safariMac, "Safari", "macOS", "desktop", "Safari on macOS"],
        [UA.safariIphone, "Safari", "iOS", "mobile", "Safari on iPhone"],
        [UA.chromeIphone, "Chrome", "iOS", "mobile", "Chrome on iPhone"],
        [UA.safariIpad, "Safari", "iPadOS", "tablet", "Safari on iPad"],
        [UA.chromeAndroid, "Chrome", "Android", "mobile", "Chrome on Android phone"],
        [UA.androidTablet, "Chrome", "Android", "tablet", "Chrome on Android tablet"],
        [UA.samsung, "Samsung Internet", "Android", "mobile", "Samsung Internet on Android phone"],
        [UA.operaMac, "Opera", "macOS", "desktop", "Opera on macOS"],
        [UA.chromebook, "Chrome", "ChromeOS", "desktop", "Chrome on ChromeOS"],
        [UA.headless, "Headless Chrome", "Linux", "desktop", "Headless Chrome on Linux"],
    ])("reads %s", (ua, browser, os, device, label) => {
        expect(parseUserAgent(ua)).toEqual({ browser, os, device, label });
    });

    it("names command-line clients without an operating system", () => {
        expect(parseUserAgent(UA.curl)).toEqual({ browser: "curl", os: null, device: "unknown", label: "curl" });
    });

    it("says so when there is nothing to read", () => {
        for (const ua of [null, undefined, "", "   "]) {
            expect(parseUserAgent(ua)).toEqual({ browser: null, os: null, device: "unknown", label: "Unknown device" });
        }
    });

    it("falls back to the platform when the browser is unknown", () => {
        expect(parseUserAgent("SomeApp/1.0 (Windows NT 10.0)").label).toBe("Browser on Windows");
        expect(parseUserAgent("SomeApp/1.0").label).toBe("Unknown device");
    });
});
