# Flokk Operating Disciplines

Numbered disciplines referenced across CLAUDE.md, handoff documents, and session notes.
Canonical source — if a discipline appears here and in CLAUDE.md, this file has the full body.

---

## Discipline 4.62 — Visual Verification Required on UI Changes

When a prompt edits any UI component, page layout, or styling, Claude Code MUST run
`scripts/visual-check.mjs` and view the resulting screenshots before declaring the work
complete. "Build clean" does not equal "ships correctly."

```
PREVIEW_URL=https://flokktravel.com node scripts/visual-check.mjs
```

Screenshots write to `/tmp/flokk-screenshots/`. View the relevant ones with the Read (image)
tool. If the visual is wrong, iterate before committing. Include a visual confirmation
note in every post-deploy report that touches UI.

**Why this discipline was added:**
The session of 2026-05-08 (Chat 47–48) shipped multiple visual regressions that were
caught only by the human reviewing the live site — not by Claude Code claiming "build clean."
Specific incidents:

- 74a99dc: CountryCard silhouette experiment shipped and was confirmed broken only after
  Matt viewed /continents/asia in a browser. Build was clean. TypeScript was clean.
  The silhouette mask-image approach failed visually in ways no compile-time check catches.
- Pattern repeated on continent tile layout and other cosmetic changes in the same chat.

Build clean is a necessary condition for shipping, not a sufficient one. Visual verification
closes the gap between "compiles" and "looks right."

**Scope:**
- Required before commit on any change to: TSX components, Tailwind classes, inline styles,
  CSS variables, layout files, page.tsx files.
- Not required for: API routes, Prisma schema, scripts, config files with no render output.
- The script targets production (`PREVIEW_URL=https://flokktravel.com`) so it catches the
  rendered output after SSR, not just local dev artifacts.

**Tool:**
`scripts/visual-check.mjs` — captures 9 canonical surfaces at desktop (1440×900) and mobile (390×844).
Logs console errors and HTTP 4xx/5xx. Writes 18 PNGs to `/tmp/flokk-screenshots/`.

---

## Discipline 4.65 — Cross-Surface Visual Verification for Shared Components

When a prompt modifies any shared component (`src/components/shared/`, `src/components/cards/`,
`SpotImage`, gradient utilities, render helpers), the visual check phase MUST capture and judge
**all 8 canonical surfaces** in `scripts/visual-check.mjs`. Visual judgment must explicitly call
out any cross-surface drift on a non-target surface. A regression on a non-target surface is a
**hard stop** — no commit until resolved.

**Why this discipline was added:**
During the 17.9.3 / 17.9.4 / 17.9.4.1 series, changes to `CommunitySpotCard` and `SpotImage`
caused image regressions on `/discover` and `/saves` that went unnoticed because visual checks
were scoped to the prompt's primary surface (the country page or city page being built). The
shared card rendered correctly on the target surface but drifted on every other surface that
consumed it. The regression was caught only by human review of the live site, not by any automated
check.

**The 9 canonical surfaces (matches `PAGES` in `scripts/visual-check.mjs`):**

| Name | Path | Notes |
|---|---|---|
| discover | /discover | CommunitySpotCard + TourCard in grid, auth-gated |
| continents-index | /continents | 7-continent grid, public |
| continent-asia | /continents/asia | CountryCard grid, public |
| country-japan | /countries/japan | CommunitySpotCard + CommunityTripCard + TourCard |
| country-france | /countries/france | Same as above, different data |
| city-tokyo | /cities/tokyo | SpotSection cards, TourCard |
| saves | /saves | SaveCard, auth-gated (AUTH WALL until FLOKK_TEST_USER_TOKEN set) |
| spot-detail | /spots/4dZcax0d4ct0 | Public CommunitySpot detail (Sky Cab, Seoul) |
| trip-detail | /trips/cmmycshfj000004jpyadzdp8y | Auth-gated (AUTH WALL until FLOKK_TEST_USER_TOKEN set) |

**Scope:**
- Triggered by changes to anything under `src/components/shared/`, `src/components/cards/`,
  `src/components/ui/`, `src/components/features/places/`, or any utility that transforms
  data before render (e.g. `normalizeCategorySlug`, `resolveSaveLink`, `SpotImage`).
- Also triggered by any change to `CommunitySpotCard`, `TourCard`, `CommunityTripCard`,
  `SaveCard`, `SpotImage` — even if the change appears isolated to one prop.
- Not triggered by: API routes with no UI output, Prisma schema changes, scripts, config.

**Judgment standard:**
Screenshots are judged by Claude Code before commit. Pass criteria:
1. No layout collapse (cards render expected shape)
2. No missing images where images were present before
3. No missing text content (titles, ratings, descriptions)
4. No unexpected empty states on surfaces that should have data
5. No AUTH WALL on public surfaces (private surfaces flagged but not blocking)
