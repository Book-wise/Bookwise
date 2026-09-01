# Design: Booking Notifications — wire client notification prefs

## Technical Approach

Structure-A zero mapping (contract `archive/2026-08-31-booking-dialog-tabs-state/notifications-backend-contract.md`): `NotificationPrefs` is the exact 5-flag backend shape. `ClientDetailStore` is single owner — `initialize()` populates from `client.notification_prefs`; `setNotification()` becomes optimistic partial PATCH with rollback (`onStatusChange` pattern, L193-223). Patient-card delegates 100% to the store; local non-dialog signals are dead code and removed. UI regrouped 3 Email + 2 WhatsApp with per-flag `pTooltip`.

## Architecture Decisions

| # | Decision | Choice & rationale (alternatives) |
|---|----------|-----------------------------------|
| 1 | PATCH response shape | **Wrapped `{data}` — unwrap in `updateClient`** (`.pipe(map(r => r.data))`); return stays `Observable<Client>` → zero call-site break (callers ignore payload). Evidence: `getClient` unwraps; `updateBooking` typed `ApiResponse<Booking>` (spec flushes `{data}`, `onStatusChange` reads `response.data`); `createSale` destructures `{data}`; contract §2 wraps client. Rejected: keep flat (spec contradicts pattern). Backend live → 500 → **code-pattern assumption, flagged**. |
| 2 | `NotificationPrefs` model | **New `NotificationPrefs` (5 keys) in `models/index.ts`; store re-exports `NotificationValues = NotificationPrefs`**. Contract is 1:1 (structure A). `emptyNotifications()` → 5×false; `setNotification` signature unchanged. |
| 3 | `initialize()` + `sameClient` | **Always populate** `notifications` from `client.notification_prefs` (spread), same-client included — spec "stale values MUST NOT survive". `sameClient` guard remains for caches + `activeView`. Absent prefs → all false (matches `open()` error path). |
| 4 | `setNotification` async | **Optimistic `patchState` → `updateClient(clientId, { notification_prefs: { [key]: value } })` (one flag only) → error: revert + `httpError.handle(err, 'actualizar notificaciones')`**. Store injects root `HttpErrorService`; payload excludes other flags. |
| 5 | Per-flag tooltip | **`pTooltip`** (`tooltipPosition="top"`, `[escape]="true"`) on the existing focusable info `<button>` — repo pattern (providers-list, payment-tab), keyboard-reachable. Rejected: shared `p-popover`, one stale text. |
| 6 | i18n | es.ts + en.ts in parallel (same keys). Remove stale: `type_col`, `email_col`, `wa_col`, `booking_notif`, `reminder`, `immediate`, `scheduled`, `popover_text`. Add group headers + 5 labels + 5 tooltips (event/channel/timing, contract §4). Only patient-card consumes these keys. |
| 7 | Non-dialog local signals | **Remove** — dead code: only consumers `booking-form-dialog` (`showNotifications=false`, L157-159 → never renders) and `reserva-tab` (`dialogMode=true` → store); no test covers it. `notificationValue`/`setNotification` store-only; `notifOpen` stays local. |
| 8 | `notifications_enabled` | **Type `?: boolean` on `Client`; no UI toggle; never sent in PATCH** (product decision deferred). |
## Data Flow

```
patient-card (5 rows)──setNotification(key,value)──► ClientDetailStore
   ▲                                                   │ optimistic patchState
   │ initialize(fullClient)                            ▼
   └── GET /clients/{id} .notification_prefs   PATCH /clients/{id} (partial)
      (open())                               ClientsApiService.updateClient
                                               │ error → rollback + toast
                                               ▼
                                     backend (carlitox + cron)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/core/models/index.ts` | Modify | Add `NotificationPrefs` + `notifications_enabled?`/`notification_prefs?` on `Client` |
| `src/app/core/stores/client-detail.store.ts` | Modify | Alias to `NotificationPrefs`; `emptyNotifications()` 5×false; populate always; optimistic PATCH + rollback |
| `src/app/core/services/api/clients-api.service.ts` | Modify | `updateClient` unwrap `{data}` |
| `src/app/shared/components/patient-card/patient-card.component.{ts,html,scss}` | Modify | Drop local signals/maps; store-only; regroup 3+2, drop `citaWa` + popover; label + `pTooltip` per flag |
| `src/app/core/i18n/es.ts`, `en.ts` | Modify | Replace `notif.*` block |
| `src/app/core/services/api/clients-api.service.spec.ts` | Modify | `updateClient` flush `{ data: response }` |
| `src/app/core/stores/client-detail.store.spec.ts` | Modify | 5-key asserts; mock `updateClient`; init/repopulate/payload/rollback tests |
| `src/app/shared/components/patient-card/patient-card.component.spec.ts` | Modify | L482-488 inverted → PATCH-on-toggle, rollback, init; rename keys |
| `.../booking-detail-dialog/booking-detail-dialog.component.spec.ts` | Modify | Rename `citaEmail` → `email_new_booking` (L121-132) |
| `.../booking-detail-dialog/booking-detail-dialog.component.ts` | No change | Wiring flows via `initialize(fullClient)` (L123); error path all-false — accepted |
## Interfaces / Contracts

```ts
export interface NotificationPrefs {
  email_new_booking: boolean;
  email_booking_confirmation: boolean;
  email_booking_cancellation: boolean;
  whatsapp_reminder: boolean;
  whatsapp_cancellation_confirmation: boolean;
}
// Client += { notifications_enabled?: boolean; notification_prefs?: NotificationPrefs }

// client-detail.store.ts — non-obvious pattern
setNotification(key: keyof NotificationValues, value: boolean): void {
  const clientId = store.client()?.id;
  if (!clientId) return;
  const prev = store.notifications()[key];
  patchState(store, { notifications: { ...store.notifications(), [key]: value } });
  clientsApi.updateClient(clientId, { notification_prefs: { [key]: value } }).subscribe({
    error: (err) => {
      patchState(store, { notifications: { ...store.notifications(), [key]: prev } });
      httpError.handle(err, 'actualizar notificaciones');
    },
  });
}
```

i18n keys: `patient_card.notif.group.{email|whatsapp}`, `patient_card.notif.label.{flag}`, `patient_card.notif.tip.{flag}` (es+en).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `updateClient` unwrap | Flush `{ data: response }`, expect `Client` |
| Unit | Store init/repopulate/rollback | Mock `updateClient`: populate (incl. same-client reopen); absent → all false; payload = only changed flag; error → revert + toast |
| Unit | Card 5 flags, no `citaWa`, store-only | Toggle → store + `updateClient`; tooltip on hover/focus |
| Unit | Dialog close resets | Renamed-key asserts |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration. Backend owns prefs; rollback = revert commit; failed PATCH rolls back UI + toast.

## Open Questions

- [x] Live PATCH /clients/{id} shape — **CONFIRMED (2026-09-01)**: backend merged (PRs #27-#30). Response wrapped `{data}` (matches GET unwrap design); PATCH accepts partial; unknown keys inside `notification_prefs` → **422** (frontend sends only the 5 known flags — already the 1:1 design); master switch `{"notifications_enabled": false}` accepted.
- [ ] `notifications_enabled` master toggle — product decision, deferred.