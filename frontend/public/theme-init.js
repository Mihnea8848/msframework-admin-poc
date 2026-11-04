/*
 * Applies the saved appearance before the first paint, so there is no flash of the wrong
 * theme. Loaded with a blocking <script src> in index.html (an external file, so a strict
 * Content-Security-Policy does not need 'unsafe-inline').
 *
 * Sets on <html>:
 *   data-theme    dark | light   (the "system" preference is resolved; dark is the default)
 *   data-accent   cobalt | cyan | violet | jade | gold | silver   (cobalt is the default)
 *   data-density  comfortable | compact
 *   data-motion   full | reduced (the saved choice, otherwise the OS setting)
 *
 * It never sets colours as inline styles, because those would beat the token CSS.
 * Keep the keys and values in sync with src/theme/appearance.ts.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var ACCENTS = ["cobalt", "cyan", "violet", "jade", "gold", "silver"];

  function read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage unavailable (private mode, blocked): the choice only lasts for this page.
    }
  }

  function remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage unavailable: nothing to clean up.
    }
  }

  function matches(query) {
    try {
      return !!(window.matchMedia && window.matchMedia(query).matches);
    } catch {
      return false;
    }
  }

  // Before the Chevron design the accent was stored as a hex value ("accent") plus a label
  // ("accentLabel"). Map those to the new accent keys once, then remove them.
  var LEGACY_ACCENTS = {
    sky: "cyan",
    cyan: "cyan",
    violet: "violet",
    amber: "gold",
    "#28beef": "cyan",
    "#0078c8": "cyan",
    "#67e8f9": "cyan",
    "#0891b2": "cyan",
    "#a78bfa": "violet",
    "#6c32db": "violet",
    "#fbbf24": "gold",
    "#d97706": "gold"
  };

  function legacyAccent(label, hex) {
    var byLabel = label ? LEGACY_ACCENTS[String(label).toLowerCase()] : null;
    if (byLabel) return byLabel;
    var byHex = hex ? LEGACY_ACCENTS[String(hex).toLowerCase()] : null;
    return byHex || "cobalt";
  }

  function resolveTheme(preference) {
    if (preference === "light") return "light";
    if (preference === "system") return matches("(prefers-color-scheme: light)") ? "light" : "dark";
    return "dark";
  }

  function systemMotion() {
    return matches("(prefers-reduced-motion: reduce)") ? "reduced" : "full";
  }

  var oldLabel = read("accentLabel");
  var oldHex = read("accent");
  var accent = read("accentKey");
  if (ACCENTS.indexOf(accent) < 0) {
    if (oldLabel !== null || oldHex !== null) {
      accent = legacyAccent(oldLabel, oldHex);
      write("accentKey", accent);
    } else {
      accent = "cobalt";
    }
  }
  if (oldLabel !== null) remove("accentLabel");
  if (oldHex !== null) remove("accent");

  var density = read("density") === "compact" ? "compact" : "comfortable";
  var storedMotion = read("motion");
  var motion = storedMotion === "full" || storedMotion === "reduced" ? storedMotion : systemMotion();

  root.setAttribute("data-theme", resolveTheme(read("theme")));
  root.setAttribute("data-accent", accent);
  root.setAttribute("data-density", density);
  root.setAttribute("data-motion", motion);

  // Follow the OS while the user has chosen "system" (theme) or has not chosen (motion).
  function listen(query, onChange) {
    try {
      var list = window.matchMedia && window.matchMedia(query);
      if (!list) return;
      if (list.addEventListener) list.addEventListener("change", onChange);
      else if (list.addListener) list.addListener(onChange);
    } catch {
      // matchMedia unavailable: keep the values set above.
    }
  }

  listen("(prefers-color-scheme: light)", function () {
    if (read("theme") === "system") root.setAttribute("data-theme", resolveTheme("system"));
  });
  listen("(prefers-reduced-motion: reduce)", function () {
    var saved = read("motion");
    if (saved !== "full" && saved !== "reduced") root.setAttribute("data-motion", systemMotion());
  });
})();
