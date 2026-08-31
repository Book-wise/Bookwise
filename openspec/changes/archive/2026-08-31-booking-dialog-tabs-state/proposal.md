# Proposal: booking-dialog-tabs-state

## Intent

Fix the reservation detail dialog (`bw-booking-detail-dialog`) tab navigation so that:

1. The `Reserva` tab preserves local state (date/time/professional/notes) when navigating to patient sub-tabs (Planes/Sesiones/Prepagado/Recientes) and back.
2. The patient card shows email/phone and the notifications block.
3. `Reserva` stays correctly marked active when returning from `Historial`.
4. Patient sub-tabs fill the whole `p-dialog-content` and can return without losing state.

Root causes verified in exploration: `@switch(activeTab())` destroys/recreates tabs; two booking sources of truth (`BookingStore` root vs `BookingDialogStore` snapshot); patient-card rendered without `dialogMode`; orphaned `bw-patient-detail-content`.

## Scope

### In Scope
- Consolidate booking/client/notifications/packs/sales/recent + activeView into `BookingDialogStore` as single source of truth (reserva-tab stops reading `BookingStore` root).
- Replace `@switch(activeTab())` with `p-tabs`/`p-tabpanel` (native keep-alive, `lazy=false`) wrapping header + body.
- `[dialogMode]="true"` on reserva-tab patient-card; wire `bw-patient-detail-content` as level-1 sibling filling `p-dialog-content`.
- Sub-tab buttons always visible, `disabled` when category has no data; always reload sub-tab data on open; reset scroll on return.
- Verify `getBookings` client payload for email/phone (bug #2).

### Out of Scope
- Cosmetic cleanup of residual `bw-payment-dialog` (unless trivial).
- Sub-tab edit/charge/reschedule actions (read-only today; architecture must leave room).

## Capabilities

### New Capabilities
- `booking-dialog-navigation`: main-tab keep-alive state preservation and single booking source of truth in the dialog.

### Modified Capabilities
- `patient-dialog-navigation`: unsaved edits are now PRESERVED on return (replaces the "discarded" scenario); add fresh-reload, disabled-button, and scroll-reset requirements.

## Approach

- **A — state consolidation**: `BookingDialogStore` becomes sole owner for booking + client + notifications + packs/sales/recent + activeView.
- **B — keep-alive**: replace `@switch(activeTab())` with `p-tabs`/`p-tabpanels`; preserve `@if (visible())` reset-on-close.
- **C — patient detail**: `[dialogMode]="true"` + bind `(patientTabSelected)`; render `bw-patient-detail-content` as full-content sibling.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `booking-detail-dialog.component.{ts,html,scss}` | Modified | `@switch`→`p-tabpanels`, wire `patientTabSelected` + `bw-patient-detail-content` |
| `tabs/reserva/reserva-tab.component.{ts,html}` | Modified | `dialogMode`, single source of truth |
| `core/stores/booking-dialog.store.ts` | Modified | consolidate state |
| `core/stores/booking.store.ts` | Modified | canonical reference only |
| `shared/components/patient-card/*` | None/minimal | already supports `dialogMode` |
| `shared/components/patient-card/patient-detail-content.component.*` | Modified | wire into dialog |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Spec change "discard"→"preserve" alters documented behavior | High | Explicit delta spec; product decision recorded |
| Tablist visual regression (SCSS calibrated for header) | Med | Visual check; preserve reset-on-close |
| Bug #2 may need `getBookings` payload fix, not template | Med | Verify API payload first |
| Double-source consolidation breaks `deleteBooking` | Med | Footer/delete reads canonical store; tests |

## Rollback Plan

Revert the change commit; `@switch` and prior store wiring restore via git. No schema or migration.

## Dependencies

- Exploration: `openspec/changes/booking-dialog-tabs-state/exploration.md`.

## Success Criteria

- [ ] Reserva keeps date/time/professional/notes after patient sub-tab round-trip.
- [ ] Patient card shows email/phone + notifications.
- [ ] Reserva active after returning from Historial.
- [ ] Sub-tabs fill `p-dialog-content` and return without state loss.
