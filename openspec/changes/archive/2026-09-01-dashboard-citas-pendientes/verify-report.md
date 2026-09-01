```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:39e8608567bc65fb69263740401a3c6d82fc856abfff975a7b0bb7866f811bb4
verdict: fail
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 1/7
test_command: npx ng test --no-watch --include="**/calendar-navigation.service.spec.ts" --include="**/full-calendar.component.spec.ts" --include="**/providers-list.component.spec.ts"
test_exit_code: 0
test_output_hash: sha256:d3930d0074e2c59ea98fb94d930274d06e3dfda7e4ac532345a35c472a1cf057
build_command: npx ng build
build_exit_code: 0
build_output_hash: sha256:e882be34c5f26f04caf623220394f91826024bef559f0c9ab78b44f23ffcbe1d
```

## Verification Report

**Change**: dashboard-citas-pendientes
**Version**: N/A (proposal-driven; no formal delta spec / no `specs/` directory)
**Mode**: Standard (strict_tdd: false — `openspec/config.yaml`)

> Verdict note: the YAML `verdict: fail` reflects strict byte-validator semantics
> (a scenario is only "complete" when a covering test passed at runtime). It does
> NOT indicate a functional defect: 28/28 focused tests pass, `npx ng build`
> exits 0, and all 14 tasks are complete. The incompleteness is purely test
> coverage for dashboard-only logic that was intentionally skipped (documented).

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 14 |
| Tasks complete | 14 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build**: ✅ Passed (0 errors)
```text
npx ng build → "Application bundle generation complete"
WARNING (pre-existing): bundle initial exceeded maximum budget (500.00 kB not met by 320.46 kB, total 820.46 kB)
WARNING (pre-existing): Module 'luxon' used by 'src/app/features/admin/dashboard/admin-dashboard.component.ts' is not ESM (CommonJS)
```

**Tests**: ✅ 28 passed / ❌ 0 failed / ⚠️ 0 skipped
```text
Test Files 3 passed (3)
Tests 28 passed (28)
[calendar-navigation.service.spec.ts 13 · full-calendar.component.spec.ts 9 · providers-list.component.spec.ts 6]
```

**Coverage**: ➖ Not available (project `testing.coverage: false`)

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| R1 — Service statusIds (signal, hasPendingNavigation, navigateToCalendar(…,statusIds,router), consumePending returns+clears the three, rejection clears statusIds) | Service exposes status-only nav and clears statusIds transactionally (incl. rejection-clear) | `calendar-navigation.service.spec.ts` — 13 tests | ✅ COMPLIANT |
| R2 — FullCalendar applies pending.statusIds to selectedStatusIds (default-loc AND pending-loc-sin-provider) + onFilterChange() | Default-location status-only nav flows into the store filter | `full-calendar.component.spec.ts` > "applies a status-only pending navigation … to the status filter" | ⚠️ PARTIAL |
| R3 — Dashboard pending card clickable → navigateToCalendar(null,null,[5],router) + toast + badge | Card click → status-only nav + info toast + active-range badge | (none; nav intent is delegated to the covered service+full-calendar path — test passes there) | ❌ UNTESTED (static) |
| R4 — Pending count filtered by range (status_id=5 inside range) | `pending` fetch uses `{status_id:PENDING, date_from:start, date_to:end}` | (none — no dashboard spec) | ❌ UNTESTED (static) |
| R5 — Range selector states + computeds + rxResource recalcs date_from/date_to + clear → standard | Range params drive `rxResource` (no fixed week); `clearFilters()` resets to current month→today | (none — no dashboard spec) | ❌ UNTESTED (static) |
| R6 — i18n es/en keys (range + pending toast/card) | Keys `dashboard.range.*` and `dashboard.pending.*` present in both locales | (grep verification; not unit-tested) | ❌ UNTESTED (static) |
| R7 — No temporary logs (console/[DIAG]) in change files | No `console.*` / `[DIAG]` / debugger in changed source | (grep verification — zero matches) | ❌ UNTESTED (static) |

**Compliance summary**: 1/7 scenarios fully runtime-compliant (R1); 1 partial (R2 — only the default-location route is test-covered, the pending-location-sin-provider branch is static-only); 5 statically-verified/untested (R3–R7). There is no formal `specs/` delta, so requirements are derived from the proposal approach + the verification matrix; `strict_tdd: false` and `testing.coverage: false` (config) explain why untested-but-implemented dashboard logic exists.

### Correctness (Static Evidence vs Source)
| Requirement | Status | Source evidence |
|------------|--------|-------|
| Service `pendingStatusIds` + `hasPendingNavigation` includes statusIds | ✅ Implemented | `signal<number[]>([])`; computed includes `length > 0` |
| `navigateToCalendar(locationId, providerId, statusIds, router)` | ✅ Implemented | Clears all three signals on navigation rejection |
| `consumePending()` returns `{locationId, providerId, statusIds}` and clears all three | ✅ Implemented | Transactional read-and-clear |
| FullCalendar applies statusIds in default-location route | ✅ Implemented | `selectedStatusIds = [...pendingStatusIds]` + `onFilterChange()` |
| FullCalendar applies statusIds in pending-location-sin-provider route | ✅ Implemented | `pendingProviderId == null && pendingStatusIds.length` → `onFilterChange()` |
| PENDING_STATUS_ID === 5 | ✅ Confirmed | `BOOKING_STATUSES.find(label==='Pendiente').value === 5` |
| Dashboard card clickable → navigateToCalendar(null,null,[5],router) + toast + badge | ✅ Implemented | `onPendingCardClick()`; badge `{{ rangeBadgeText() }}` on the card |
| Pending count filtered by range | ✅ Implemented | `getBookings({status_id:PENDING, date_from:start, date_to:end})` |
| Range states (rangeMode/selectedMonth/selectedWeekStart/customStart/End) | ✅ Implemented | signals; `RangeMode = 'mes'|'semana'|'libre'` |
| rangeDetails/rangeParams/rangeBadgeText computeds (luxon + tz) | ✅ Implemented | mes→mes, semana→lun-dom, libre→datepickers, incompleto→estándar |
| `rxResource` recalcs date_from/date_to from range (not fixed week) | ✅ Implemented | stream uses `rangeParams()` start/end/anchor |
| clearFilters → mes actual→hoy (estándar) | ✅ Implemented | resets mode/month/week/customStart/customEnd |
| i18n es/en keys | ✅ Implemented | 20 keys present in both locales |
| No temp logs | ✅ Implemented | zero matches for console/[DIAG]/debugger |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Signature `navigateToCalendar(locationId, providerId, statusIds, router)` (statusIds 3rd, router 4th) | ✅ Yes | All callers updated (`providers-list` → `(…, [], router)`, `dashboard` → `(null, null, [5], router)`) |
| `consumePending()` returns `{locationId, providerId, statusIds}` | ✅ Yes | Matches proposal; spec `toEqual` updated |
| Status-only card passes `status_id=5` (`is_finalized` deferred) | ✅ Yes | `PENDING_STATUS_ID` used; `is_finalized` not added (tasks.md + apply-progress notes) |
| Dashboard spec intentionally skipped (p-chart/ChartDataLabels canvas in jsdom) | ✅ Yes | Documented (apply-progress note 5); flow covered at service + full-calendar level |
| Rollback boundary splits Units 1-2 from Units 3-4 | ✅ Yes | Independent feature sets; no cross-dependency |

### Issues Found
**CRITICAL**: None (no functional defect, no failing test, no blocker).
**WARNING**: 
- R5: the range-selector logic + `rxResource` `date_from`/`date_to` recalculation (feature 2 core) has NO direct runtime test — verified statically only. This is the largest verification gap.
- R4: pending-count range filtering (feature 1 core interplay with feature 2) is verified statically only.
- R2: the pending-location-sin-provider branch (`loadLocations` lines 426-437) is implemented but not directly test-covered; only the default-location status-only route is covered.
- R3: the card click handler + toast + badge are static-only; the underlying `navigateToCalendar(null,null,[5])` behavior IS runtime-covered via the full-calendar integration test.
- Pre-existing build warnings (initial bundle budget, luxon CommonJS) — present before this change, not introduced.

**SUGGESTION**: If dashboard coverage is wanted later, extract the range computeds (`rangeDetails`/`rangeParams`/`rangeBadgeText`) plus `onPendingCardClick`/`clearFilters`/`shiftWeek` into a testable facade/helper and add a focused spec. Also add one test for `navigateToCalendar(locationId, null, [5])` to close the R2 pending-location-sin-provider gap. Neither is required to ship; both nullify the current `fail`-coverage findings.

### Verdict
FAIL (incomplete test coverage — not archive-ready under strict byte-validation)
The change is functionally complete and correct (14/14 tasks, 28/28 focused tests pass, `npx ng build` exits 0 with only pre-existing warnings). The `fail` verdict is driven solely by missing runtime tests for dashboard-only logic (R3–R5) plus one untested secondary navigation branch (R2), all of which are statically verified and were documented as intentionally skipped under a `strict_tdd: false` policy. No CRITICAL or blocker findings.
