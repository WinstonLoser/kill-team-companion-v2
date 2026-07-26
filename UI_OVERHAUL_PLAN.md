# UI Overhaul on the Kill Team Companion Design System

**Branch:** `feat/ui-overhaul-ds` (branched from `dev`)
**Status:** Phases 0–2 complete and committed. Phase 3 is next.
**Last updated:** 2026-07-26

This is a resumable handoff document. If you are picking this up in a fresh
session, read "Current state" and "Gotchas" before touching anything.

---

## Context

`kill-team-companion-v2` is React 19 + TS 6 + Vite 8 with a well-tested rules
engine and a UI that has accreted past its usefulness: seven top-level views
(roster, full match, simplified match, three labs, rules search), a map-select
screen, a polygon terrain editor, a deploy phase, a single 454-line
`src/index.css`, and hundreds of inline `style={{}}` objects with hardcoded hex
values concentrated in the 44 KB `PlayView.tsx`. One theme only (dark).

A new brand exists: **Kill Team Companion Design System** — an original
rust/gunmetal tactical-terminal identity (Claude Design project
`f378e79c-0bae-4ce4-810c-3df228be0a85`).

**Goal:** rebuild the UI on that design system and strip the app down to
**faction select → battle**. No map builder, no map selection, no deploy phase,
no labs. All rules, engine, geometry, dice, and store behavior unchanged.
Layout stays broadly familiar; every surface gets restyled, with a working
light/dark toggle.

### Decisions already made — do not re-litigate

- Design system lives in `design-system/` at repo root, verbatim; the app
  consumes it only through `src/ui/ds/`.
- Old screens are **unrouted, not deleted** — files stay on disk.
- UI copy stays **Chinese**. DS typography/casing/tracking applies; ALL-CAPS
  treatment only on Latin/numeric fragments.
- Theme: **dark by default**, toggle in the top bar, persisted via the existing
  `settingsStore`.
- The red baseline (below) is accepted as-is; the gate is "do not regress".

---

## Current state

```
264ae7e feat(theme): light/dark toggle on design-system tokens   <- HEAD
8a5b40d chore(ds): import Kill Team Companion design system
2d93432 remove extra files                                       <- dev
```

### Phase 0 — Branch ✅
`feat/ui-overhaul-ds` off `dev`.

### Phase 1 — Design system imported ✅

`design-system/` at repo root (outside `src/`, so `tsc` never sees it):

- `tokens/` — `colors.css`, `colors-light.css`, `typography.css`,
  `spacing.css`, `effects.css`
- `components/` — all 14 as `.jsx` + `.d.ts`: Button, IconButton, Badge, Tag,
  Input, Select, Checkbox, Switch, Stepper, Card, Modal, ProgressBar, TopBar,
  TabBar
- `readme.md` (the brand spec — read this before styling anything),
  `styles.css`, `components/card-shell.js`

**Not imported** (reference/preview only, no runtime impact): `guidelines/*.html`,
`ui_kits/companion-app/`, `*.prompt.md`, `*.card.html`, `assets/textures/*.png`,
`thumbnail.html`, `_ds_bundle.js`, `_ds_manifest.json`,
`_adherence.oxlintrc.json`. To fetch any of them, use the `DesignSync` tool,
`method: "get_file"`, with the project ID above.

Wiring:
- `vite.config.ts` — `@ds` alias → `design-system/` (runtime resolution)
- `src/ds.d.ts` — ambient module declarations (types)
- `src/ui/ds/index.ts` — the single import surface for app code
- Added `@types/node` devDependency (the Vite config needs `node:url`)

### Phase 2 — Theme plumbing ✅

- `settingsStore` gained `theme` / `setTheme` / `toggleTheme`, dark default,
  persisted in the existing `kta-settings-storage` key.
- `main.tsx` imports `@ds/styles.css` **before** `./index.css`.
- `App.tsx` writes `data-theme` + `colorScheme` onto `<html>`.
- `index.css` `:root` is now a pure alias layer over DS tokens
  (`--bg` → `--bg-app`, `--panel` → `--bg-surface`, etc.), so un-migrated
  styles follow the theme for free. Also fills in `--bg-panel`, which the old
  code referenced but never defined.

Browser-verified: both themes render, `--bg-chrome` stays theme-invariant,
choice survives reload, console clean.

---

## Gotchas discovered (these cost real time — do not rediscover them)

1. **The DS `.d.ts` files do not export their components** — only the props
   interfaces (`export interface ButtonProps`, no `Button`). A plain
   `export { Button } from '.../Button'` cannot work. Hence the alias +
   ambient-declaration split.

2. **`src/ds.d.ts` must stay a global script.** Adding any top-level
   `import`/`export` turns `declare module '@ds/...'` into module
   *augmentation*, which then fails to resolve and throws TS2307 for all 14
   components. Use inline `import('react').ReactNode` types instead. There is
   a comment in the file saying this.

3. **Never round-trip files through PowerShell `Get-Content`/`Set-Content`.**
   Windows PowerShell 5.1 reads as the system ANSI codepage, so the repo's
   Chinese comments and UI strings come back as mojibake even with
   `-Encoding utf8`. Use the Edit/Write tools for all file modification.

4. **Token collisions with the old scale.** `index.css` deliberately no longer
   defines `--space-*`, `--radius-*`, or `--shadow-*`: the DS owns those and
   its own components consume them. Redefining them in app CSS silently
   distorts the DS components. Only visible drifts are `--space-5`
   (24px → 20px) and sharper radii, both intended.

5. **`vite build` warns 3× about missing `assets/textures/*.png`.** Those are
   the skipped texture PNGs, referenced only by `--texture-*` declarations.
   Harmless unless you use the opt-in `.kc-textured` class. The brand spec says
   cards are "textureless, flat surfaces throughout", so skipping is fine.

6. **`vitest` reads `vite.config.ts`**, so the `@ds` alias works in tests too.

---

## Baseline — the regression gate

`dev` was **already red** before any of this work. Both numbers were measured
on a clean tree and have held through Phases 1–2:

```
npx tsc --noEmit   ->  257 errors
npm test           ->  58 failed | 207 passed  (14 of 32 files failing)
```

**The gate is: tests must not increase, tsc must strictly decrease.**

Type errors by file (the overhaul clears most of these incidentally):

| file | errors | cleared by |
|---|---|---|
| `src/ui/match/PlayView.tsx` | 78 | Phase 5c |
| `src/state/matchStore.ts` | 31 | — (mostly pre-existing) |
| `src/ui/match/DeployPhase.tsx` | 29 | Phase 3 (unrouted) |
| `src/ui/match/StrategyPhase.tsx` | 16 | Phase 5b |
| `src/ui/components/DungeonMaster/DungeonMasterOverlay.tsx` | 12 | Phase 5d |
| `src/ui/match/UnitPanel.tsx` | 11 | Phase 5b |
| everything else | ~80 | mixed |

The 58 test failures are **data drift, not engine breakage** — golden tests
assert against pack contents that no longer exist:

- `tests/data/legionaries-golden.test.ts` 12/12 — expects
  `faction.subFactionSelector.id === 'markOfChaos'` (got `undefined`) and
  weapon `leg_bolt_pistol` (not in the pack)
- `tests/data/plague-golden.test.ts` 13/13
- `tests/rules/legality.test.ts` 6/11, `tests/engine/predicate-wiring.test.ts`
  5/5, `tests/engine/stratagem-tracking.test.ts` 4/4, others

**Unresolved question:** whether the packs or the tests are correct. Flagged to
the user, deferred. This matters for Phase 5a — `RosterView` and
`SubFactionSelect` both branch on `subFactionSelector`, so if the packs
genuinely lost it, the sub-faction UI is dead code not worth restyling.
**Check this before doing Phase 5a.**

A snapshot of the 257 error lines was written to the session scratchpad; if
it's gone, regenerate with
`npx tsc --noEmit 2>&1 | Select-String 'error TS'`.

---

## Remaining work

### Phase 3 — Collapse navigation to two screens

**`src/state/viewStore.ts`** — narrow to `type View = 'roster' | 'battle'`.
This also fixes an existing build break (`'animationLab'` is used in
`App.tsx:33` but missing from the type).

**`src/App.tsx`** — rebuild:
- DS `TopBar` (title / eyebrow / actions) replaces `<header className="topbar">`.
  This is what makes the top bar stay black in light mode (`--bg-chrome`).
- Actions: theme toggle (replace the temporary `.theme-switcher` button added
  in Phase 2 with a DS `IconButton` or `Switch`), the existing EN/中文
  `localeStore` toggle, and the ⟳ reset button as `Button variant="ghost"` —
  keep it calling `useRosterStore.reset()` + `useMatchStore.reset()` +
  `setView('roster')`.
- Body: `{currentView === 'roster' ? <RosterView/> : <BattleView/>}`. Drop the
  `MatchView` / `TestLab` / `AbilityLab` / `AnimationLab` / `RulesSearch`
  imports, the `VIEWS` array, and `TESTLAB_PACKS`.
- Keep `<AnimationEngine/>` mounted globally; keep `PortraitLockHint`,
  restyled to DS tokens.

`RulesSearch` loses its nav entry, but the **in-match** rules lookup
(`RulesQuery` via `useRulesQuery`, opened from `PlayView`/`ResultPage`) stays
wired — that is the one users actually reach mid-game.

Unrouted but retained, no edits: `MatchView.tsx`, `match/MapSelect.tsx`,
`match/TerrainEditor.tsx`, `match/DeployPhase.tsx`, `test-lab/*`,
`ResolveDemo.tsx`. Add a one-line comment atop `MatchView.tsx` noting it is
currently unrouted so it does not read as dead code.

### Phase 4 — `BattleView` replaces `SimpleMatchView`

Rename `src/ui/SimpleMatchView.tsx` → `src/ui/BattleView.tsx`, keeping its
proven init sequence (`SimpleMatchView.tsx:65–86`) but fixing two real defects:

1. **Init flag is component-local `useState`** (`:63`) — navigating away and
   back silently wipes the match. Move the guard into `matchStore` (a
   `maplessInitialized` flag, or gate on
   `phase !== 'map-select' && tokens.length > 0`).
2. **`buildTokens` is duplicated** near-verbatim in `MatchView.tsx:24–70` and
   `SimpleMatchView.tsx:9–55` (differing only in `pos`/`placed`). Extract to
   `src/ui/buildTokens.ts` as `buildTokens({ placed }: { placed: boolean })`,
   reusing `packOfFaction` / `packOfOp` from `matchStore.ts:26–33`.

The init sequence itself is unchanged and is why this is low-risk: stub 10×10
`mapPack` named `'mapless'` → `initTokens` with `placed: true` →
`setMaplessMode(true)` → `enterStrategy()`. The three `maplessMode` guards
already in the store (`matchStore.ts:793`, `:817`, `:865`) neutralise the
geometry checks, so `map-select`, `TerrainEditor`, and `DeployPhase` are never
reached.

`RosterView.enterMatch()` (`RosterView.tsx:66–69`) changes its one line from
`setView('match')` to `setView('battle')`. The `bothGreen` legality gate is
unchanged.

Render branches stay: `'ended'` → `ResultPage`; `'strategy'` → `StrategyPhase`;
otherwise `PlayView`.

### Phase 5 — Restyle, screen by screen

Layout stays broadly as-is. DS treatment everywhere: chamfered cards (14px
clipped corner, **not** border-radius), dark chrome header bands under a 3px
rust top border, 1px steel hairlines, **no shadows**, 110–180ms ease-out
transitions, `scale(0.97)` press, rust focus border. Big Shoulders Display for
headings/hero numbers, Barlow Condensed uppercase + wide tracking for
labels/buttons/tabs, Barlow for body, JetBrains Mono for stat tables.

**5a — Roster** (highest payoff, smallest surface)
- `roster/FactionSelect.tsx:13` — four faction cards, currently
  `<strong>{name}</strong>` + "可选/✓ 已选". Rebuild on DS `Card` using each
  faction's own `theme.ui.primaryRgb` as accent.
- `RosterView.tsx` — A/B side toggle → DS `TabBar`; both "进入对局" gates →
  `Button variant="primary" size="lg"`; legality dots → `Badge`
  (`tone="success" | "danger"`).
- `roster/OperativePicker.tsx` (14 KB) — `--font-mono` stat lines, DS
  `Select`/`Checkbox`/`Stepper` for controls. Largest file in this phase.
- `roster/LegalityPanel.tsx`, `SubFactionSelect.tsx`, `FactionOverview.tsx` —
  `Card` + `Badge`/`Tag`. (See the open sub-faction question above.)

**5b — Battle chrome**
- `match/StrategyPhase.tsx` — CP as hero numerals in Big Shoulders Display;
  stratagems as `Card`s. Keep `doRoll()` (`:27`) and its dice animation intact.
- `match/UnitPanel.tsx`, `StatusStrip.tsx`, `ActionBar.tsx`,
  `StratagemPanel.tsx`, `LogPanel.tsx` — token conversion + DS
  `Button`/`Badge`/`Tag`.
- `components/UnitPortrait/` — wound bar → DS `ProgressBar` (`tone` by wound
  fraction); keep the faction-theme tinting.
- `components/OperativeCard/OperativeCard.css` (305 lines) — natural home for
  `Card`'s **`dossier`** mode (dashed border, `+` registration ticks). Highest
  visual impact in the app.

**5c — `PlayView.tsx`** (44 KB, the bulk of the work)
Logic is fine; styling is the problem. Do **not** restructure the 3-column
layout (`:473–572`) or touch store dispatch. Convert inline `style={{}}` to
token-driven classes in a new co-located `PlayView.css`, in order:
- log modal (`:548–586`), combat modal (`:597`), datacard modal (`:662`) →
  DS `Modal` (scrims are the one place blur is permitted)
- DM floating button (`:695–719`) → DS `IconButton`
- `SimpleMatchEmptyState` (`:740`), `ActiveOperativeFocus` (`:773`),
  `FindingStrip` (`:850`)

Kill every hardcoded literal found: `#1e1e1e`, `#111`, `#ff4444`, `#aaa`,
`#666`, `rgba(0,0,0,0.7)`.

**5d — Remaining component CSS** — token-convert
`DungeonMasterOverlay.css` (256), `DiceInterface.css` (199),
`DicePanel.css` (142), `UnitPortrait.css` (130), `AnimationEngine.css` (116),
`DiceIcon.css` (112). Dice colors come from pack data
(`theme.dice.baseColor`/`pipColor`) and stay data-driven.

**Light-theme rule throughout:** `--bg-chrome` / `--text-on-chrome` are
theme-invariant. TopBar and stat-block UI stay black-on-paper in light mode —
deliberate, mirroring printed tabletop reference sheets. Check every surface in
both themes.

---

## Out of scope

Zero changes to `src/engine/**`, `src/rules/**`, `src/geometry/**`,
`src/dice/**`, `src/data/**`, `src/state/turnStateMachine.ts`,
`src/state/activationResolver.ts`, `src/state/AbilityResolver.ts`.
`matchStore.ts` gets only the Phase-4 init-guard flag — no changes to phase
transitions, resolution, or legality.

The architectural rule at `PlayView.tsx:24` and `matchStore.ts:19` holds:
**UI dispatches intents and reads the store; it never calls engine/geometry/dice
directly.**

---

## Verification

1. `npm test` and `npx tsc --noEmit` at every phase boundary, against the
   baseline above.
2. `npm run dev`, then drive it in a browser:
   - Roster → faction per side → both badges green → 进入对局 lands directly in
     `StrategyPhase`. No map select, terrain editor, or deploy screen anywhere.
   - Roll initiative → play a turning point → resolve one shooting and one
     melee attack (melee exercises `MeleeAllocationPanel`, the 17.5 KB
     outlier) → open the DM overlay → open the datacard modal → open the
     in-match rules lookup.
   - Screenshot each screen in **both** themes; toggle mid-match and confirm
     nothing loses contrast.
   - Check the console for React key/prop warnings from the DS components.
   - Reload and confirm the theme persisted.
3. **Regression watch:** roster → battle → roster → battle must *not* silently
   reset the match (the Phase-4 init-guard fix).

### Known pre-existing bug worth fixing in passing
`src/utils/avatars.ts:2` returns a hardcoded `/assets/...` path and ignores
`import.meta.env.BASE_URL`, so operative portraits 404 on the GitHub Pages
subpath (`vite.config.ts` sets `base: '/kill-team-companion-v2/'`). One-line
fix; otherwise the new roster cards will look broken in production.

---

## Commit sequence

1. ✅ `chore(ds): import Kill Team Companion design system`
2. ✅ `feat(theme): light/dark toggle on design-system tokens`
3. ⬜ `refactor(nav): collapse to roster + battle, unroute map/lab screens`
4. ⬜ `style(roster): rebuild roster on design system`
5. ⬜ `style(battle): rebuild battle chrome on design system`
