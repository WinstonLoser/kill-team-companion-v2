# Kill Team Companion — Design System

## What this is
An **original** visual identity and component kit for **Kill Team Companion**, a fan-made companion app for the Warhammer 40,000: Kill Team tabletop skirmish game (roster tracking, mission/objective tracking, dice resolution, battle logging).

This is **not** an extraction of Games Workshop's Warhammer Community or warhammer.com branding. Those sites are proprietary — their logos, the Kill Team wordmark/emblem, exact color values, and page layouts belong to Games Workshop and were not copied. Two reference screenshots were reviewed for high-level genre cues only:
- `uploads/screencapture-warhammer-community-en-gb-downloads-kill-team-*.png` — Warhammer Community downloads page
- `uploads/screencapture-warhammer-en-CA-other-games-kill-team-LP-*.png` — warhammer.com Kill Team landing page

From those, this system takes only generic, non-proprietary genre cues (dark battlefield-report UI, condensed military type, warm accent-on-black) and builds an original rust/gunmetal identity, original type pairing (Google Fonts), original components, and no copied logos or art.

## No logo provided
No usable brand mark exists in the source material (the screenshots show Games Workshop's own marks, which are off-limits). The wordmark "Kill Team Companion" is set in plain type (Big Shoulders Display) everywhere a mark would go. If you have an original logo for this project, drop it in `assets/` and this note can be removed.

## Content fundamentals
- **Voice**: terse, tactical, second-person imperative for actions ("Deploy Kinband", "Confirm Kill", "Mark Down"), third-person/neutral for data ("APL 2 · Move 6\" · Save 4+").
- **Casing**: UI chrome (buttons, tabs, badges, labels) is ALL CAPS with wide tracking. Body copy and long-form text is sentence case.
- **Numbers as data**: stat lines use compact `·` separated fragments (APL, Move, Save, Wounds) rather than prose — scannable at a glance mid-game.
- **No emoji.** No exclamation-heavy hype copy. Confidence comes from terse declaratives, not enthusiasm.
- **Vibe**: a grim, weathered field-ops terminal — like a data-slate a soldier reads between engagements, not a marketing site.

## Visual foundations
- **Color**: nearly-black gunmetal surfaces (`--bg-void` → `--bg-surface-raised`) with a single warm rust-orange accent (`--accent-primary`) for primary actions and focus. Status colors are desaturated/dirtied (blood-red danger, dried-olive success, dull amber warning) rather than bright saturated UI colors.
- **Type**: `Big Shoulders Display` (black/heavy weights) for headings and hero numbers; `Barlow Condensed` uppercase with wide tracking for labels, tabs, buttons, stat lines; `Barlow` for body copy; `JetBrains Mono` for raw stat/data tables.
- **Spacing**: 4px base scale (4/8/16/24/32/48/64/96).
- **Corner motif**: a single top-right (or all-corner) **chamfer** — a clipped 14px corner cut — is the kit's signature panel shape, used on cards/modals instead of rounded corners. `Card`'s `dossier` mode swaps this for a dashed border with small `+` crossmark ticks at each corner (a generic print/registration-mark convention) — used for operative statcards read as a printed field dossier. Everything else is sharp (2–4px radius) or square.
- **Card anatomy**: any `Card` with a title/eyebrow gets a dark "chrome" header band (same black as `TopBar`, white text) with a small rounded top corner radius, sitting under a 3px rust top border — body content sits on the lighter surface below. This is the kit's standard title-bearing card; textureless, flat surfaces throughout (no grain/paper background).
- **Backgrounds**: flat gunmetal panels, occasionally a subtle brushed-metal or grain texture (`assets/textures/`) at low opacity, or a radial vignette behind hero content. No full illustration backgrounds, no glass/blur except on modal scrims.
- **Borders**: 1px hairline steel borders on most surfaces; a 2px rust border marks the active/accent state (e.g. TopBar underline, focused input).
- **Shadows**: none — the kit is intentionally flat. Depth comes from borders, the dark chrome header band, and the rust top border, not from drop shadows. (`--shadow-*` tokens exist for compatibility but resolve to `none`.)
- **Hover**: buttons lighten toward `--accent-primary-hover`/lighten one step; secondary/ghost buttons pick up a surface tint and a rust border.
- **Press**: buttons scale to 0.97 — a firm, mechanical "click," not a color change alone.
- **Focus**: border color shifts to rust on focus (no shadow ring, per the kit's flat/shadowless treatment).
- **Motion**: fast and utilitarian — 110–180ms ease-out transitions on hover/press/focus. No bounce, no springy easing, no decorative entrance animations.
- **Transparency/blur**: reserved for modal scrims only (`rgba` dim + 2px blur). Not used decoratively elsewhere.
- **Imagery tone** (for user-provided photos/art dropped into placeholders): desaturated, high-contrast, warm-shadow/cool-highlight battlefield photography — not bright or pastel.
- **Radii**: 2px (small controls) / 4px (buttons, inputs) / 6px (rare larger panels) / pill (switches, tags). Cards/modals use the chamfer instead of radius.

## Light theme
Set `data-theme="light"` on any container (root `<html>`/`<body>` or a scoped wrapper) to flip surfaces/text/borders to a warm paper palette (`tokens/colors-light.css`) while the rust accent, status colors, and shadows stay the same hue family. `--bg-chrome`/`--text-on-chrome` are theme-invariant — TopBar and any stat-block-style dark UI stay black-on-paper in both themes, matching printed tabletop reference sheets. See `guidelines/colors-light-theme.html` and the companion app's theme switch (top bar).

## Iconography
No icon set was provided or found in source material. `IconButton` accepts any `icon` node (text glyph, or your own SVG/icon-font import) — nothing is hard-coded. For production, wire in a stroke-based CDN set (e.g. Lucide) at a weight that matches the kit's sharp, utilitarian feel; avoid rounded/friendly icon styles. No emoji used anywhere in the kit.

## Fonts
All type is sourced live from Google Fonts (`tokens/typography.css` `@import`) — no proprietary or copied font files are included, since none were provided as source material:
- Big Shoulders Display (700/800/900)
- Barlow Condensed (500/600/700)
- Barlow (400/500/600/700, 400 italic)
- JetBrains Mono (400/500)

## Structure
- `styles.css` — root import list (link this one file).
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css` (shadows/motion/gradients).
- `assets/textures/` — procedurally generated grain + brushed-metal PNGs (no photography/art was provided; do not treat as final art).
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand) shown in the Design System tab.
- `components/core/` — Button, IconButton, Badge, Tag.
- `components/forms/` — Input, Select, Checkbox, Switch, Stepper.
- `components/feedback/` — Card, Modal, ProgressBar.
- `components/navigation/` — TopBar, TabBar.
- `ui_kits/companion-app/` — click-through recreation of the companion app itself (Roster, Mission Tracker, Dice Roller, Battle Log).
- `SKILL.md` — Claude Code-compatible skill wrapper for this design system.

## Components
Button, IconButton, Badge, Tag, Input, Select, Checkbox, Switch, Stepper, Card, Modal, ProgressBar, TopBar, TabBar. This is a from-scratch standard set (no existing component library was provided to enumerate against) sized to what the companion app needs — no unused primitives were added.

## Caveats / open questions
- No brand logo, icon set, or approved copy exists yet — everything visual here is original, not sourced from Games Workshop.
- Fonts are Google Fonts substitutes chosen to fit the genre; swap in real brand fonts if this project acquires its own.
- The two Warhammer screenshots were used only for extremely high-level layout/tone inspiration (dark UI, condensed type, warm colors) — no colors, type, or components were measured/copied from them.
