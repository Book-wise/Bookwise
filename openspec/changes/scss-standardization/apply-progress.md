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
