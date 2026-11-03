/**
 * Stylelint configuration. A JS file rather than .stylelintrc.json so it can carry comments.
 *
 * The legacy stylesheets in `ignoreFiles` are not linted yet. The new token and component CSS
 * added in the next PR (F2) is linted, with two extra rules:
 *   - selector-class-pattern: new classes are prefixed with "ms-";
 *   - color-no-hex: colours come from tokens, except in src/styles/tokens/primitives.css.
 * The legacy files leave this list when the cleanup PR (F10) deletes or rewrites them.
 *
 * @type {import("stylelint").Config}
 */
export default {
  extends: ["stylelint-config-standard"],
  ignoreFiles: [
    "src/styles/theme.css",
    "src/index.css",
    "src/App.css",
  ],
};
