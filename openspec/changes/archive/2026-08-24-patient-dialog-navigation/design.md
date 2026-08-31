# Design: Patient Dialog Navigation

## Technical Approach

**Correction to the previous client-only design:** the dialog must not use `BookingStore.selectedBooking()` as a second live source. Introduce a component-scoped `BookingDialogStore` owning the complete persisted `Booking` snapshot, anchored by `bookingId`. `ClientDetailStore` remains client-oriented and owns lazy detail caches keyed by `clientId`; it receives the snapshot's client projection. The dialog, header, `ReservaTabComponent`, and patient card all read the dialog snapshot.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|---|---|---|
| Add `BookingDialogStore`; retain `ClientDetailStore` | Extend/rename client store; root `BookingStore` | Separates booking identity/persistence from reusable client caches without breaking non-dialog consumers. |
| Snapshot replacement on save/refresh/merge | Mutate form state; re-read root store | Recreated Reserva renders the latest complete aggregate and unsaved local edits disappear by design. |
| One internal view in dialog store | Reuse outer `activeTab`; card-local navigation | Prevents collisions: internal detail is entered only from Reserva and any other main tab exits it. |

## Data Flow

```text
calendar complete Booking → open() → BookingDialogStore.snapshot
                                      ├→ header / Reserva / patient card
                                      └→ client projection → ClientDetailStore(clientId caches)
patient card → internal view → destroy Reserva → detail content
return → new Reserva reads snapshot (saved values only)
```

`open()` stores the complete object and ID, initializes the client projection, resets internal view and notifications, then selects the requested main tab. Main-tab changes set internal view to `reserva` (and therefore exit detail). Internal changes do not reset stores. Close and opening a different booking reset dialog state. Successful existing save/refresh/merge updates both `BookingStore` and the dialog snapshot and preserves the existing toast.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/app/core/stores/booking-dialog.store.ts` | Create | Dialog-scoped complete `Booking` snapshot, bookingId, internal view, notifications, replace/reset lifecycle methods. |
| `src/app/core/stores/client-detail.store.ts` | Modify | Keep client projection and `clientId`-associated packs/sales/recent caches; reset caches only when client identity changes. |
| `booking-detail-dialog/booking-detail-dialog.component.ts/.html/.scss` | Modify | Provide/inject dialog store; bind every header/main-content field to snapshot; coordinate internal view, close, and main-tab exit. |
| `booking-detail-dialog/tabs/reserva/reserva-tab.component.ts/.html` | Modify | Accept snapshot, bind patient/provider/service/notes/timing to it, keep edits local, forward typed patient-tab events, and merge refreshed bookings without changing toast behavior. |
| `shared/components/patient-card/patient-card.component.ts/.html` | Modify | Consume snapshot client projection; persist checkbox values in dialog store, while accordion expansion stays local. |
| `shared/components/patient-card/patient-detail-content.component.ts/.html/.scss` | Modify | Render four internal tabs and return action from client caches, with loading/empty/error states. |
| `booking-detail-dialog/booking-detail-dialog.component.spec.ts`, `patient-card.component.spec.ts`, `client-detail.store.spec.ts` | Modify | Add runtime-path and lifecycle coverage; retain compatibility for non-dialog card use. |

## Interfaces / Contracts

```typescript
type PatientTab = 'planes' | 'sesiones' | 'prepago' | 'recientes';
type PatientView = 'reserva' | PatientTab;
interface BookingDialogState {
  booking: Booking | null; bookingId: number | null;
  patientView: PatientView;
  notifications: NotificationValues;
}
// ClientDetailStore caches are keyed by the active booking.client.id.
```

No notification endpoint, payload, or persistence request is invented; values only survive internal navigation.

## Testing Strategy

| Layer | What to prove | Approach |
|---|---|---|
| Unit | Snapshot replace/reset, clientId cache isolation, notifications | Store tests: internal tab changes preserve state; close/new booking clears it. |
| Component | Main-tab exit, four entries, local accordion | Angular/Vitest fixtures assert typed card output and no backend notification call. |
| Integration | **Complete payload → destroy/recreate → DOM restoration** | Open a booking containing client/provider/service/notes/timing; assert all DOM fields, enter detail, destroy Reserva, return, and assert the same persisted values. Repeat after save/refresh and assert updated values plus existing toast. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Do not implement notification backend persistence until its contract is confirmed.

## Open Questions

- [ ] Confirm the backend contract for notification persistence.
