# Apply Progress: SCSS Standardization & Component Style Budget

## Batch: PR 1 (Phases 1–2) — Calendar Globalization + Tokens + Partials

**Status**: ✅ Complete (work unit 1: tokens + 4 partials + calendar globalization)
**Branches**: `feat/scss-standardization` (tracker) ← `feat/scss-wu1-foundation` (this batch)
**Mode**: Strict TDD (relaxed per orchestration — pure CSS extraction, zero behavior change; verified via build + test regression checks)

## Completed Tasks

| Task | Status | Evidence |
|------|--------|----------|
| 1.1 Tokens (`_tokens.scss`) | [x] | `37baee7` — radius/transition/spacing/fc-palette/shadows/surface-muted added (1 file, +34) |
| 1.2 `_calendar.scss` partial | [x] | `3841ae6` — full shared FullCalendar ruleset (650 lines, dark block last) |
| 1.3 `_badges.scss` | [x] | `22f9112` — .bw-chip + variants via color-mix on --chip-color |
| 1.4 `_buttons.scss` | [x] | `22f9112` — .bw-day-btn + .bw-icon-btn ghost |
| 1.5 `_tables.scss` | [x] | `22f9112` — detail/txn/hpg tables verbatim recipes |
| 1.6 `styles.scss` wiring | [x] | `cb505cc` — @use 4 partials after cards; dark .fc block deleted |
| 2.1 full-calendar strip | [x] | `9a268fd` — 14.11 kB → **4.54 kB** compiled |
| 2.2 provider-calendar strip | [x] | `1475d07` — 9.96 kB → **2.04 kB** compiled |
| 2.3 Build checkpoint | [x] | `ng build --configuration production` — both calendars pass 8kB error; tests 224 pass / 2 pre-existing failures |

## Verification Evidence

- **Build**: `npx ng build --configuration production` ✅ — full-calendar and provider-calendar no longer appear in budget errors.
- **Remaining build error**: ONLY `patient-card.component.scss` 9.05 kB (Phase 3.1 file — expected at this stage, untouched).
- **Remaining warnings** (pre-existing, Phase 3–4 files, untouched): patient-card 9.05 kB, booking-form-dialog 5.75 kB, payment-tab 5.48 kB, admin-layout 5.23 kB, historial-pagos 4.57 kB. Bundle initial-bundle warning (810.78 kB) is the known out-of-scope JS issue (slightly grown by globalizing calendar CSS — see Notes).
- **Tests**: `npx ng test --no-watch` → **224 passed / 2 failed** — identical to baseline (`clients-api.service.spec.ts` TestBed setup error, pre-existing, out of scope).
- **Compiled CSS sanity** (via `sass --no-source-map`):
  - Global bundle: no `:host` leakage; `.hover-mirror-*` tokenized (`#3788d8` → `--bw-300`, color-mix) — QA-flagged color shift applied; dark `.fc` block merged with brand tokens (`--bw-fc-today-bg`, `--bw-300`, `var(--text-color)`, buttons #374151/#4b5563, active `--bw-300`); zero `.fc` selectors after dark block in output; fc button tokens wired.
  - full-calendar component: zero `.fc` rules remaining; `.event-details`, `.slot-menu`, `.cal-*` skeletons intact.
  - provider-calendar component: pink `.fc-timegrid-slot:hover` + ::after preserved; `.event-details` flex, `.slot-menu` variant intact.

## Deviations from Design

None for CSS content — pure moves per design sections 2.1–2.2. Noted at apply time:
- WU5/WU6 required **zero template changes** (all styled classes exist in the TS/templates exactly as designed — runbook text only).
- `_calendar.scss` partial is a **superset of the union** — includes admin-only `.slot-overlay`/`.bw-slot-preview` globals and ghost `.fc-bwNewBooking-button`/`.fc-bwBlockTime-button` toolbar buttons (both used by one component or the other); the divergent rules (`.cal-*` skeletons, `.slot-menu` variants, `.event-details` variants, `.calendar-loading` radius/padding, pink hover) stay component-scoped as designed.

## Notes / Risks for Review

- **Initial bundle grew ~13 kB** (798 → 810.78 kB): the shared calendar CSS moved from lazy component chunks into the global bundle. Still a WARNING only (500 kB warning / 1 MB error); the proposal already scopes the initial-bundle size out (JS libs). Trade-off accepted per design 2.0 (avoid double-emit).
- **Hover-mirror color shift**: `#3788d8` → `var(--bw-300)` + `color-mix` lightening — a deliberate QA-flagged change; needs visual QA (Phase 5.4).
- **Dark theme parity**: old dark `.fc` block deleted from styles.scss and re-emitted in `_calendar.scss` with token substitutions (`#667eea` → `--bw-300`, `#16213e` → `var(--text-color)`); verified compiled output contains no old hex values.
- **Pre-existing failures to ignore**: `clients-api.service.spec.ts` (2 tests) — TestBed configure/instantiate error, present before this change.

## Pending (NOT in this batch)

- Phase 3: pattern adoption (patient-card, payment-tab, historial-pagos, booking-form-dialog day-btns, booking-detail back-btn) — PR 2.
- Phase 4: token sweep (admin-layout shadows, admin-dashboard #667eea) — PR 2.
- Phase 5: angular.json budget bump 4→6 kB + final verification + visual QA — PR 3.

**Next recommended**: apply PR 2 (Phases 3–4) from `feat/scss-standardization` tracker.

---

## Batch: PR 2 (Phases 3–4) — Pattern Adoption + Token Sweep

**Status**: ✅ Complete (work units: 3.1–3.3 pattern adoption, 3.4–3.5 dialog patterns, 4.1–4.3 token sweep)
**Branch**: `feat/scss-wu2-patterns` (based on PR 1 branch `feat/scss-wu1-foundation`)
**Mode**: Strict TDD (relaxed per orchestration — pure CSS extraction/class swaps, zero behavior change; verified via build + test regression checks)

## Completed Tasks

| Task | Status | Evidence |
|------|--------|----------|
| 3.1 patient-card | [x] | `7d87daf` — root → `bw-card bw-card--signature bw-pc`; badges → `.bw-chip--success/--online/--warning`; edit btn → `.bw-icon-btn`; dropped 4 dead blocks (`__badge`, `__empty`, `__skeleton-list`, `__booking-status-dot`) + status recipes; `bw-pc__*` internals stay scoped. 9.05 kB ERROR → **7.13 kB** warning |
| 3.2 payment-tab | [x] | `7d87daf` — 10 `.sale-card` spots → `bw-card` layered (incl. `--header` at header spot); badges → `.bw-chip--online/--remaining`; `.bw-detail-table`/`.bw-txn-table` → global `_tables.scss`. 5.48 → **4.41 kB** |
| 3.3 historial-pagos | [x] | `7d87daf` — 4 `.hpg-*` cards → `bw-card` (+`--header` at detail-header spot); badges → `.bw-chip`; tables → `_tables.scss`. 4.57 → **<4 kB** (dropped off warning list) |
| 3.4 dialogs day-btn | [x] | `d4a69f2` — `.day-btn` → global `.bw-day-btn` (identical recipe) in booking-form-dialog.html:524 + block-time-dialog.html:212; local `.day-btn` blocks deleted from both SCSS. **The two `.dialog-content` blocks stay split** (transform-owner top, layout ~line 208) |
| 3.5 booking-detail back-btn | [x] | `c885699` — `.bw-back-btn` → `.bw-icon-btn` (+ icon-size hook); verified `--bw-space-md` (defined `_tokens.scss:71`) restores `.bw-status-mobile` margin at scss:153 |
| 4.1 admin-layout shadows | [x] | `d4a69f2` — 3 literal shadows → `--bw-shadow-sidebar-toggle/tab/tab-hover` (already defined in `_tokens.scss:177–179`) |
| 4.2 admin-dashboard colors | [x] | `d4a69f2` — `#667eea` → `var(--bw-300)` (per `_calendar.scss` precedent "legacy indigo → brand blue"); `#333/#666/#888` → `--text-heading`/`--text-color-secondary` |
| 4.3 literal sweep | [x] | `d4a69f2` — tokenized exact matches in touched files: radii 4/6/8px → `--bw-radius-sm/md/lg`, transitions 0.15/0.2/0.3s → `--bw-transition-fast/base/slow` |

## Verification Evidence

- **Build**: `npx ng build --configuration production` ✅ — zero errors; patient-card no longer an 8kB ERROR.
- **Remaining warnings** (expected until Phase 5.1 raises warning budget 4→6kB): patient-card 7.21 kB, admin-layout 5.45 kB, booking-form-dialog 5.37 kB, payment-tab 4.44 kB. Initial-bundle 810.78 kB warning unchanged (out of scope per proposal).
- **Tests**: `npx ng test --no-watch` → **224 passed / 2 failed** — identical to baseline (`clients-api.service.spec.ts` pre-existing TestBed error, out of scope).

## Deviations from Design

None in content. Noted at apply time:
- Global `.bw-icon-btn` hover bg is `--surface-100` vs local `--surface-ground`; base color `--text-color-secondary` vs local `--text-color` — imperceptible ghost-button shift (back arrow slightly dimmer, darkens on hover).
- `--bw-shadow-sidebar-*` tokens were **already defined** in `_tokens.scss` (PR 1) — 4.1 was a pure mapping, no token additions needed.
- Non-exact literals intentionally left (no token exists): `0.18s` transition, `10px` radius (payment-tab `.sale-body`, admin-layout), `1px` underline, `50%` circles, `0` resets, partial radii (`6px 6px 0 0`).

## Notes / Risks for Review

- **Chip visual shift**: status badges (radius 4px → pill, `color-mix` bg) — deliberate design choice from PR 1 `_badges.scss`; needs visual QA (Phase 5.4).
- **patient-card "Completado" (blue) pack badge** → `bw-chip--online` (blue variant) — closest blue match; semantic name differs from visual role. QA-check in light+dark.
- **`.hpg-back-btn` / `.bw-pc__back`** left component-scoped (text-link rows, not icon circles) — outside task scope.
- **Vitest discovery**: this project runs Vitest (karma-style output); passing `--browsers=ChromeHeadless` breaks the run. Always use plain `npx ng test --no-watch`.

## Pending (NOT in this batch)

- Phase 5: `angular.json` anyComponentStyle warning 4→6kB + final verification (build/tests) + visual QA — PR 3 (from `feat/scss-wu2-patterns`).

**Next recommended**: apply PR 3 (Phase 5: budget bump + final verify + visual QA) from `feat/scss-wu2-patterns`.

---

## Batch: PR 3 (Phase 5) — Budget Bump + Final Verification + Visual QA — FINAL

**Status**: ✅ Complete — all 21 tasks done. Change ready for `sdd-verify`.
**Branch**: `feat/scss-wu3-budget` (based on PR 2 branch `feat/scss-wu2-patterns` — feature-branch-chain, final slice)
**Mode**: Strict TDD (relaxed per orchestration — structural config + verification gates; evidence via build/test regression, no unit layer for angular.json config)

## Completed Tasks

| Task | Status | Evidence |
|------|--------|----------|
| 4.3 tail (leftover) | [x] | `5f929b6` — 3 files uncommitted from PR 2 finished: `4px/6px` radii → `--bw-radius-sm/md`, `0.15s/0.2s` → `--bw-transition-fast/base` in payment-tab, historial-pagos, patient-card. Pure substitution |
| 5.1 Budget bump | [x] | `628d8b7` — `angular.json` `anyComponentStyle` `maximumWarning` 4kB→**6kB**; `maximumError` stays **8kB** (verified via grep: `"type": "anyComponentStyle"` → warning 6kB / error 8kB) |
| 5.2 Production build | [x] | `ng build --configuration production` — **zero errors**; component-style warnings: admin-layout 5.45, booking-form-dialog 5.37, payment-tab 4.44 all cleared by the bump; **patient-card 7.21kB still warns** (see Deviations) |
| 5.3 Test regression | [x] | `ng test --no-watch` → **224 passed / 2 failed** — identical to baseline (clients-api.service.spec.ts pre-existing TestBed errors; do NOT use `--browsers=ChromeHeadless`, breaks Vitest) |
| 5.4 Visual QA checklist | [x] | Documented below — 7 deliberate changes need human eyes (light + dark, ≤768px) |

## Verification Evidence

- **Build**: `npx ng build --configuration production` ✅ zero `anyComponentStyle` errors, 7.9s. Remaining warnings: patient-card 7.21kB (>6kB warning, <8kB error — design exception), initial bundle 810.78kB (out of scope per proposal), luxon CommonJS (pre-existing, unrelated to SCSS).
- **Tests**: `npx ng test --no-watch` → **224 passed / 2 failed** — exact baseline match, zero new regressions (16 files: 15 pass, 1 fail = clients-api).
- **Commit chain**: `5f929b6` (sweep tail) → `628d8b7` (budget) → `9e04fa1` (artifacts).

## Deviations from Design

- **patient-card remains a warning (7.21 kB > 6 kB)** — the batch gate demanded "zero component-style warnings" and expected patient-card "7.2kB under the 6kB warning", but 7.21 > 6.0 numerically. Per design, patient-card targets "~7.5kB (warning ok)" and the proposal explicitly excludes globalizing `bw-pc__*` internals to duck the budget. Every `bw-pc__*` class is live in the template (no dead weight left after 3.1). **Decision: keep as documented exception** — spec "SHOULD stay under 6kB" is non-binding; the MUST (8kB error) is met. Trim/globalize = follow-up task if maintainer wants zero warnings.

## Visual QA Checklist (Task 5.4) — HUMAN VERIFICATION REQUIRED

Run `npm start` (dev server) and check in **light + dark theme**, desktop + ≤768px. Each row = a deliberate change from the refactor:

| # | Area | What changed | Check |
|---|------|-------------|-------|
| 1 | Calendar (full + provider), dark | Dark `.fc` now brand blue (`--bw-300`) instead of indigo `#667eea`; today bg uses `--bw-fc-today-bg`; event mirror hover `#3788d8` → `--bw-300` + `color-mix` | Toolbar buttons, "hoy" highlight, active button, mirror/drag hover pill+body — coherent brand blue, no purple/indigo remnants |
| 2 | Calendar toolbar responsive | Shared media blocks (≤768 stack, ≤425 custom buttons) | Toolbar stacks cleanly on mobile; custom buttons (Nueva reserva/Blocker) still visible on desktop, hidden on ≤425px |
| 3 | patient-card | Root `.bw-pc` → `bw-card bw-card--signature bw-pc` (border-left 3px brand blue); status badges 4px → pill (999px) via `.bw-chip`; edit button → ghost `.bw-icon-btn` | Signature border-left present; chips are pills (not 4px corners); "Completado" pack badge is BLUE (bw-chip--online), not green; ghost edit hover darkens |
| 4 | payment-tab / historial-pagos | Cards layered on `.bw-card` (padding/shadow preserved via layout classes); tables from `_tables.scss`; badges → `.bw-chip` | Sale/historial cards keep their padding + shadow; header cards keep tinted bg; table headers align; "Completado"/"Online" chips readable in light+dark |
| 5 | admin-dashboard | Stat value blue `#667eea` → brand `var(--bw-300)` | KPI values render brand blue (#046af4), no indigo |
| 6 | booking-detail-dialog, mobile | `.bw-status-mobile` margin-bottom restored (`--bw-space-md` now defined — was silently dropped) | At ≤768px the status row has breathing room below it (1rem) |
| 7 | booking-form-dialog + block-time-dialog | `.day-btn` → global `.bw-day-btn` | Day toggler still highlights selected day and toggles `.active` on click in BOTH dialogs |
| 8 | provider-calendar | Pink select-hover `.fc-timegrid-slot:hover` stays component-scoped | Hovering a time slot still shows the pink highlight |

**If any row regresses** (not merely looks different): record it in this file as a risk with the finding, and fix it in a follow-up commit on this branch before merge.

## Risks

- **CRITICAL (decision needed)**: patient-card 7.21kB warning is a **deliberate design exception** (proposal Out of Scope), NOT a regression. If the maintainer requires zero warnings, scope a follow-up: trim or globalize `bw-pc__*` internals.
- QA pending: the 7 deliberate visual shifts in the checklist above are UNVERIFIED by human eyes — `sdd-verify` cannot validate pixel-level appearance.
- Initial bundle 810.78kB warning unchanged (out of scope per proposal, JS libs).
- Leftover uncommitted work from PR 2 (3-file token sweep) was carried into PR 3 as commit `5f929b6` — PR 2's diff on GitHub does NOT include it; PR 3's diff does. Reviewers should know it belongs to task 4.3.

## Final State

- **All 21 tasks `[x]`** in tasks.md.
- Budget: warning 6kB / error 8kB (`angular.json`).
- Build: zero errors. Tests: 224 pass / 2 pre-existing failures (clients-api, out of scope).
- Docs synced: `D:\documentos\trabajo\bookwise\frontend\design-system-tokens.md` + `design-system-ui.md` (radius/transition/spacing/shadow/fc tokens, partials registry, budget).

**Next recommended**: `sdd-verify` (or `sdd-archive` once verify passes).

---

## Batch: WU4 (Extension — PR 4) — p-tag → .bw-chip Badge Standardization

**Status**: ✅ Complete (extension: ALL remaining `p-tag` usages migrated to the single `.bw-chip` recipe)
**Branch**: `feat/scss-wu4-badges` (stacked on PR 3 branch `feat/scss-wu3-budget` — feature-branch-chain, extension slice)
**Mode**: Strict TDD (genuine RED→GREEN→REFACTOR — helpers extracted to pure functions with spec written first)

## Completed Tasks (Phase 6 extension)

| Task | Status | Evidence |
|------|--------|----------|
| 6.1 Shared chip-class helpers + spec (TDD) | [x] | `c2b6eb2` — RED: `booking-statuses.spec.ts` fails (TS2305 no exported member); GREEN: `bookingStatusChipClass` + `salePaymentChipClass` in `booking-statuses.ts`, spec 230/232 green. +6 tests (224 → 230 passed) |
| 6.2 `.bw-chip--secondary` variant + legacy `.location-badge` dead recipe dropped | [x] | `c2b6eb2` — `_badges.scss` + `providers-list.component.scss` (leftover uncommitted dead-CSS from the location-badge migration, badge-scoped, carried into WU4) |
| 6.3 clients/packs/locations/providers active/inactive tags | [x] | `b499ca2` — 6 sites → `.bw-chip` + `[class]` ternary (`bw-chip--success/--danger`) |
| 6.4 calendar status tags | [x] | `de8479c` — both calendars delegate to `bookingStatusChipClass` via `getStatusChipClass`; unknown status now `bw-chip--secondary` (was blue `info` tag) |
| 6.5 historial/payment status tags | [x] | `585639b` — historial-pagos (2) + payment-tab delegate to `salePaymentChipClass`; historial-reserva uses `[style.--chip-color]` dynamic backend color with `?? 'var(--text-color-secondary)'` fallback |
| 6.6 service tag → `bw-chip--secondary` | [x] | `32dcf81` — booking-detail header service tag; dead `statusSeverity` computed removed (unused) |
| 6.7 TagModule imports removed | [x] | `9551ee5` (+ absorbed into `de8479c`/`585639b`/`32dcf81` via whole-file staging) — zero `TagModule` / zero `p-tag` remain in src (only intentional doc comment in booking-statuses.ts) |

## Verification Evidence

- **Grep**: `p-tag` and `TagModule` = 0 usage sites in `src/` (one intentional doc comment in `booking-statuses.ts` explains the mapping).
- **Tests**: `npx ng test --no-watch` → **230 passed / 2 failed** = baseline 224 + 6 new spec tests; the 2 failures are the pre-existing clients-api TestBed errors. Zero new regressions.
- **Build**: `npx ng build --configuration production` → **zero errors**. Only known/expected warnings: initial bundle 810.85 kB (out of scope), patient-card 7.21 kB (documented exception), luxon CommonJS (pre-existing).
- **Commit chain**: `c2b6eb2` (helpers + variant, TDD) → `b499ca2` (lists) → `de8479c` (calendars) → `585639b` (historial/payment) → `32dcf81` (service tag) → `9551ee5` (TagModule sweep).

## TDD Cycle Evidence (Phase 6)

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 6.1 helpers | ✅ spec written first — failed with `TS2305: no exported member 'bookingStatusChipClass'` | ✅ functions implemented — spec + suite green (230/232) | ✅ 4 duplicate helper impls collapsed into 2 shared pure functions; components delegate |
| 6.2–6.7 | N/A — presentational class swaps in templates + CSS; no behavior to test beyond helper mapping (covered by 6.1); verified via grep (zero p-tag) + full suite + prod build | ✅ | — |

## Deviations from Design

- **Helpers extracted to shared pure functions** (`booking-statuses.ts`) instead of per-component rewrites: the 4 duplicate severity helpers (2 calendars + historial-pagos + payment-tab) became 2 exported pure functions, giving a genuine TDD cycle (spec-first) and single-source mapping. Component methods (`getStatusChipClass`, `saleStatusChipClass`, `statusChipClass`) now delegate.
- **Fallback color change**: unknown booking status previously rendered a blue `info` tag; now renders neutral `bw-chip--secondary` (gray) — semantically correct for "Sin estado". Deliberate, needs visual QA.
- **Dead `statusSeverity` computed** (booking-detail-dialog) removed — it was unused since the header stopped using a status tag; no template referenced it.
- **5 of 10 TagModule removals landed inside their migration commits** (whole-file staging) — commit `9551ee5` covers the remaining 5.
- **`.location-badge` dead recipe removal** was already present uncommitted in the wu3 working tree (leftover from the location-badge migration); badge-scoped so carried into WU4 commit `c2b6eb2`.

## Risks

- **Visual QA pending**: 3 deliberate visual shifts — (1) all tags are now pills with 12%/30% color-mix bg/border (vs PrimeNG flat severity colors); (2) unknown status blue → gray; (3) service tag gray secondary (vs PrimeNG gray). All consistent with the established `.bw-chip` recipe, but human eyes needed in light+dark.
- **`salePaymentChipClass` reuses 'partial' → warn semantics** — identical mapping to the old helpers, no drift.
- Pre-existing baseline unchanged: 2 clients-api spec failures, patient-card 7.21 kB warning, initial bundle 810 kB, luxon CommonJS — all out of scope.

## Final State (after WU4)

- **Zero `p-tag` / `TagModule` in src** — ONE badge recipe (`.bw-chip`) in the whole system.
- Tests: **230 passed / 2 pre-existing failures**. Build: **zero errors**.
- Docs synced: `design-system-ui.md` Badges section + `calendar-bookings.md` (status badge note).
- Branch `feat/scss-wu4-badges` stacked on `feat/scss-wu3-budget` per feature-branch-chain (PR 4 targets PR 3 branch).

**Next recommended**: `sdd-verify` (covers the whole change incl. WU4 extension).
