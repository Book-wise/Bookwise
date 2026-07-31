# Proposal: SCSS Standardization & Component Style Budget

## Intent

Production build FAILS on `anyComponentStyle` budget (error 8kB): full-calendar 14.11 kB, provider-calendar 9.96 kB, patient-card 9.05 kB; 4 more warn (>=4kB). Root cause: 2 calendar components duplicate ~70-80% identical FullCalendar CSS, and 7 components reimplement the `.bw-card`/status-badge recipes instead of the token system. Fix the build AND standardize global styles (partials, tokens, `.bw-card`) for long-term maintainability, per design-system-tokens.md ("nunca valores literales") and design-system-ui.md.

## Scope

### In Scope
- Slice 1 — Calendar globalization: `styles/_calendar.scss`; merge dark `.fc` into brand blue; token additions
- Slice 2 — Patterns: `_tables.scss`, `_badges.scss`, `_buttons.scss`; `.bw-card` adoption; `.bw-day-btn` extraction
- Slice 3 — Token discipline: admin-layout literal shadows; dashboard legacy #667eea; fix dangling `--bw-space-md`
- Tokens: `--bw-radius-sm/md/lg/pill` (4/6/8/999px), `--bw-transition-fast/base/slow` (0.15/0.2/0.3s), `--bw-shadow-popover`, fc-button palette tokens
- Budget: `anyComponentStyle` warning 4kB->6kB; error stays 8kB

### Out of Scope
- Initial bundle 798 kB warning (JS libs — separate problem)
- Budget relaxation beyond the warning bump
- Globalizing patient-card internals (component-specific; stays ~7.5kB)
- FullCalendar functional/behavioral changes

## Capabilities

### New Capabilities
- `design-system-styles`: global SCSS partials (`_calendar`, `_tables`, `_badges`, `_buttons`), token additions (radius/transition/shadow/spacing/fc palette), dark-mode calendar unification, `.bw-card` adoption conventions

### Modified Capabilities
None — presentational refactor; no behavioral requirements change (`calendar-navigation` spec unaffected).

## Approach

Extract shared rules to partials imported in styles.scss. `::ng-deep` rules already unscoped -> pure move = zero behavior change. Scoped classes unique to the 2 calendars (grep-verified) -> safe to globalize. Merge dark `.fc` blocks deliberately (order-sensitive). Layered per-component padding/shadow via component class over `.bw-card` base. Three slices, one change.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/styles/_calendar.scss`, `_tables.scss`, `_badges.scss`, `_buttons.scss` | New |
| `src/styles/_tokens.scss`, `src/styles.scss` | Modified |
| `src/app/features/admin/calendar/full-calendar.component.scss` | Modified (stripped to component-specific) |
| `src/app/features/provider/calendar/provider-calendar.component.scss` | Modified (stripped to component-specific) |
| `src/app/shared/components/patient-card/patient-card.component.scss` | Modified (`.bw-card` + partials) |
| `.../bookings/booking-detail-dialog/tabs/payment/payment-tab.component.scss` | Modified (`.bw-card` + `_tables`) |
| `.../tabs/historial/historial-pagos.component.scss` | Modified (`.bw-card` + `_tables`) |
| `.../booking-form-dialog/`, `.../block-time-dialog/` `.component.scss` | Modified (`.bw-day-btn`) |
| `src/app/layouts/admin-layout/admin-layout.component.scss` | Modified (shadow tokens) |
| `src/app/features/admin/dashboard/admin-dashboard.component.scss` | Modified (legacy #667eea) |
| `angular.json` | Modified (budget warning 4kB->6kB) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dark `.fc` visual change (indigo -> brand blue) | Med | Intentional; visual QA light+dark |
| `.bw-card` swap loses per-component padding/shadow | Med | Layer component class; visual parity check each |
| CSS ordering after global move | Med | Deliberate dark-block merge; grep `!important` conflicts |
| `--bw-space-md` fix restores margin (behavior change) | Low | Verify booking-detail-dialog layout |

## Rollback Plan

Revert per slice (`git revert` of slice commits). Partials are additive — removing `@use` lines + component classes returns to current state. Budget bump = single `angular.json` revert. No data migration.

## Dependencies

- Design-system docs (`design-system-tokens.md`, `design-system-ui.md`) as source of truth
- Manual visual QA (light + dark)

## Success Criteria

- [ ] `ng build --configuration production` passes — no `anyComponentStyle` errors
- [ ] full-calendar <= ~5kB, provider-calendar <= ~4kB, patient-card < 8kB
- [ ] Touched components contain no literal colors/radius/transitions
- [ ] Dark calendar matches brand blue; `--bw-space-md` defined or removed
