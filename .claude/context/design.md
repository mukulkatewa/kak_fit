# Design — the existing visual language

> **Source of truth is `apps/mobile/src/lib/theme.ts`**, not the older
> `docs/DESIGN_SYSTEM.md` (which describes the stale solo-tracker-era dark-first
> blue palette and is out of date). Read tokens from `useTheme()` /
> `useThemedStyles()`, never hard-code hex.

## Platform
React Native + Expo Router, iOS · Android · web from one codebase. Mobile-first —
design for a phone in one hand.

## Theming
Full **light + dark** support via a `ThemeProvider` context. `mode` is
`light | dark | system` (default system), persisted in SecureStore (native) /
localStorage (web). Components consume `useTheme()` (colors, shadows, isDark) or
`useThemedStyles((c, shadows) => …)`. There is a deprecated static `colors`
export (defaults to light) for legacy components — don't use it in new code.

## Current palettes (from theme.ts)
- **Light** — warm off-white, modern nutrition-app feel: `bg #F5F4F0`,
  `surface #FFFFFF`, `text #1A1A1A`, **accent green `#3DB54A`**.
- **Dark** — Hevy-style: pure black `bg #000000`, iOS system grays
  (`surface #1C1C1E`), **accent blue `#0A84FF`**, iOS green success `#30D158`.
- Semantic tokens exist for `gold` (PRs/badges), `danger`, macro colors
  (`carbsColor`/`proteinColor`/`fatColor`), and `on-accent` text.

> ⚠️ **Pending re-skin (not yet in code):** the product direction in
> `docs/START_HERE.md` calls for a premium **"quiet wealth"** palette — charcoal +
> emerald + champagne-gold, warm off-white text — with an understated, supportive
> tone. The current theme is the pre-pivot look. New visual work should move
> toward "quiet wealth" via the `theme.ts` tokens, not entrench the old palette.

## Scales (theme.ts)
- **Spacing:** `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 28 · xxxl 40`
- **Radius:** `sm 8 · md 10 · lg 14 · xl 20 · full 999`
- **Type:** iOS-style system sans (SF Pro / Roboto / system web stack), negative
  letter-spacing on headings. `h1 32/700`, `h2·h3·body·button 17`, `bodySmall 15`,
  `caption·label 13`. Use the `typography` presets.
- **Elevation:** platform-aware `createShadows(isDark)` → `sm/md/lg` + `glow(accent)`
  for accent CTAs. Read via `useTheme().shadows`.

## Component patterns already in the codebase
Shared primitives live in `apps/mobile/src/components/` — `ui.tsx`, `hevy-ui.tsx`
(Screen, cards, buttons, list rows, stat pills, empty states), `charts.tsx`,
`muscle-heatmap.tsx`, `skeleton.tsx`, `icons.tsx`. Reuse these before building new
ones; match their prop and styling conventions.

## UX principles in force
- **Log a fast action in <2s** — previous values pre-filled, large tap targets,
  one primary action per screen.
- **Effortless logging is the moat** — notification → one tap (see the
  meal-reminder feature). Reducing friction beats adding surface area.
- Celebrate wins (PRs: gold + haptic). Subtle press states; heavier motion via
  Reanimated where it earns its place.
