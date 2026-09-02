# Archive Report: calendar-nav-from-providers

**Change**: calendar-nav-from-providers
**Archive date**: 2026-09-02
**Archived to**: `openspec/changes/archive/2026-09-02-calendar-nav-from-providers/`
**Store**: openspec (files mirrored to Engram `sdd/calendar-nav-from-providers/archive-report`)
**Verdict at close**: `pass` — archive-ready
**Cycle**: proposal → specs → design → tasks → apply → verify → archive

## Executive Summary

Removed the friction of re-selecting branch and professional manually when navigating from the providers list to the calendar. Each provider row's "Ver Agenda" button (`pi pi-calendar`) now navigates to `/admin/calendar` with the provider and its location pre-selected transactionally, without that selection persisting across a page refresh. Implemented via a signal-based `CalendarNavigationService`, wiring in `providers-list`, and transactional consumption in `full-calendar` with a welcome toast. Verified green on build and its own spec suite; archived with zero CRITICAL findings and zero blockers.

## Final State

At close the change is complete. Implementation is on `develop` (last code commit `fe4a130` — "feat(styles): standardize design system tokens and agenda navigation from providers (#26)"). There is no open implementation work:

| Item | State |
|------|-------|
| Implementation tasks | 11/11 complete (`tasks.md`, Phases 1–4) |
| Production build | PASS (`npx ng build`, exit 0) |
| Change-scope test suite | 28 passed / 0 failed (3 spec files) |
| CRITICAL findings | 0 |
| Blockers | 0 |

### Final-state reconciliation (recorded)

The intermediate snapshots reported a different test/build picture than the final state. Per the archive Final-State Authority hierarchy, the launch prompt's terminal facts and this archive's own re-run evidence win, recorded against the older snapshots:

- `apply-progress.md` and `tasks.md` (written mid-cycle) both reported the full-repo baseline as "241 passed, 2 pre-existing failures in `clients-api.service.spec.ts`" and stated that `ng build` failed on pre-existing SCSS budget errors (patient-card, provider-calendar, full-calendar `.scss` exceeding the 8 kB budget). Those are true as of their time.
- Final state differs: the same `fe4a130` commit bundled a design-system-token standardization that resolved the SCSS budget failures, so the production build now exits 0. The change-scope suite (the only suite this change touches) passes 28/28. These are **different scopes, not a contradiction**: "28 passed" is the calendar-navigation.service + providers-list + full-calendar spec suite; "241 passed / 2 pre-existing failures" is the full-repo baseline, where the 2 failures live in `clients-api.service.spec.ts`, a file this change did not modify.

## Specs Synced to Main Specs

| Domain | Action | Details |
|--------|--------|---------|
| `calendar-navigation` | Promoted (byte-identical) | The delta spec is a full spec (the `calendar-navigation` capability was new — no pre-existing spec). Promoted mechanically to `openspec/specs/calendar-navigation/spec.md`; `diff -r` of the change spec dir vs the canonical dir returned empty (exit 0). 5 requirements, 8 scenarios. |

### Promote evidence (mechanical copy readback)

`diff -r openspec/changes/calendar-nav-from-providers/specs/calendar-navigation openspec/specs/calendar-navigation` → **empty (exit 0)**. All 5 requirements promoted verbatim: Agenda Button; Button Disabled Without Location; Transactional Filter Pre-selection; Welcome Toast; Consistent Desktop and Mobile Behavior.

### Source-of-truth updates

- `openspec/specs/calendar-navigation/spec.md` — new canonical spec, now reflects the cross-component navigation with transactional pre-selection.

## Archive Move Evidence

Change folder moved via `git mv` to `openspec/changes/archive/2026-09-02-calendar-nav-from-providers/`. Snapshot readback: `diff -r <pre-move snapshot> openspec/changes/archive/2026-09-02-calendar-nav-from-providers` → **empty (exit 0)**. All tracked artifacts moved intact: proposal.md, specs/calendar-navigation/spec.md, design.md, tasks.md, apply-progress.md. `archive-report.md` is additive (it was not part of the pre-move snapshot). The active directory `openspec/changes/calendar-nav-from-providers/` no longer exists.

## Verification Summary

Evidence re-confirmed by the `sdd-archive` agent at archive time:

- **Build**: `npx ng build` → exit 0, "Application bundle generation complete."
- **Change-scope tests**: `npx ng test --no-watch` on the 3 relevant specs → `3 passed (3)` test files, `28 passed (28)` tests, exit 0.
  - `calendar-navigation.service.spec.ts` — service unit tests.
  - `providers-list.component.spec.ts` — `goToAgenda` wiring, disabled-without-location, tooltip.
  - `full-calendar.component.spec.ts` — transactional consumption, store filter sync, welcome toast, refresh-reset.

All 5 requirements / 8 scenarios from the spec are covered by these specs and the passing suite.

## Implementation Delivered

- `src/app/core/services/calendar-navigation.service.ts` (new): signal-based pending-filter holder — `pendingLocationId` / `pendingProviderId` signals, `hasPendingNavigation` computed, `navigateToCalendar()`, `consumePending()`.
- `src/app/features/admin/providers/providers-list.component.ts` (modified): inject `CalendarNavigationService` + `Router`, `goToAgenda(provider)`.
- `src/app/features/admin/providers/providers-list.component.html` (modified): wire `(onClick)` on both agenda buttons (table row + mobile card), `[disabled]` without location, `pTooltip="Sin sucursal asignada"`.
- `src/app/features/admin/calendar/full-calendar.component.ts` (modified): consume pending filters transactionally in `loadLocations()` success callback, pre-select provider/location, sync filters via `onFilterChange()`, show welcome toast "Mostrando agenda de {providerName} en {locationName}".

## Open Questions / Follow-ups

- **No persisted `verify-report.md`** in the change folder. Verification at close was confirmed by the orchestrator's terminal facts and re-confirmed by this archive agent's own build + test run. A standalone `verify-report.md` was never written to the change dir; if durable verify evidence is desired, that phase artifact is the only gap — it does not block the archive.
- **Pre-existing full-repo failures**: 2 failures in `clients-api.service.spec.ts` (unchanged baseline, unrelated to this change).
- **Non-blocking build warnings**: `luxon` not-ESM CommonJS bailout warning, and the initial bundle exceeded the 500 kB budget by 322.13 kB (unchanged, unrelated to this change).
- Design doc listed `Open Questions: None`.

## Archived Tasks

All 11 implementation tasks are checked (`- [x]`) in the archived `tasks.md` (Phases 1–4). No stale unchecked implementation tasks remain.
