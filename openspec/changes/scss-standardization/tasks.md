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

- [ ] 1.1 `src/styles/_tokens.scss`: add radius (--bw-radius-sm/md/lg/pill 4/6/8/999px), transitions (--bw-transition-fast/base/slow 0.15/0.2/0.3s), --bw-shadow-popover, spacing scale (--bw-space-xs..xl 0.25..2rem incl. --bw-space-md: 1rem), --bw-fc-btn-* palette + --bw-fc-today-bg, --bw-surface-muted, sidebar shadows.
- [ ] 1.2 Create `src/styles/_calendar.scss`: layout chrome, filters union, all .fc base rules, toolbar buttons + 425/374/768 media, status filter, blocked/now/slot-preview, tooltips, rewritten .hover-mirror-* (#3788d8→--bw-300); merged brand dark .fc last.
- [ ] 1.3 Create `src/styles/_badges.scss`: .bw-chip (color-mix on --chip-color) + __dot + --online/--remaining/--success/--warning/--danger variants.
- [ ] 1.4 Create `src/styles/_buttons.scss`: .bw-day-btn (circle toggle, pill radius, fast transition), .bw-icon-btn (ghost).
- [ ] 1.5 Create `src/styles/_tables.scss`: .bw-detail-table/.bw-txn-table/.hpg-items-table/.hpg-txn-table verbatim.
- [ ] 1.6 `src/styles.scss`: @use the 4 partials after cards; delete old dark .fc block (lines 173–198).

## Phase 2: Calendar Globalization

- [ ] 2.1 `full-calendar.component.scss`: remove moved blocks; keep .event-details grid, .slot-menu, .cal-* skeletons, .calendar-loading overrides. Target ≤5kB.
- [ ] 2.2 `provider-calendar.component.scss`: remove moved blocks; keep .event-details flex, .slot-menu, pink .fc-timegrid-slot:hover, skeletons. Target ~3–4kB.
- [ ] 2.3 Build checkpoint: `npx ng build --configuration production` — both calendars pass 8kB error (no template changes expected).

## Phase 3: Pattern Adoption

- [ ] 3.1 patient-card: root → `bw-card bw-card--signature bw-pc`; badges → .bw-chip; .bw-pc__edit-btn → .bw-icon-btn; bw-pc__* stay scoped. Verify parity.
- [ ] 3.2 payment-tab: prepend bw-card on 10 .sale-card spots; --header adds box-shadow:none; badges → .bw-chip--online/--remaining; tables → _tables.scss.
- [ ] 3.3 historial-pagos: 4 .hpg-* cards → bw-card (+bw-card--header at line 72); tables → _tables.scss; badges → .bw-chip.
- [ ] 3.4 booking-form-dialog.html:524 + block-time-dialog.html:212: .day-btn → .bw-day-btn; delete scss .day-btn block. Keep the two .dialog-content blocks split.
- [ ] 3.5 booking-detail-dialog: .bw-back-btn → .bw-icon-btn; verify --bw-space-md restores .bw-status-mobile margin.

## Phase 4: Token Sweep

- [ ] 4.1 `admin-layout.component.scss`: literal shadows → --bw-shadow-sidebar-* tokens.
- [ ] 4.2 `admin-dashboard.component.scss`: #667eea → var(--bw-300); grays → text tokens.
- [ ] 4.3 Grep-verify touched files: no new literal radius/transition/shadow/colors.

## Phase 5: Budget & Verification

- [ ] 5.1 `angular.json`: anyComponentStyle maximumWarning 4kB→6kB; maximumError stays 8kB.
- [ ] 5.2 `npx ng build --configuration production` passes without errors/warnings from touched components.
- [ ] 5.3 `npx ng test --no-watch` — zero regressions.
- [ ] 5.4 Visual QA (light+dark, ≤768px): calendar toolbar brand-blue, blocked hatch, tooltips, day-btn toggle, card parity, provider pink hover, dashboard stat blue, booking-detail mobile margin.
