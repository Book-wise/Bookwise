# Proposal: Patient Dialog Navigation

## Intent

Let staff inspect patient details without losing dialog context or persisted reservation data. Replace only `p-dialog-content`; keep header and tabs visible.

## Scope

### In Scope
- Dialog-level navigation for `planes`, `sesiones`, `prepago`, and `recientes`, entered only through `bw-patient-card`.
- “Volver a la reserva” restoration in the same content area; keep `Reserva` selected in the main tabs.
- Consolidated dialog-scoped state for persisted patient data, notification values, active tab, and detail caches.
- Persisted reservation restoration on return; discard unsaved edits and preserve the save toast flow.
- Focused tests for tabs, return, notifications, and lifecycle isolation.

### Out of Scope
- Application implementation in this phase.
- New backend endpoints or an unconfirmed notification persistence API.
- Accordion persistence, unsaved-edit preservation, booking-save changes, or unrelated OpenSpec artifacts.

## Capabilities

### New Capabilities
- `patient-dialog-navigation`: Navigation, content replacement, lifecycle, and reservation restoration.

### Modified Capabilities
- None.

## Approach

Make `BookingDetailDialogComponent` the orchestrator and use its component-scoped `ClientDetailStore` as the per-dialog boundary. Extract the four detail bodies into reusable content. The card emits one typed `PatientTab`; the reservation tab forwards it; the dialog changes content without changing the booking. Initialize from a snapshot on open, reset on close or another reservation, and not on internal-tab changes. Store checkbox values; keep accordion expansion local. Define backend persistence before implementation; do not invent an endpoint.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `booking-detail-dialog/` | Modified | Content boundary, lifecycle, tests. |
| `tabs/reserva/` | Modified | Navigation forwarding; preserve save/toast behavior. |
| `shared/components/patient-card/` | Modified | Typed output and reusable content. |
| `core/stores/client-detail.store.ts` | Modified | Snapshot, navigation, notifications, reset rules. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Detail extraction changes visuals/loading | Med | Preserve guards; test all views. |
| State leaks or resets incorrectly | Med | Test close, reservation switch, tab changes, and other consumers. |
| Notification contract is incomplete | High | Block endpoint work pending agreement. |

## Rollback Plan

Revert the commit to restore card-local navigation and the current dialog template. No migration is required; disable notification persistence until its contract exists.

## Dependencies

- Confirmed backend persistence contract for notification checkbox values.
- Existing `BookingStore` persisted selection and save/refresh flow.

## Success Criteria

- [ ] All four tabs replace only `p-dialog-content`; header and main tabs remain visible.
- [ ] Return restores persisted reservation data and discards unsaved edits; saved changes retain the existing toast.
- [ ] Checkbox values survive internal navigation; accordion expansion does not.
- [ ] State resets on close/another reservation, not internal-tab changes, with no cross-dialog leakage.
