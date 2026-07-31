# Design: SCSS Standardization & Component Style Budget

## Technical Approach

Extract duplicated FullCalendar CSS and reimplemented card/badge/button/table recipes into global partials (`@use`d in `styles.scss`), extend `_tokens.scss`, adopt `.bw-card`, fix the dangling `--bw-space-md`, and raise `anyComponentStyle` warning 4kB→6kB (error stays 8kB). Three slices: (1) calendar globalization, (2) patterns (tables/badges/buttons/`.bw-card`), (3) token discipline sweep. `::ng-deep` rules already unscoped → pure move, zero behavior change; unique scoped classes → safe move; `:host ::ng-deep .hover-mirror-*` → rewrite dropping `:host`.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|---|---|---|---|
| `::ng-deep .fc` + layout chrome | pure move to `_calendar.scss` | None (already global) | **Move verbatim**, drop `::ng-deep` wrappers |
| `.hover-mirror-*` (`:host ::ng-deep`, full-only) | keep scoped vs rewrite | keep = never globalizes | **Rewrite**: plain `.fc-event-mirror`/`.hover-mirror-*` in `_calendar.scss`; `#3788d8` → `var(--bw-300)` + `color-mix` (QA: pill/body shift) |
| `.calendar-loading`, `.cal-*` skeletons | globalize vs stay scoped | differs between calendars (radius 2/8px, center vs space-between) | **Stay scoped**; only common core of `.calendar-loading` globalizes, divergent radius/padding stay as tiny overrides |
| `.slot-menu`, `.event-details` | globalize vs scoped | structurally different per calendar (white vs p-surface-0, grid vs flex) | **Stay scoped** in each component |
| `.bw-card` swap (payment/historial/patient) | keep recipe vs adopt | shadow conflict: component classes inject after global `.bw-card--header` → shadow leaks | **Adopt**: layout classes keep padding/shadow (`var(--bw-shadow-card)`); `.sale-card--header`/`.hpg-detail-card--header` become `box-shadow: none` shadow-killers |
| `--bw-space-md` | define vs remove | removing hides a real mobile bug | **Define** spacing scale, `--bw-space-md: 1rem` (rem scale 0.25/0.5/1/1.5/2). Restores margin — verified visually |
| Dark `.fc` merge | keep 2 blocks vs merge | indigo (#667eea/#16213e) diverges from brand | **Merge** into `_calendar.scss` end: `body.dark-theme .fc` union of styles.scss + full-calendar blocks, all brand tokens (`--surface-card`, `--surface-ground`, `--bw-300`) |
| Table classes | unify into `.bw-table` vs verbatim | unify = template churn + th drift | **Verbatim move** of `.bw-detail-table`/`.bw-txn-table`/`.hpg-items-table`/`.hpg-txn-table` to `_tables.scss` (zero template change) |
| `.bw-chip` adoption (online/remaining badges) | adopt vs leave | pill radius 4px→999px visual shift | **Adopt with QA flag**; `.bw-chip`+variants global, template swaps class lists |

## Target Partial Structure

| File | Contents |
|---|---|
| `src/styles/_calendar.scss` (NEW) | Layout chrome (`.full-calendar-container`, `.calendar-header`+actions, `.filters` union `.p-select,.p-multiselect`, `.calendar-area`, `.calendar-loading` core, `.calendar-wrapper` fc vars → tokens), status filter (`.bw-status-filter-option/dot`), all `.fc` base rules, toolbar buttons + 425/374/768 media blocks, `.fc-blocked-slot`/`.ev-blocked`, now-indicator, `.hover-mirror-*` (rewritten), `.bw-slot-preview`(+inner), `.event-tooltip-panel`/`.ev-tooltip`, **merged** `body.dark-theme .fc` at end |
| `src/styles/_tables.scss` (NEW) | `.bw-detail-table`, `.bw-txn-table`, `.hpg-items-table`, `.hpg-txn-table` verbatim |
| `src/styles/_badges.scss` (NEW) | `.bw-chip` (bg/border `color-mix` on `--chip-color`), `__dot`, variants `--online/--remaining/--success/--warning/--danger` |
| `src/styles/_buttons.scss` (NEW) | `.bw-day-btn` (circle toggle, radius `--bw-radius-pill`, transitions `--bw-transition-fast`), `.bw-icon-btn` (ghost, radius pill) |
| `src/styles/_tokens.scss` (EXTEND) | `--bw-radius-sm/md/lg/pill` 4/6/8/999px; `--bw-transition-fast/base/slow` 0.15/0.2/0.3s; `--bw-shadow-popover`; `--bw-space-xs..xl` 0.25..2rem; `--bw-fc-btn-{bg,border,hover-bg,hover-border,active-bg,active-border}` (#3b82f6/#2563eb/#1d4ed8), `--bw-fc-today-bg`; `--bw-surface-muted: #f3f4f6`; sidebar shadows (`--bw-shadow-sidebar-toggle/-tab/-tab-hover`) |

`styles.scss`: `@use 'styles/calendar'` + tables/badges/buttons after `cards`; **delete** old dark `.fc` block (lines 173–198). Dark block in `_calendar.scss` comes last in that file — order matters (equal-specificity overrides); component files no longer carry `.fc` dark rules so injection order is safe.

## Per-File Extraction Plan

| File | Move OUT (→ partial) | STAYS (component) | Result |
|---|---|---|---|
| full-calendar (868 ln) | layout chrome, filter dots, all `::ng-deep .fc` base, toolbar/media, blocked/now/slot-preview, tooltips, hover-mirror, dark block | `.event-details` grid, `.session-badge`, `.detail-*`, `.whatsapp-link`, `.slot-menu` (full), `.cal-*` skeletons, `.calendar-loading` radius/padding | ~14.1→**≤5kB** |
| provider-calendar (548 ln) | same shared blocks (filters union, toolbar/media, `ev-*`, tooltips, blocked/now/preview, layout chrome) | `.event-details` flex, `.slot-menu` (provider), `.cal-*` skeletons, pink `.fc-timegrid-slot:hover`, `.calendar-loading` radius/padding | ~9.96→**~3–4kB** |
| patient-card (614 ln) | none (exclusions below); root recipe → `.bw-card` | `bw-pc__*` internals, keyframes, dark tabs | 9.05→**~7.5kB** (warning ok) |
| payment-tab (373 ln) | `.bw-detail-table`/`.bw-txn-table`, online/remaining badge | `.sale-*` layout+content classes, `.bw-detail__*`/`.bw-txn__*`, abono/note/empty | 5.48→**~4kB** |
| historial-pagos (286 ln) | `.hpg-items-table`/`.hpg-txn-table`, badges | `.hpg-*` content classes, back-btn, skeletons | 4.57→**~3.5kB** |
| booking-form-dialog (517 ln) | `.day-btn` | two `.dialog-content` blocks (split stays), panels, forms, skeletons | 5.75→**~4.5kB** |
| block-time-dialog (278 ln) | `.day-btn` | form/sections/skeletons | ~3kB |
| admin-layout / dashboard | — | layout; shadows→tokens; `#667eea`→`var(--bw-300)`, grays→text tokens | ~5kB / ~2.5kB |

`.bw-icon-btn` adopted: patient-card `.bw-pc__edit-btn`, booking-detail `.bw-back-btn`. admin-layout `.mobile-close-btn` **excluded** (radius 6px ≠ 50%).

## .bw-card Adoption (explicit HTML changes)

| Template | Change |
|---|---|
| patient-card.html:1 | `class="bw-pc"` → `class="bw-card bw-card--signature bw-pc"` |
| payment-tab.html (10 spots) | prepend `bw-card`; the 2 `sale-card--header` → `bw-card bw-card--header sale-card sale-card--header`; `sale-card__online-badge`→`bw-chip bw-chip--online`, `sale-remaining`→`bw-chip bw-chip--remaining` |
| historial-pagos.html | `hpg-card`/`hpg-detail-card`/`hpg-sk-card`/`hpg-skeleton` → prepend `bw-card`; line 72 adds `bw-card--header` (+keep `hpg-detail-card--header`); badges → `.bw-chip--online/--remaining` |
| booking-form-dialog.html:524, block-time-dialog.html:212 | `class="day-btn"` → `class="bw-day-btn"` |

## Order of Execution

1. `_tokens.scss` (additive, compiles alone) → 2. create 4 partials + styles.scss wiring/dark-block removal → 3. migrate both calendars → **build checkpoint** → 4. patterns: payment/historial/patient (+html) → 5. day-btn dialogs (+html) → 6. sweep: admin-layout, dashboard → 7. `angular.json` budget `maximumWarning` 4kB→**6kB** (error stays 8kB) → 8. final build + tests + visual QA.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Build | no `anyComponentStyle` errors | `npx ng build --configuration production` after steps 3, 5, 8 |
| Unit | existing tests unaffected | `npx ng test --no-watch` after milestones |
| Visual QA | light+dark: calendar toolbar/active button brand-blue, grid lines, blocked hatch, now indicator, tooltips, ≤768 stacked toolbar, ≤425 custom buttons; day-btn toggle; card padding/shadow parity (payment/historial/patient); provider pink hover; dashboard stat blue; mobile status margin (booking-detail) | Manual both themes, mobile widths |

## Component-Scoped Exclusions

`bw-pc__*` internals (incl. badge count, tabs, panels); `.cal-*`/`.cal-sk-*` skeletons (both calendars); `.slot-menu` variants (both); `.event-details` grid/flex (both); two `.dialog-content` blocks; provider pink hover; `.mobile-close-btn`. reserva-tab `.rf-card` out of scope (follow-up). Auth `#667eea` (gradient pages) untouched.

## Open Questions

- None blocking. QA-flagged: mirror/hover color shift to `--bw-300`, chip pill radius, light `.fc` neutral `var(--surface-ground)` tint, dark button hover via `color-mix`.

**Review guard forecast**: `Decision needed before apply: No` · `Chained PRs recommended: Yes (3 slices per proposal)` · `400-line budget risk: Medium` (mostly churn moves).
