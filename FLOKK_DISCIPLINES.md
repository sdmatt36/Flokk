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
| saves | /saves | SaveCard, auth-gated (auto-auth via Clerk sign-in token — Discipline 9.30) |
| spot-detail | /spots/4dZcax0d4ct0 | Public CommunitySpot detail (Sky Cab, Seoul) |
| trip-detail | /trips/cmmycshfj000004jpyadzdp8y | Auth-gated (auto-auth via Clerk sign-in token — Discipline 9.30) |

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

## Discipline 9.30 — Verification Gate (no workstream may be called complete without a screenshot)

**Rule:** No workstream may be reported as done, shipped, or complete. Two permitted terminal states, and only two:

1. **"code complete, NOT verified"** — code is written and pushed, but no authenticated visual check has been run. Matt must eyeball before this can advance to state 2. State this explicitly. Never disguise it as completion.
2. **"verified, screenshot attached"** — the durable Clerk sign-in-token credential in `scripts/visual-check.mjs` was run, the relevant surface was screenshotted authenticated, and the screenshot is attached inline. This is the only path to declaring a workstream done.

**Credential:** `scripts/visual-check.mjs` auto-establishes a Clerk session via `POST api.clerk.com/v1/sign_in_tokens` using `CLERK_SECRET_KEY` and `ADMIN_CLERK_USER_ID` from `.env.local`. A fresh token is minted on each run. No manual cookie paste. Auth works when `PREVIEW_URL=https://flokktravel.com`.

**How to run:**
```
PREVIEW_URL=https://flokktravel.com node scripts/visual-check.mjs
```

**What is verified:** The 9 canonical surfaces (Discipline 4.65) are screenshotted authenticated. For a specific workstream, the relevant surface(s) must be screenshotted and judged against the criteria in Discipline 4.65.

**Why this exists:** Across multiple build sessions, authenticated surfaces were reported "complete" without visual verification because the session token (manually pasted `__session` cookie) expired in ~60 seconds. Regressions were found by Matt manually. The durable credential eliminates the manual step and makes state 2 achievable by Claude Code without human intervention.

**Scope:** Every workstream that touches any surface listed in the Discipline 4.65 canonical set, any auth-gated page, or any component rendered inside those pages. API-only changes with no UI output are exempt.

---

## Discipline 9.31 — Screenshot Specificity (verification claim must name surface and describe what is visible)

A "verified, screenshot attached" claim is only valid if:

1. The screenshot shows the **specific surface(s) the workstream changed**, not an unrelated canonical surface.
2. The auth state is correct: auth-gated surfaces must show authenticated content (not an auth wall); public surfaces must be verified from a clean context with no session cookies.
3. The report states **in words** what the screenshot demonstrates — what surface, what auth state, what elements are visible.

**Rejected claim forms:**
- Regression screenshots of unrelated surfaces ("saves-desktop.png" for a drill-down workstream)
- Auth-wall screenshots of auth-gated surfaces
- "All 9 canonical surfaces pass" when the changed surface is not in the canonical 9
- Generic "surfaces pass" summaries without per-surface description

**Required terminal state format:**
> "verified, [surface name] screenshot attached, shows [specific description of what is visible and what confirms correctness]"

Both screenshots must be attached for workstreams that change two surfaces.

---

## Discipline 9.32 — The verification gate's credential-live line is mechanical and non-negotiable

Line 1 of every verification report is the credential-live yes/no, every time, no exceptions. Source: three softening incidents during Chat 52; the gate only works if this line is never softened.

---

## Discipline 9.33 — Reuse the container, not just the leaf — extraction over monolith rewrite

When a bespoke shell reuses leaf components, the recurring failure is rebuilding the container (layout width, handler wiring, modal state). Extract the shared container or behavior into a single-source component both consumers import. Never rewrite the monolith it came from when that monolith is a core surface with a tester active. Source: the five-symptom drill-down saga in Chat 52.

---

## Discipline 9.34 — Net-zero claims on any extraction must be exercised, not asserted

Pulling a component out of a large file and importing it back is a real edit to that file. "Same component" or "behaves identically" is never an acceptable verification. Exercise the OTHER consumer's actual path (e.g. the SavesScreen import + onImported refresh, not the modal merely opening). Source: RatingModal and ImportMapsModal extractions in Chat 52.

---

## Discipline 9.35 — Diagnose a reported revert before re-attempting; never fabricate a revert to satisfy the premise

When a prior attempt is said to have been reverted, find the actual SHA and failure reason first. If there is no revert (discarded before commit), say so and infer the failure mode from architecture. Do not label an unrelated commit "the revert." Source: Get Inspired Phase 0 in Chat 52.

---

## Discipline 9.36 — Success metrics must match user intent, not absence of error

A 200 with 0 results is the bug pattern (Tours replacement-stop silent failure). A silent clipboard write with no toast is a broken Share from the user's seat. Absence of an error is not success; the user's intended outcome occurring is. Source: Tours Phase 0 + the drill-down Share toast in Chat 52.

---

## Discipline 9.37 — Code still verifies the visible half under "basically the same" — name the risky path in every gate

Standing tendency. Every prompt's verification gate must explicitly name the risky path and require it exercised, or Code will verify the easy half and assert the rest. Source: SavesScreen import net-zero in Chat 52 (modal-open verified, import+refresh asserted until pushed).

---

## Discipline 9.38 — The handoff is the load-bearing artifact and gets the full bar regardless of session feel

The handoff is the source-of-truth contract for the next session. It must be self-contained (embedded forward roadmap, debates, issues, implementation references), match the established depth bar, and give the MOST space to the most important item. Compressing the headline is the worst place to compress. Source: the under-built first Chat 52 handoff draft, caught by Matt.

---

## Discipline 9.39 — Read project files before forming ANY judgment and before proposing or entering ANY workstream, not merely before editing

Discipline 4.53 mandated reading at session start. Chat 53 proved the failure mode is broader: with nothing read, the strategic chat self-directed into an off-roadmap grader workstream, issued triage verdicts, and directed a full day of rewrites. Until CLAUDE.md, FLOKK_FOUNDATIONS.md, FLOKK_DISCIPLINES.md, the latest handoff, the Spec, and the Roadmap are read, the strategic chat does not opine on regressions, direct rewrites, triage, or enter a new workstream. Reasoning from in-thread context or Code reports is not grounding. Source: Chat 53 incident cascade in front of the CEO plus an entirely untouched mandate.

---

## Discipline 9.40 — Verify Code's reports against the database before accepting them; a Code "verified" is a hypothesis until independently confirmed

Chat 53 independently DB-verified every Code report and caught four genuine defects Code's summaries had marked fine or omitted (blue-card scope absent from diagnosis; "Paris crash" was connection exhaustion not a Paris/PrismaPg bug; 25% silent grader-write drop; duplicate visibility real despite old rows). Run an independent Supabase query confirming the claimed end state before reporting any Code result as done.

---

## Discipline 9.41 — "Code-verified" is never "production-verified" and must never be relabeled to look cleaner

The Chat 53 regen-path start-point fix was grep-identical to the verified main path but no test exercised it; it is recorded as a named residual at moderate-to-high confidence with the exact line to inspect, not as closed. Relabeling to reduce the apparent count of open items is prohibited.

---

## Discipline 9.42 — The founder's lived experience that the product worked outweighs chat-side inference; trust calibration must not invert under pressure

When the founder reports a regression from direct product experience, the working assumption is that it regressed and the investigation aims at what changed; the chat does not argue the founder's memory against audit data it has not itself grounded. Source: Chat 53 CEO walkthrough triage.

---

## Discipline 9.43 — Diagnosis and fix are separate prompts; messy execution requires independent end-state verification before "done"

A messy execution path that "the final query says is clean" is not closed until independently confirmed against the database; the messy path is recorded in the handoff, not buried. Source: Chat 53 duplicate-row merge (script aborted, edited live, completed in two passes 41+85; verified 459→333 live rows with 0 broken associations).

---

## Discipline 9.44 — The handed mandate is a contract; deviating from it requires explicit founder sign-off in-session and is the lede of the next handoff

Incidents happen and a session may legitimately deviate, but the deviation and its roadmap cost must be surfaced to the founder while the session is live, and must be ranked at the top of the next handoff above any recovery narrative. Source: Chat 53 abandoned its entire P0 sequence without ever consulting it.

---

## Discipline 9.45 — Verification scaffolding is a tax that scales with MCP latency

In healthy MCP conditions, post-deploy verification scaffolding (preflight reads, structured diff output, typecheck-then-commit-then-push-then-poll-then-SQL-spot-check) costs minutes. In degraded conditions (parallel shells saturating DB, MCP tools queueing, tsc at the 2-minute timeout limit), the same scaffolding compounds to hours. The strategic chat MUST tune verification scaffolding to the observed MCP latency. When latency is observably elevated, prompts to Code should be code-only: write the diff, typecheck, commit, push. Verification is the strategic chat's job from its own side. Source: Chat 54 Phase I — 2½ hours of wall-clock time on a 15-line patch (the parse-failure retry, commit 5148701) in degraded MCP conditions.

---

## Discipline 9.46 — The strategic chat verifies directly when possible

The strategic chat has Vercel:list_deployments, Supabase:execute_sql, conversation_search, recent_chats, and tool_search for any other available MCP. For any post-deploy check that can be expressed as a single Vercel API call or a single SQL query (was it deployed READY? did the row delete? is errorMessage populated? what's the most recent ExtractionLog?), the strategic chat queries directly rather than tasking Code with it. This is faster (no Code tool-call queue, no Code's MCP-layer latency), more reliable (the strategic chat's tools are not the same MCP layer Code uses), and lets Code focus on writing code. Source: Chat 54 Phase I recovery — confirming dpl_GcKUbxojp8qZJUcKdNcus5LTkpb7 was READY via direct Vercel:list_deployments after Matt's ESC.

---

## Discipline 9.47 — Do not assert cause without evidence; the assumption is the failure

When current data does not support a hypothesis, the answer is "unknown, here's the smallest patch that captures the next observable evidence," not "the most plausible cause is X." This is distinct from 9.42 (founder's lived experience outweighs inference): 9.42 is about whose claim is more trustworthy; 9.47 is about whether any claim is supportable at all. Source: Chat 54 07:11 UTC parse failure — strategic chat asserted "forward-of-forward" as cause based on no evidence; actual cause was unknowable from logs.

---

## Discipline 9.48 — When current DB data refutes a UI observation, file as backlog with the explicit revisit trigger

Possible explanations may exist (render bug, stale screenshot, date-parsing edge case) but none are testable from current data. The right call is "file as backlog, revisit if the pattern appears on a different surface; today is not the day to chase a phantom that current DB data does not corroborate." Chasing every phantom against a demo deadline is how grader-rabbit-hole sessions happen. Source: Chat 54 Mash Tun screenshot (showed same-day check-in/check-out) vs DB content JSON (showed correct 3-night stay 2026-07-10 to 2026-07-13).

---

## Discipline 9.49 — Strategic chat MUST audit inherited P0 status against git log before drafting a diagnostic

Before drafting any prompt for an inherited P0, run `git log --since=<previous-handoff-date>` against the relevant files. If a commit in the window appears relevant, read it. If it addresses the P0, the P0 is closed-not-open and the action is bookkeeping reconciliation, not a new diagnostic. This is a strategic-chat-side discipline; it cannot be delegated to Code without re-introducing the same scaffolding cost (9.45). Source: Chat 54 CSV parser P0 #1 — inherited Chat 52→53→54 as needing diagnosis when Matt's own pre-Chat-54 commit 3add491 had already shipped the fix.

---

## Discipline 9.50 — Cleanup commits with stat-vs-message mismatches must be audited before session close

A "chore: remove temp script" commit that's actually a 13-file 2000-insertion bundle is hiding either a mistake or an intentional sweep, and either case is worth knowing about. Any cleanup commit (chore: remove, chore: cleanup, chore: tidy) with a stat that grossly exceeds the commit message scope gets a `git show` audit before the session is allowed to close. Source: Chat 54 commit 7da0d80 ("chore: remove verify-from-share.mjs temp script") had stat of 13 files / 1957 insertions — audit confirmed false-positive (all scripts/) but the audit itself was worth running.

---

## Discipline 9.51 — Touched-surface declaration

Before writing code for any UI fix, Code declares: (a) files modified, (b) dependent surfaces sharing lexical scope or component imports with the modified files, (c) behaviors on those surfaces that must continue to work post-fix. The declaration is plain text at the top of the prompt response, reviewed by strategic chat before code is written. Source: Chat 55 TDZ regression incident (commit 3d66c87). Fix 7's inline per-day notes render block on `src/app/share/[token]/page.tsx` referenced `items`, `saveItems`, `perDayNotesByDay` before their declaration. Touched-surface declaration would have surfaced the declaration-order issue at Phase 0 read time, not at production-500 time.

---

## Discipline 9.52 — Regression behavior set

A document of `Surface | Behavior | How to test` Code reads before any UI commit. Maintained at `docs/FLOKK_REGRESSION_BEHAVIOR_SET.md`. For each surface modified, existing behaviors that must continue to work post-fix are listed with a curl-or-click test. Code reviews this set as part of Phase 0; if a behavior is in the set but the new code might break it, Code halts and reports before writing. Source: Chat 55 TDZ regression broke the share page's basic 200-OK behavior — implicit, not explicit. The regression set makes it explicit and machine-readable.

---

## Discipline 9.53 — No shared-component changes mid-session

Modifying `src/components/forms/`, `src/components/cards/`, `src/components/modals/`, or any other directory of components reused across multiple surfaces requires halt-and-confirm with strategic chat before proceeding. Shared-component changes have multi-surface blast radius. Multi-surface commits get split along surface boundaries. Source: Chat 55 8-fix UI batch (commit 3d66c87) touched both share page and trip detail components in one commit; the revert had to reverse all 8 atomically.

---

## Discipline 9.54 — Mandatory local `npm run build` before every push

`npx tsc --noEmit` alone is INSUFFICIENT. Next.js static analysis pass during full build catches TDZ violations, hoisting violations, static rendering errors, and other production-relevant failure modes that tsc does not. The build adds ~30-60 seconds per push; the cost is strictly less than the cost of one production TDZ incident. **Binding for Chat 56 onward; no exceptions, including docs-only commits.** Source: Chat 55 TDZ regression shipped through tsc-clean and broke production. `npm run build` exit 0 catches it pre-push.

**Why this exists:** The drill-down card reuse workstream (May 2026) was reported "verified, screenshot attached" with screenshots of the main Saves tab (the donor surface, unchanged). The two actually changed surfaces — `/saves/imported/[citySlug]` and `/share/city/[token]` — were not screenshotted at all. The gate was bypassed by a technically-true-but-wrong claim. This discipline closes that gap.
