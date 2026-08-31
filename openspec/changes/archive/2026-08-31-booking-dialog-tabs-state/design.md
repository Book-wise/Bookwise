# Design: booking-dialog-tabs-state

## Technical Approach

Repair `bw-booking-detail-dialog` tab navigation in three phases from the proposal: (A) consolidate booking state into `BookingDialogStore`, (B) replace `@switch(activeTab())` with `p-tablist` + `p-tabpanels` (native keep-alive, `lazy=false`), (C) wire `patient-card` `dialogMode` + `bw-patient-detail-content` as a level-1 sibling. PrimeNG `p-tabpanel` hides inactive panels via `[hidden]` (verified in `fesm2022/primeng-tabs.mjs`), so panels stay mounted and preserve Reserva form state.

## Architecture Decisions

### Decision 1 — Store topology (corrects proposal wording + injection fragility)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Move client/notifications/packs/sales/recent/activeView into `BookingDialogStore` | Breaks `booking-form-dialog`, whose `bw-patient-card` (non-dialogMode) reads `ClientDetailStore` and has no `BookingDialogStore` provider | Reject |
| `BookingDialogStore` owns **booking only**; `ClientDetailStore` owns **client-detail domain** | Two stores, but each single-owner; no mirror writes | **Accept** |

**Choice**: `BookingDialogStore` = sole working-copy owner of `booking`/`bookingId` (`open`/`replaceBooking`/`reset`); REMOVE its `patientView`/`notifications`/`selectPatientView`/`returnToReservation`/`setNotification`. `ClientDetailStore` = sole owner of `client`/`activeView`/`notifications`/`packs`/`sales`/`recent` + loaders. Eliminate the dual-write in `patient-card.setNotification` (L210-215 writes both stores; keep only `detailStore`). `BookingStore` root stays calendar-only (`bookings[]`, `selectedBooking` computed, `eventsForCalendar`, mutations `mergeBooking`/`deleteBooking`/`refreshBooking`/`updateBooking`/`createBooking`/`blockSlot`/`unblockSlot`, `selectBooking`).

**Rationale**: fixes RC2 (two booking sources) and the notification/activeView mirror, without breaking the shared `ClientDetailStore`.

**⚠️ Injection fragility (verified) — must be resolved in this change**: `ClientDetailStore = signalStore(...)` has NO `{ providedIn: 'root' }`, so it is NOT root-provided. `booking-detail-dialog` provides it via `providers: [ClientDetailStore, BookingDialogStore]`, but `booking-form-dialog` renders `<bw-patient-card>` (its HTML L157) WITHOUT declaring `ClientDetailStore` in its providers, while `patient-card.component.ts:25` does a **required** `inject(ClientDetailStore)`. The patient-card is the conflict node: it hard-depends on a store only one of its two consumers provides. Fix: make `ClientDetailStore` `providedIn: 'root'` (it already resets on `reset()` and is keyed by client id, so a root singleton is safe), OR make `patient-card` degrade to local signals when the store is absent. Choose root provisioning as primary (simplest, matches `BookingStore` which is already `providedIn: 'root'`).

### Decision 2 — Bug #2 email/phone (evidence + fix)

**Evidence**: `Booking.client` is typed optional in `models/index.ts` L153, but a duplicate `Booking` in `responses/bookings.ts` L54 declares `client: BookingClient` (required) with `email: string` required — a shadowing conflict. `patient-card` and the `paciente` tab render email/phone behind `@if (client().email)`, and `hasContactWarning` fires when either is missing. Live verification is blocked: `GET /api/v1/bookings` returns `{"message":"Unauthenticated."}` (auth required). Conclusion: the list payload's embedded `client` cannot be trusted to carry contact fields.

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Assume list payload has email/phone | Unverified; bug persists if reduced client | Reject |
| Re-fetch `bookingsApi.getBooking(id)` on open | One call, full booking, but broader blast radius | Reject |
| Enrich via `clientsApi.getClient(id)` on open | One extra GET; deterministic; narrow scope | **Accept** |

**Choice**: in `open()`, when `booking.client?.id` exists, fetch `ClientsApiService.getClient(id)` and merge the full client into the dialog working copy + `detailStore.initialize(fullClient)` + `store.mergeBooking({...booking, client: fullClient})`. `getClient` returns `Client` with required `email` and optional `phone`.

### Decision 3 — Disabled sub-tab trigger

| Button | Disabled when |
|--------|---------------|
| `planes` / `sesiones` | `packs.loaded && activePacks().length === 0` |
| `prepago` | `sales.loaded && sales.data.length === 0` |
| `recientes` | `recent.loaded && recent.data.length === 0` |

Buttons stay ENABLED while `loading` or `!loaded` (click shows skeleton / triggers load). On dialog open, eagerly reload all three domains (`loadPacks`/`loadSales`/`loadRecent`) so disabled state is correct before first click — satisfying "reload on open" and "no per-client cache" (store `reset()` on close already clears it).

### Decision 4 — `p-tabs` structure

Move `p-tabs` out of `pTemplate="header"` into default content so it wraps `p-tablist` + `p-tabpanels` (required by `p-tabpanel`'s `forwardRef(() => Tabs)`). Header keeps title/status only. All 6 `p-tabpanel` render unconditionally (mobile hides tabs via `visibleTabs()`, panels remain mounted). Preserve `@if (visible())` reset-on-close.

```
<p-dialog>
  <ng-template pTemplate="header"> title + status </ng-template>
  @if (visible()) { @if (booking()) {
    <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event)" class="booking-dialog-tabs">
      <p-tablist> @for tab of visibleTabs(): <p-tab [value]>…</p-tablist>
      <p-tabpanels [hidden]="detailStore.activeView() !== 'reserva'">
        <p-tabpanel value="reserva"> <bw-reserva-tab (patientTabSelected)="onPatientTabSelected($event)"/> </p-tabpanel>
        … pago / recordatorios / paciente / ficha / historial
      </p-tabpanels>
    </p-tabs>
    @if (detailStore.activeView() !== 'reserva') {
      <bw-patient-detail-content [view]="activeDetailTab()" (returnRequested)="returnToReservation()"/>
    }
  }}
  <ng-template pTemplate="footer">…</ng-template>
</p-dialog>
```

`p-tabpanels [hidden]` (not `@if`) preserves Reserva keep-alive while patient-detail fills the content area.

**Clarification (corrects earlier ambiguity)**: `bw-patient-detail-content` is NOT nested inside the Reserva card. It is a **level-1 sibling** rendered directly inside `.p-dialog-content`, at the same level as the `p-tabs` block, gated by `detailStore.activeView() !== 'reserva'`. When the user clicks a sub-tab (Planes/Sesiones/Prepagado/Recientes), `activeView` changes → the `p-tabpanels` (which hold Reserva + Pago + Ficha + Historial) hide via `[hidden]`, and `bw-patient-detail-content` fills the ENTIRE `.p-dialog-content` (full width + full height). Its "Volver a la reserva" button sets `activeView` back to `'reserva'`, unhiding the tabpanels — Reserva never unmounts, so its form state survives.

### Decision 5 — SCSS impact

- Keep `.booking-dialog-tabs` targeting `.p-tablist`/`.p-tab`, but make `.p-tablist` `position: sticky; top: 0; z-index` so it stays pinned under the header while `.p-dialog-content` scrolls.
- `.tab-content` stays as panel body (`flex`, `padding`, `min-height`).
- Add scroll reset: on `returnToReservation()`, scroll `.p-dialog-content` to `top` (viewChild `ElementRef`).
- Minor: rename residual `bw-payment-dialog` class (RC5).

## Data Flow

### Read (display) — single source is the instance store

```
calendar ──open(booking)──▶ BookingDetailDialog
   │ store.selectBooking(booking)            │ dialogStore.open(enriched)
   │                                         ▼
   │ ┌─ getClient(id) ──▶ enriched booking ──▶ dialogStore.booking (SOLE booking copy)
   │ │                                         ├─ header reads dialogStore.booking()
   │ │                                         ├─ reserva-tab reads dialogStore.booking()
   │ │                                         └─ patient-card client = dialogStore.booking().client
   │ └─ detailStore.initialize(fullClient) ──▶ ClientDetailStore (client/activeView/notifications/packs/sales/recent)
   │                                             ├─ patient-card badges + notifications
   │                                             └─ patient-detail-content listings
```

### Write (mutate) — dual write, unchanged from today

On status change / time edit / client edit, the dialog writes to BOTH stores:

1. **Instance store** (`dialogStore.replaceBooking(updated)`) → refreshes what the open dialog renders.
2. **Root store** (`store.mergeBooking(updated)`) → updates `BookingStore.bookings[]`, from which `eventsForCalendar` derives → the **calendar** re-renders.

`deleteBooking` is the exception: it writes ONLY to `store.deleteBooking(id)` (root), because deleting immediately calls `close()`, so updating the instance store is pointless.

```
mutate (status/save/client)
   ├──▶ dialogStore.replaceBooking(updated)   // dialog re-render
   └──▶ store.mergeBooking(updated)           // calendar canonical (eventsForCalendar)

delete
   └──▶ store.deleteBooking(id)               // calendar canonical only, then close()
```

**Rule**: read from the instance store; on write, update the instance store (dialog refresh) AND the root store (calendar refresh). Delete is root-only.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `core/stores/client-detail.store.ts` | Modify | Add `{ providedIn: 'root' }` (fixes injection fragility in `booking-form-dialog`); becomes sole owner of activeView/notifications |
| `core/stores/booking-dialog.store.ts` | Modify | Drop `patientView`/`notifications` + related methods; keep booking/bookingId/open/replaceBooking/reset |
| `core/stores/booking.store.ts` | None | Calendar canonical + mutations unchanged |
| `booking-detail-dialog.component.ts` | Modify | Header/reserva read `dialogStore.booking()`; enrich client on open; wire `patientTabSelected` + `patient-detail-content`; scroll reset |
| `booking-detail-dialog.component.html` | Modify | `@switch` → `p-tabs`/`p-tabpanels`; sibling `bw-patient-detail-content` |
| `booking-detail-dialog.component.scss` | Modify | Sticky tablist; scroll container; rename residual class |
| `tabs/reserva/reserva-tab.component.ts` | Modify | Inject `BookingDialogStore`; read `dialogStore.booking()`; add `patientTabSelected` output; write-back via `dialogStore.replaceBooking` + `store.mergeBooking` |
| `tabs/reserva/reserva-tab.component.html` | Modify | `[dialogMode]="true"` + `(patientTabSelected)` on `bw-patient-card`; `[client]="dialogStore.booking()!.client!"` |
| `shared/components/patient-card/*` | None/minimal | `dialogMode` + `patientTabSelected` already supported; drop `dialogStore` mirror in `setNotification` |
| `shared/components/patient-card/patient-detail-content.component.*` | Modify | Wire as sibling; `view` input accepts narrowed `PatientTab` |

## Interfaces / Contracts

- `BookingDialogStore`: `booking`, `bookingId`, `open(booking)`, `replaceBooking(booking)`, `reset()`.
- `ClientDetailStore` unchanged shape; gains nothing but becomes sole owner of `activeView`/`notifications`.
- `ReservaTabComponent` new output: `patientTabSelected = output<PatientTab>()`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `BookingDialogStore` no longer owns patientView/notifications | Assert removed members; `open`/`replaceBooking`/`reset` |
| Unit | Disabled sub-tab logic | `loaded && length===0` matrix in `patient-card.component.spec.ts` |
| Unit | Reserva state preserved across main-tab round-trip | `booking-detail-dialog.component.spec.ts` — switch tabs, assert signals intact |
| Unit | Patient-detail sibling + Volver | `patientTabSelected` emits → `activeView` set → return resets |
| Integration | Enrich client on open | `ClientsApiService.getClient` mocked; assert `dialogStore.booking().client.email` populated |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Rollback = revert commit; `@switch` + prior store wiring restored via git.

## Open Questions

- [ ] Confirm backend list payload actually omits `client.email` (blocked by auth; enrichment makes fix payload-independent).
- [ ] Follow-up change (separate): unify the two shadowing `Booking`/`BookingStatus` interfaces.

## Risks

- **Proposal wording vs code reality (RESOLVED in Decision 1)**: proposal says move client/notifications/packs/activeView into `BookingDialogStore`, but `ClientDetailStore` is shared with `booking-form-dialog`'s `bw-patient-card`; moving would break it. Design keeps the split, with single owners each.
- **Injection fragility (RESOLVED in Decision 1)**: `ClientDetailStore` lacks `providedIn: 'root'`, but `booking-form-dialog` renders `bw-patient-card` without providing it. Fixed by root provisioning.
- **Duplicate `Booking`/`BookingStatus` interfaces** (`responses/bookings.ts` vs `models/index.ts`) shadow each other; latent type bug, flagged as **follow-up (separate change)** — do NOT unify in this change, it would touch 20+ files.
- **Tablist visual regression (RESOLVED post-apply)**: the initial sticky-tablist approach was replaced — the tablist is now fixed (non-scrolling) and the scroll moved to `.p-tabpanels`. See Implementation Notes below.

## Implementation Notes (post-apply corrections)

These refine the decisions above and were validated during manual `ng serve` QA:

1. **Scroll model (supersedes Decision 5)**: `.p-dialog-content` → `overflow: hidden` (container only); the tablist is fixed (`flex-shrink: 0`); the actual scroll lives in `.p-tabpanels` (`overflow-y: auto`). This keeps the main tabbar always visible when the content (e.g. Historial with many rows) is tall. The historial sub-components (`historial-paciente/pagos/reserva`) and `returnToReservation` reference `.p-tabpanels` as the scroll container (for scroll-to-top + infinite scroll).
2. **API shape reality (verified via runtime logs)**: the Laravel backend is inconsistent — `getClient`/`getClientPacks` wrap in `{data:...}`; `getSales`/`getBookings` (with `client_id`) return a FLAT array; `getClientPacksList` returns `{data, meta}`. The dialog's service layer and store now defensively normalize each (`map(r=>r.data)` for the wrapped endpoints; `Array.isArray(res) ? res : res.data ?? []` for the store). Recommend a follow-up to unify the API contract.
3. **Collapsible unification**: "Información adicional" was a PrimeNG `p-panel`; it was replaced with a custom collapsible matching the "Notificaciones" pattern (header + chevron + `--open` class + theme-aware `--bw-50` highlight). The `PanelModule` import was removed.
4. **Header alignment**: `.p-dialog-header` padding `1.25rem 1.5rem 1rem`; `.booking-dialog-header` is now a horizontal row (removed `flex-direction: column`); `.booking-dialog-title-row` uses `align-items: flex-end` so all children (name, RUT chip, service chip, state select) share the same bottom baseline. `.booking-client-rut` additionally uses `align-self: flex-end` (kept flexible, no fixed height) to sit on the baseline; `.booking-service-tag` keeps `height: 2.25rem`; the state select is `height: 2.25rem`. All elements left-aligned (removed `marginLeft:auto` from the select); the PrimeNG close "×" stays top-right.
