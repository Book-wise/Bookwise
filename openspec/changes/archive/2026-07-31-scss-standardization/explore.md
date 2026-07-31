# Exploration: SCSS bloat & global style standardization

> Copied from Engram `sdd/scss-standardization/explore` (2026-07-31) for continuity.

## Current State

Production build FAILS on anyComponentStyle budget (warning 4kB / error 8kB, angular.json). Real compiled sizes from `ng build --configuration production`: full-calendar 14.11kB (ERROR), provider-calendar 9.96kB (ERROR), patient-card 9.05kB (ERROR), booking-form-dialog 5.75kB (warn), payment-tab 5.48kB (warn), admin-layout 5.23kB (warn), historial-pagos 4.57kB (warn). Also unrelated: initial bundle 798kB vs 500kB warning. Global infra exists: styles.scss (dark mode, PrimeNG overrides, utilities), _tokens.scss (brand palette, type scale, semantic font roles, z-index, shadows, control height — NO radius/transition/spacing tokens), _cards.scss (.bw-card + variants, used only by locations-list & providers-list templates).

## Key findings

1. full-calendar & provider-calendar share ~70-80% identical code: `.full-calendar-container/.calendar-header/.filters/.calendar-area` layout (identical markup in both templates), `.calendar-wrapper` fc CSS vars (13 lines identical), ALL `::ng-deep .fc` base rules (toolbar/buttons/events/timegrid), custom toolbar buttons + 425/374/768 media blocks, `.bw-status-filter-option/dot`, `.ev-inner/.ev-pay-badge/.ev-title`, `.fc-blocked-slot/.ev-blocked`, now-indicator, `.fc-event.bw-slot-preview`, `.ev-tooltip`, `.event-tooltip-panel`, `.slot-overlay`. `::ng-deep` rules are ALREADY unscoped → pure move to global = zero behavior change.
2. Differences: full has dark-mode .fc block (DUPLICATES styles.scss dark .fc with DIVERGENT values: #16213e/#1a1a2e/#667eea/indigo vs var(--surface-card)/var(--surface-ground)/--bw-300/blue), hover-mirror (`:host ::ng-deep` #3788d8), slot-menu with header/sep/close (white bg, #1d4ed8), cal-sk-fw widths, event-details grid 2-col. Provider has pink timegrid-slot:hover, different slot-menu (p-surface-0, -100% -8px), flex-column event-details.
3. Card recipe reimplemented instead of .bw-card: payment-tab `.sale-card`+`--header` (byte-identical to .bw-card/.bw-card--header), historial-pagos `.hpg-card/.hpg-detail-card/.hpg-sk-card/.hpg-skeleton` (4x), reserva-tab `.rf-card`, patient-card `.bw-pc` root (= .bw-card--signature recipe).
4. Token gaps (verified _tokens.scss): NO radius (8px card/6px control/4px tag/999px pill hardcoded), NO transitions (0.15/0.2/0.3s), NO border tokens (hardcoded #d1d5db/#e5e7eb/#f3f4f6/#374151 instead of var(--surface-border)), NO focus-ring, fc button colors #3b82f6/#2563eb/#1d4ed8 hardcoded, `--bw-space-md` referenced in booking-detail-dialog.scss:153 but NOT DEFINED anywhere → dangling token = dropped margin-bottom (real bug).
5. Dark mode duplicated with divergence: full-calendar dark .fc vs styles.scss dark .fc (indigo vs brand blue). admin-dashboard uses legacy #667eea indigo. Dual status-color systems: --bw-success/--bw-warning vs PrimeNG --green-*/--yellow-*/--red-* fallbacks mixed.
6. `.day-btn` recipe (booking-form-dialog + block-time-dialog) identical 25 lines.
7. Ghost icon-button recipe repeated: patient-card edit-btn, booking-detail back-btn, admin-layout close-btn (background none, radius 50%, transition 0.15s).

## Extraction plan & size impact (compiled)

- styles/_calendar.scss: all shared ::ng-deep .fc rules + toolbar buttons + media + status filter + blocked/now/slot-preview + ev-* + ev-tooltip + .full-calendar-container/.calendar-header/.filters layout + .calendar-wrapper vars + merged dark .fc (removed from styles.scss). full-calendar 14.11 → ~4-5kB; provider-calendar 9.96 → ~3-4kB (both pass error; provider clean of warning).
- styles/_tables.scss: .bw-detail-table/.bw-txn-table pattern (min-width, borderless td, nowrap) shared payment-tab/historial-pagos.
- styles/_badges.scss: .bw-chip with --chip-color var pattern (already used by providers-list .filter-chip/.location-badge); status chips, online-badge.
- styles/_buttons.scss: .bw-day-btn + .bw-icon-btn.
- _tokens.scss additions: --bw-radius-sm/md/lg/pill (4/6/8/999px), --bw-transition-fast/base/slow (0.15/0.2/0.3s), --bw-shadow-popover (0 4px 12px rgba(0,0,0,0.15)), fix --bw-space-md (define --bw-space-* or remove), fc button colors → tokens.
- patient-card: swap root to .bw-card--signature + extract badges → 9.05 → ~7.5kB (passes error, STAYS warning unless budget raised — component-specific internals should NOT be globalized).
- admin-layout: shadow tokens only (~5kB, stays warning).
- DECISION: patient-card + admin-layout + booking-form-dialog remain >4kB warning → raise anyComponentStyle warning 4→6kB (maximumError stays 8kB). RESOLVED by user.

## Risks

1. ::ng-deep moves = zero behavior change; scoped class moves (.full-calendar-container etc.) safe (names unique to 2 calendars, verified by grep) but lose _ngcontent attribute → name-collision risk mitigated by bw- prefix.
2. `:host ::ng-deep .fc-event-mirror/.hover-mirror-*` need rewrite to global selectors — behavior-identical since classes unique, but must not be skipped.
3. Dark .fc merge changes visuals (indigo #667eea → brand blue) — intentional, verify visually.
4. .bw-card swap: .bw-card base has NO shadow; sale-card/hpg-card add padding+shadow via component class layered on .bw-card — visual parity per component.
5. Component styles inject after global stylesheet → equal-specificity ties currently favor component; after move the same rules live in stylesheet — order-sensitive overrides (e.g. dark .fc) must be merged deliberately.
6. booking-form-dialog: do NOT merge the two .dialog-content blocks (transform-owner vs layout-owner split is intentional per file comment).
7. --bw-space-md fix is a behavior change (margin-bottom currently dropped).
8. Initial bundle 798kB warning is out of scope (libraries/JS).

## Recommendation

Approach A — extraction to global partials + token additions + .bw-card adoption, in 3 slices: (1) calendar globalization (fixes both ERROR files: styles/_calendar.scss + token additions + dark .fc merge), (2) card/badge/table patterns (patient-card, payment-tab, historial-pagos, day-btn), (3) token discipline sweep (admin-layout, dashboard legacy colors). Reject B (budget-only relaxation — leaves bloat, violates documented design-system rules "no literal values"). Reject C hybrid unless delivery risk demands unblock-first. Ready for proposal: YES.
