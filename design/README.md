# Design reference

`concept-chevron.html` is the client-approved visual reference for MSFramework: **Concept C, Chevron** (version 4). It is a self-contained prototype with sample data and no backend; open it in a browser and use the bar at the top to switch screens (Login, Dashboard, Users, Departments), theme and device width.

It is the source of truth for the design tokens, type, shapes and the login layout. The tokens in `frontend/src/styles/tokens/` are mapped from its `:root` blocks.

What the client decided:

- **Kept:** the Chevron mark and notch, clipped corners, Montserrat uppercase labels, the department seal badges, the login layout with the grainy gradient logo, and the logo trace animation on login.
- **Rejected:** wipe transitions between screens, and the three-stripe band on the sidebar edge. Do not carry these into the app.
- **Brand name:** "Multimedia Entertainment Hub" in UI text; "MEH Studios Inc" as the narrow sidebar sub-label. The product stays MSFramework, and examples keep the `mehstudios.net` domain.
- **Background:** the dark page background is `#171717`.

The prototype loads Google Fonts and a CDN icon script for convenience. The app does not: its fonts are self-hosted (see `AGENTS.md`).
