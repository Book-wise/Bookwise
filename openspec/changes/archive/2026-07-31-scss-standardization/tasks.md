# Tasks: SCSS Standardization & Component Style Budget

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1200–1600 (mostly CSS churn moves) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 (feature-branch-chain) |
| Delivery strategy | force-chained |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Tokens + 4 partials + calendar globalization | PR 1 | Base `feat/scss-standardization`; fixes both 8kB ERROR components; big churn — review per commit |
| 2 | Pattern adoption + token sweep | PR 2 | Base PR 1 branch; template + scss per component |
| 3 | Budget bump + final verification | PR 3 | Base PR 2 branch; angular.json warning 4→6kB |

## Phase 1: Tokens & Partials Foundation

- [x] 1.1 `src/styles/_tokens.scss`: add radius (--bw-radius-sm/md/lg/pill 4/6/8/999px), transitions (--bw-transition-fast/base/slow 0.15/0.2/0.3s), --bw-shadow-popover, spacing scale (--bw-space-xs..xl 0.25..2rem incl. --bw-space-md: 1rem), --bw-fc-btn-* palette + --bw-fc-today-bg, --bw-surface-muted, sidebar shadows.
- [x] 1.2 Create `src/styles/_calendar.scss`: layout chrome, filters union, all .fc base rules, toolbar buttons + 425/374/768 media, status filter, blocked/now/slot-preview, tooltips, rewritten .hover-mirror-* (#3788d8→--bw-300); merged brand dark .fc last.
- [x] 1.3 Create `src/styles/_badges.scss`: .bw-chip (color-mix on --chip-color) + __dot + --online/--remaining/--success/--warning/--danger variants.
- [x] 1.4 Create `src/styles/_buttons.scss`: .bw-day-btn (circle toggle, pill radius, fast transition), .bw-icon-btn (ghost).
- [x] 1.5 Create `src/styles/_tables.scss`: .bw-detail-table/.bw-txn-table/.hpg-items-table/.hpg-txn-table verbatim.
- [x] 1.6 `src/styles.scss`: @use the 4 partials after cards; delete old dark .fc block (lines 173–198).

## Phase 2: Calendar Globalization

- [x] 2.1 `full-calendar.component.scss`: remove moved blocks; keep .event-details grid, .slot-menu, .cal-* skeletons, .calendar-loading overrides. Target ≤5kB. ✅ 14.11 kB → 4.54 kB
- [x] 2.2 `provider-calendar.component.scss`: remove moved blocks; keep .event-details flex, .slot-menu, pink .fc-timegrid-slot:hover, skeletons. Target ~3–4kB. ✅ 9.96 kB → 2.04 kB
- [x] 2.3 Build checkpoint: `npx ng build --configuration production` — both calendars pass 8kB error (no template changes expected). ✅ build clean; only patient-card 9.05 kB error remains (Phase 3, expected). Tests 224 pass / 2 pre-existing failures (clients-api spec, out of scope).

## Phase 3: Pattern Adoption

- [x] 3.1 patient-card: root → `bw-card bw-card--signature bw-pc`; badges → .bw-chip; .bw-pc__edit-btn → .bw-icon-btn; bw-pc__* stay scoped. Verify parity. ✅ 9.05 kB ERROR → 7.13 kB warning (`7d87daf`)
- [x] 3.2 payment-tab: prepend bw-card on 10 .sale-card spots; --header adds box-shadow:none; badges → .bw-chip--online/--remaining; tables → _tables.scss. ✅ 5.48 → 4.41 kB (`7d87daf`)
- [x] 3.3 historial-pagos: 4 .hpg-* cards → bw-card (+bw-card--header at line 72); tables → _tables.scss; badges → .bw-chip. ✅ 4.57 → <4 kB (`7d87daf`)
- [x] 3.4 booking-form-dialog.html:524 + block-time-dialog.html:212: .day-btn → .bw-day-btn; delete scss .day-btn block. Keep the two .dialog-content blocks split. ✅ (`d4a69f2`)
- [x] 3.5 booking-detail-dialog: .bw-back-btn → .bw-icon-btn; verify --bw-space-md restores .bw-status-mobile margin. ✅ (`c885699`)

## Phase 4: Token Sweep

- [x] 4.1 `admin-layout.component.scss`: literal shadows → --bw-shadow-sidebar-* tokens. ✅ (`d4a69f2`)
- [x] 4.2 `admin-dashboard.component.scss`: #667eea → var(--bw-300); grays → text tokens. ✅ (`d4a69f2`)
- [x] 4.3 Grep-verify touched files: no new literal radius/transition/shadow/colors. ✅ (`d4a69f2`; non-exact literals flagged in apply-progress)

## Phase 5: Budget & Verification

- [x] 5.1 `angular.json`: anyComponentStyle maximumWarning 4kB→6kB; maximumError stays 8kB. ✅ (`628d8b7`)
- [x] 5.2 `npx ng build --configuration production` passes without errors/warnings from touched components. ✅ zero errors; 3/4 warnings cleared by bump; **patient-card 7.21kB remains a warning** — design-intended exception (proposal Out of Scope "stays ~7.5kB"), under 8kB error
- [x] 5.3 `npx ng test --no-watch` — zero regressions. ✅ 224 passed / 2 failed (identical to baseline — pre-existing clients-api TestBed failures)
- [x] 5.4 Visual QA (light+dark, ≤768px): checklist documented in apply-progress — 7 deliberate changes for human verification.

## Phase 6: Badge Standardization Extension (p-tag → bw-chip)

- [x] 6.1 Shared chip-class helpers with spec (Strict TDD): `bookingStatusChipClass` + `salePaymentChipClass` pure functions in `booking-statuses.ts`, spec-first (`booking-statuses.spec.ts`, +6 tests → 230 passed). ✅ (`c2b6eb2`)
- [x] 6.2 `bw-chip--secondary` variant in `_badges.scss` (`var(--text-color-secondary)`, theme-aware) + drop dead legacy `.location-badge` recipe. ✅ (`c2b6eb2`)
- [x] 6.3 clients/packs/locations/providers active-inactive tags → `.bw-chip` with `[class]` ternary. ✅ (`b499ca2`)
- [x] 6.4 full-calendar + provider-calendar status tags → `.bw-chip` via `getStatusChipClass` (delegates to shared helper); unknown status → neutral `bw-chip--secondary`. ✅ (`de8479c`)
- [x] 6.5 historial-pagos + payment-tab status tags → `.bw-chip` via `salePaymentChipClass`; historial-reserva → dynamic `[style.--chip-color]` with fallback. ✅ (`585639b`)
- [x] 6.6 booking-detail service tag → `bw-chip--secondary booking-service-tag`; dead `statusSeverity` computed removed. ✅ (`32dcf81`)
- [x] 6.7 Remove unused `TagModule` imports from all 10 components — zero `p-tag` / `TagModule` in src. ✅ (`9551ee5` + absorbed)
- [x] 6.8 Verification: grep zero p-tag; tests 230 passed / 2 pre-existing failures; prod build zero errors. ✅
