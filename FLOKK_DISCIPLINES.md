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
`scripts/visual-check.mjs` — captures 7 key pages at desktop (1440×900) and mobile (390×844).
Logs console errors and HTTP 4xx/5xx. Writes 14 PNGs to `/tmp/flokk-screenshots/`.
