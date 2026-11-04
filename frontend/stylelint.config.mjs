/**
 * Stylelint configuration. A JS file rather than .stylelintrc.json so it can carry comments.
 *
 * Every CSS file under src/ is linted. On top of stylelint-config-standard:
 *   - colours come from tokens: no hex, no rgb()/hsl() and no named colours, except in
 *     src/styles/tokens/primitives.css, the one file that defines the raw palette;
 *   - selector-class-pattern: component classes are "ms-" prefixed, BEM style
 *     (ms-block, ms-block__element, ms-block--modifier).
 *
 * @type {import("stylelint").Config}
 */
export default {
  extends: ["stylelint-config-standard"],
  rules: {
    "color-no-hex": [true, { message: "Use a colour token; hex values belong in src/styles/tokens/primitives.css" }],
    "color-named": ["never", { message: "Use a colour token instead of a named colour" }],
    "function-disallowed-list": [
      ["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch"],
      { message: "Use a colour token; colour literals belong in src/styles/tokens/primitives.css" },
    ],
    "selector-class-pattern": [
      "^ms-[a-z0-9]+(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$",
      { message: (selector) => `Class "${selector}" must use the ms- prefix (ms-block__element--modifier)` },
    ],
  },
  overrides: [
    {
      files: ["src/styles/tokens/primitives.css"],
      rules: {
        "color-no-hex": null,
        "color-named": null,
        "function-disallowed-list": null,
        // Brand values are written out in full (#2EBFF6, #FFFFFF), as in the brand guide.
        "color-hex-length": "long",
      },
    },
  ],
};
