# Design System Styles Specification

## Purpose

Global SCSS partials, tokens, and shared class patterns that keep component styles within the `anyComponentStyle` production budget (8kB error / 6kB warning) and remove duplicated FullCalendar CSS and reimplemented card/badge/button recipes. Presentational refactor — no functional changes except the `--bw-space-md` fix.

## Requirements

### Requirement: Production Build Passes Budget

`ng build --configuration production` MUST complete without `anyComponentStyle` budget errors. All component styles MUST stay under 8kB and SHOULD stay under 6kB.

#### Scenario: Production build succeeds

- GIVEN the production configuration
- WHEN `ng build --configuration production` runs
- THEN it completes without `anyComponentStyle` errors

#### Scenario: Previously failing components recover

- GIVEN full-calendar, provider-calendar, and patient-card exceeded 8kB pre-change
- WHEN the build runs post-change
- THEN each compiles under 8kB, both calendars at ~3.5–4.5kB

### Requirement: Budget Configuration

The `anyComponentStyle` `maximumWarning` MUST be raised from 4kB to 6kB in `angular.json`; `maximumError` MUST remain at 8kB.

#### Scenario: Warning raised, error unchanged

- GIVEN the production budgets block
- WHEN it is read
- THEN maximumWarning equals 6kB AND maximumError equals 8kB

### Requirement: Shared Calendar Styles

Shared FullCalendar CSS MUST live once in `src/styles/_calendar.scss`, consumed by both calendars: fc base rules, toolbar buttons + media queries, status filter, event badges, blocked slots, now indicator, slot preview, tooltips, layout chrome, dark `.fc`. Component-specific rules MUST remain component-scoped.

#### Scenario: Both calendars consume shared partial

- GIVEN full-calendar and provider-calendar render
- WHEN styles load from `_calendar.scss`
- THEN both render as before

### Requirement: Dark Mode Unification

The dark `.fc` block MUST use the brand palette (`--bw-300`, `--surface-card`, `--surface-ground`) and MUST NOT contain legacy indigo values `#667eea` / `#16213e`. Light and dark modes MUST remain visually coherent.

#### Scenario: Dark calendar uses brand palette

- GIVEN `body.dark-theme` is active
- WHEN the calendar renders
- THEN toolbar, surfaces, and active buttons use brand tokens

### Requirement: Card Pattern Adoption

Card roots MUST use `.bw-card` with variant/layout classes layered on top: payment-tab `.sale-card`, historial-pagos `.hpg-card` (4×), patient-card root (`.bw-card.bw-card--signature` + layout class). Per-component padding/shadow MUST be preserved via layered classes.

#### Scenario: Patient card renders identically after swap

- GIVEN patient-card uses `.bw-card.bw-card--signature` + layout class
- WHEN it renders
- THEN appearance matches the pre-change `.bw-pc` root

### Requirement: Shared Button and Badge Patterns

A `.bw-chip` (status badges via `--chip-color`), `.bw-day-btn`, and `.bw-icon-btn` (ghost icon buttons) MUST be global patterns. Booking-form-dialog and block-time-dialog MUST use `.bw-day-btn`.

#### Scenario: Day toggle still works in both dialogs

- GIVEN booking-form-dialog and block-time-dialog use `.bw-day-btn`
- WHEN a day button is clicked
- THEN it toggles `.active` as before in both dialogs

### Requirement: Design Token Additions

`_tokens.scss` MUST define `--bw-radius-sm/md/lg/pill` (4/6/8/999px), `--bw-transition-fast/base/slow` (0.15s/0.2s/0.3s), `--bw-shadow-popover` (0 4px 12px rgba(0,0,0,0.15)), and FullCalendar button palette tokens. Touched components MUST NOT introduce new literal radius or transition values.

#### Scenario: No new literals in touched files

- GIVEN the touched component stylesheets
- WHEN they are inspected
- THEN no new hardcoded radius/transition/shadow values appear

### Requirement: Space Token Resolution

The dangling `--bw-space-md` reference (booking-detail-dialog.component.scss:153) MUST be resolved: define the token (spacing scale) or remove the usage. Restored margin MUST be verified visually.

#### Scenario: Mobile spacing restored

- GIVEN booking-detail-dialog on mobile
- WHEN `--bw-space-md` resolves
- THEN `.bw-status-mobile` margin-bottom renders (verified visually)

### Requirement: Token Discipline Sweep

admin-layout literal shadows MUST map to `--bw-shadow-*` tokens; admin-dashboard `#667eea` MUST map to brand tokens. Touched files MUST NOT gain new hardcoded colors, radii, or spacing.

#### Scenario: Legacy indigo eliminated

- GIVEN admin-dashboard renders
- WHEN its styles are inspected
- THEN no literal `#667eea` remains

### Requirement: Scope Boundaries

The initial bundle warning (798kB JS) MUST NOT be addressed. `bw-pc__*` internals MUST stay component-scoped — not globalized to duck the budget.

#### Scenario: Internal classes stay scoped

- GIVEN patient-card styles post-change
- WHEN inspected
- THEN `bw-pc__*` classes remain in the component stylesheet
