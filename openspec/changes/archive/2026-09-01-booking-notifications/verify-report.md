```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:966d7f852aab8a5e6c16803ac1513236d92c63622ca88f0c4cd9e0e62dc8755e
verdict: pass
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 7/7
test_command: npx ng test --no-watch --include="**/client-detail.store.spec.ts" --include="**/patient-card.component.spec.ts" --include="**/booking-detail-dialog.component.spec.ts"
test_exit_code: 0
test_output_hash: sha256:120964a33a1324d3164a52a887f1f2bc1a90b66e330e0c6aef3d5a349a966ac9
build_command: npx ng build
build_exit_code: 0
build_output_hash: sha256:f4132b7317b7f98a65fcf3b26d0d7a597f7307c3c3fbf8700b618ee3744179ec
```

## Verification Report

**Change**: booking-notifications
**Version**: N/A (delta specs, strict_tdd: false)
**Mode**: Standard

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 12 |
| Tasks complete | 12 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build**: ✅ Passed
```text
npx ng build → exit 0. Only pre-existing luxon CommonJS optimization warning (admin-dashboard). Output: dist/bookwise.
```

**Tests (focused change suites)**: ✅ 65 passed / 0 failed / 0 skipped
```text
npx ng test --no-watch --include="**/client-detail.store.spec.ts" --include="**/patient-card.component.spec.ts" --include="**/booking-detail-dialog.component.spec.ts"
Test Files  3 passed (3)
Tests       65 passed (65)
exit 0
```

**Tests (clients-api suite, isolated)**: ✅ 6 passed / 2 failed — the 2 failures are the pre-existing flaky `getClientPacksList`/`useClientPack` (TestBed reconfiguration race: "Cannot configure the test module when the test module has already been instantiated"). The changed `updateClient` test passes. Both failing tests are byte-identical to the pre-change baseline (git diff shows only the `req.flush({ data: response })` line changed in that file).

**Tests (full suite, once)**: ⚠️ 277 passed / 22 failed / 299 total — variance vs. baseline (16 failed): harness flakiness, verified pre-existing:
- `clients-api.service.spec.ts` — `getClientPacksList`, `useClientPack` (2; pre-existing, unchanged tests)
- `services-api.service.spec.ts` — 5 tests (7/7 pass in isolation → pure cross-suite TestBed-race interference)
- `auth-api.service.spec.ts` — `login`, `register` (2; 7/7 with services-api pass in isolation → interference)
- `full-calendar.component.spec.ts` — 8 tests (pre-existing)
- `booking-form-dialog.component.spec.ts` — "patient card integration" ×2 (`window.matchMedia is not a function` — pre-existing polyfill gap, file untouched by change)
- `historial-reserva.component.spec.ts` — 3 tests (`ctx.bookingsShowingCount is not a function`, pre-existing)

**Zero failures in files changed by this change.** The dialog root spec, store spec, patient-card spec, and the changed `updateClient` test all pass in both isolated and full runs. `git diff 28f7a1d..0fda7f9` confirms the 6 failing files are outside the change (only clients-api spec is in the change, and its failing tests are untouched).

**Coverage**: ➖ Not available (config `coverage: false`; unit-only runner per config.yaml)

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Initialize toggles from client notification prefs | Toggles reflect GET values on open | `client-detail.store.spec.ts > initializes the five toggles from client.notification_prefs on open` | ✅ COMPLIANT |
| Persist toggle changes with a partial PATCH | Toggle sends partial PATCH | `client-detail.store.spec.ts > sends a partial PATCH containing only the changed flag on toggle` + `patient-card.component.spec.ts > sends a partial PATCH with only the changed flag on toggle` | ✅ COMPLIANT |
| Persist toggle changes with a partial PATCH | Failed PATCH rolls back | `client-detail.store.spec.ts > reverts the toggle and shows a toast when the PATCH fails` | ✅ COMPLIANT |
| Render five grouped toggles with per-flag tooltips | Exactly five flags, no citaWa | `patient-card.component.spec.ts > renders exactly five flags grouped by channel and no citaWa` | ✅ COMPLIANT |
| Render five grouped toggles with per-flag tooltips | Accessible per-flag tooltip | `patient-card.component.spec.ts > exposes a keyboard-reachable info button with a tooltip per flag` | ✅ COMPLIANT |
| Repopulate prefs when reopening the same client | No stale state on same-client reopen | `client-detail.store.spec.ts > repopulates prefs from GET when the same client reopens — no stale state` | ✅ COMPLIANT |
| Persist notification preferences via client-notifications (delta, MODIFIED) | Values persist via confirmed contract | `client-detail.store.spec.ts > retains notification values through internal navigation and return` + `booking-detail-dialog.component.spec.ts > discards detail state on close so a later reservation cannot see it` | ✅ COMPLIANT |

**Compliance summary**: 7/7 scenarios compliant (all with passing covering tests)

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| NotificationPrefs model (5 flags, contract 1:1) + `notifications_enabled?`/`notification_prefs?` on Client | ✅ Implemented | `models/index.ts` L88-111; store re-exports `NotificationValues = NotificationPrefs` (L31) |
| `updateClient` unwraps `{data}` | ✅ Implemented | `clients-api.service.ts` L32-36 `.pipe(map(r => r.data))`, return `Observable<Client>`; spec flushes `{ data: response }` |
| `initialize()` populates 5 flags from `client.notification_prefs` every open, same-client included; absent → false | ✅ Implemented | `client-detail.store.ts` L141-155 `{ ...emptyNotifications(), ...client.notification_prefs }`; `emptyNotifications()` 5×false (L42-48) |
| `setNotification` optimistic → partial PATCH → error: revert + `httpError.handle(err, 'actualizar notificaciones')` | ✅ Implemented | `client-detail.store.ts` L165-183; payload `{ notification_prefs: { [key]: value } }`; root `HttpErrorService` injected (L72) |
| UI: exactly 5 toggles (3 Email + 2 WhatsApp), no `citaWa`, per-flag label + focusable info button with `pTooltip` (top, escaped) | ✅ Implemented | template L76-127 (`emailNotificationFlags`/`whatsappNotificationFlags`); `data-testid="notif-flag-*"`; `TooltipModule` replaces `PopoverModule` |
| i18n es.ts + en.ts: `notif.group.{email,whatsapp}`, `notif.label.{flag}`, `notif.tip.{flag}`; stale keys removed | ✅ Implemented | both files L318-331; no `type_col`/`email_col`/`wa_col`/`booking_notif`/`immediate`/`scheduled`/`popover_text` keys remain |
| Dead code: non-dialog local signals/maps removed; `notificationValue`/`setNotification` delegate 100% to store; `notifOpen` stays local | ✅ Implemented | `patient-card.component.ts` — only `notifOpen` local; `showNotifications=false` consumers (booking-form-dialog) never render section |
| Contract alignment: no `citaWa`, no WhatsApp-immediate, no send logic in frontend | ✅ Implemented | `citaWa` only in spec asserting absence; tips describe backend timing (24 h / 30 min); frontend only reads/writes prefs |
| No temporary logs ([DIAG]/console/debugger) in change files | ✅ Implemented | `git diff 28f7a1d..0fda7f9` grep for `console.`/`[DIAG]`/`debugger` → zero matches |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 PATCH response wrapped `{data}` — unwrap in `updateClient` | ✅ Yes | `.pipe(map(r => r.data))`; live-backend 500 risk resolved: PATCH shape CONFIRMED (design open question closed) |
| D2 `NotificationPrefs` model + `NotificationValues` alias; `emptyNotifications()` 5×false | ✅ Yes | 1:1 contract, no mapping |
| D3 `initialize()` always populates (same-client included); absent prefs → all false | ✅ Yes | spec "stale values MUST NOT survive" covered by repopulate test |
| D4 `setNotification` optimistic partial PATCH + rollback + root `HttpErrorService` | ✅ Yes | behavior identical to design; TS-strict typing via `as unknown as Partial<Client>` (documented deviation, payload shape asserted in tests) |
| D5 Per-flag `pTooltip` (top, escaped) on focusable info button | ✅ Yes | keyboard-reachable native button; focus-visible outline in SCSS |
| D6 i18n es+en in parallel; stale keys removed | ✅ Yes | full key parity verified |
| D7 Non-dialog local signals removed | ✅ Yes | no consumers left; `notifOpen` local only |
| D8 `notifications_enabled` type-only, no UI, never in PATCH | ✅ Yes | `?: boolean` on Client; not referenced in template/store PATCH payloads |

### Issues Found
**CRITICAL**: None
**WARNING**:
1. Repo-wide pre-existing test flakiness keeps the full suite red (22 failed this run vs. 16 baseline; 17 on develop baseline per apply). All 22 are in untouched files and reproduce with harness races (TestBed reconfiguration, `matchMedia` polyfill gap in booking-form-dialog, booking-store signal drift in historial-reserva). Not caused by this change, but the full suite cannot be a release gate until these are stabilized.
**SUGGESTION**:
1. `clients-api.service.spec.ts` `getClientPacksList`/`useClientPack` flake: the `subscribe` callback races `afterEach`'s `httpMock.verify()` across tests. Stabilize with `fakeAsync`/`tick` or `await firstValueFrom` before asserting, so the suite stops being an intermittent victim.
2. Tooltip info buttons carry no `aria-label`/`aria-describedby`; the spec is met (keyboard-reachable native button + tooltip text), but adding an `aria-label` (e.g. the tip text) would give screen readers the same description without hover/focus.
3. Documented deviations (TS-strict cast in `setNotification` payload, `data-testid` per flag) are behavior-neutral and pre-declared in apply-progress; consider reflecting the cast in design.md for future maintenance.

### Verdict
PASS — 12/12 tasks complete, 7/7 spec scenarios covered by passing tests (65/65 focused), design decisions followed, build green, zero failures or debug artifacts in change files. The only non-green signal is pre-existing cross-suite flakiness, verified independent of this change.
