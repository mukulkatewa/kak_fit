# Kak Fit — Design System

> Apple Fitness × Notion × Linear × Strava × Hevy

## Philosophy

Dark mode first. Fast. Premium. Every screen should feel like it belongs in a $50M fitness app — but load in under 2 seconds.

---

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `bg` | `#050508` | App background (near-black) |
| `bgElevated` | `#0c0c10` | Subtle elevation |
| `surface` | `#141418` | Cards |
| `surfaceHover` | `#1c1c22` | Pressed cards |
| `border` | `#2a2a32` | Card borders |
| `borderSubtle` | `#1f1f26` | Dividers |
| `text` | `#f4f4f5` | Primary text |
| `textMuted` | `#a1a1aa` | Secondary text |
| `textDim` | `#71717a` | Tertiary / placeholders |
| `accent` | `#3b82f6` | Electric blue — CTAs, links |
| `accentNeon` | `#22d3ee` | Neon cyan highlights |
| `success` | `#22c55e` | Completed sets, streaks |
| `successNeon` | `#4ade80` | Neon green — PRs, achievements |
| `gold` | `#fbbf24` | Personal records, badges |
| `goldMuted` | `rgba(251, 191, 36, 0.15)` | PR card backgrounds |
| `danger` | `#ef4444` | Delete, errors |
| `glass` | `rgba(20, 20, 24, 0.72)` | Glassmorphism overlays |

---

## Typography

| Style | Size | Weight | Use |
|-------|------|--------|-----|
| Display | 32px | 800 | Screen titles |
| H1 | 24px | 700 | Section headers |
| H2 | 18px | 600 | Card titles |
| Body | 15px | 400 | Default text |
| Caption | 12px | 500 | Labels, metadata |
| Mono | 13px | 600 | Stats, numbers |

Letter-spacing: `0.5` on badges, `2` on brand marks.

---

## Spacing & Radius

- **Radius:** `16px` cards, `12px` buttons/inputs, `999px` pills
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48
- **Card padding:** 16–20px
- **Screen padding:** 20px horizontal

---

## Components

| Component | Notes |
|-----------|-------|
| `Screen` | Safe area + bg + horizontal padding |
| `GlassCard` | Surface + subtle border + optional glow |
| `StatPill` | Compact metric (value + label) |
| `PRBadge` | Gold accent for personal records |
| `StreakBadge` | Fire icon + consecutive weeks |
| `FitnessScore` | Circular score ring (0–100) |
| `MuscleHeatmap` | Body diagram with trained areas highlighted |
| `PrimaryButton` | Electric blue gradient feel |
| `GhostButton` | Border-only secondary |
| `SearchBar` | Rounded, icon prefix |
| `ListRow` | Pressable row with chevron |
| `EmptyState` | Icon + title + subtitle |
| `XPBar` | Gamification progress bar |

---

## Screen Map

| # | Screen | Route | Status |
|---|--------|-------|--------|
| 1 | Dashboard | `/(tabs)` | ✅ Premium redesign |
| 2 | Workout Logger | `/workout/active` | ✅ Premium redesign |
| 3 | Exercise Library | `/(tabs)/exercises` | ✅ Premium redesign |
| 4 | Exercise Details | `/exercise/[id]` | Phase 2 |
| 5 | Routine Builder | `/(tabs)/routines` + `/routine/create` | ✅ Premium redesign |
| 6 | Analytics | `/(tabs)/analytics` | Phase 2 |
| 7 | Nutrition | `/(tabs)/nutrition` | Phase 2 (USDA FDC) |
| 8 | Social Feed | `/(tabs)/social` | Phase 5+ |
| 9 | Profile | `/(tabs)/profile` | ✅ Premium redesign |
| 10 | Settings | `/settings` | Phase 3 |

---

## UX Principles

1. **Log a set in <2s** — Previous values pre-filled, large tap targets
2. **PRs are celebrated** — Gold flash + haptic on new PR
3. **Stats at a glance** — Dashboard shows streak, volume, fitness score
4. **No clutter** — One primary action per screen
5. **Motion** — Subtle press states; full animations in Phase 2 (Reanimated)

---

## Infrastructure (Zero Platform Cost)

All services used are **free forever** or **self-hosted**:

| Service | Cost | Notes |
|---------|------|-------|
| PostgreSQL | Free (Docker) | Self-hosted on your VPS |
| Wger exercises | Free | Open source API |
| USDA FoodData Central | Free | API key, no usage fees |
| Better Auth | Free | Self-hosted |
| MinIO / local storage | Free | Alternative to Supabase (self-host) |
| Expo | Free | Build locally with EAS free tier |
| Next.js on VPS | Free | Docker + Caddy reverse proxy |

**You charge users. You pay nothing for APIs.**
