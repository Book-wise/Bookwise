## Exploration: patient-dialog-navigation

### Current State
`BookingDetailDialogComponent` renders the PrimeNG dialog, including the `bw-payment-dialog` root class, header, main booking tabs, footer, and a single `@switch` for `p-dialog-content`. The `reserva` case creates `ReservaTabComponent`, which renders `bw-patient-card` with the booking's nested client.

`PatientCardComponent` currently owns its internal navigation (`PatientTab = 'planes' | 'sesiones' | 'prepago' | 'recientes'`) and replaces its own card body with the selected detail panel. The four detail views are inline in the patient-card template; data loading is delegated to the component-scoped `ClientDetailStore` supplied by `BookingDetailDialogComponent`. Notification checkbox values are local signals on `PatientCardComponent`, so destroying that component during dialog-content navigation would lose them.

`ReservaTabComponent` owns reservation form signals and initializes them from `BookingStore.selectedBooking()` only when the selected booking id changes. Saving refreshes and merges the persisted booking, then shows the existing success toast. Because unsaved reservation edits are local to this component, replacing it and creating a fresh instance naturally restores the persisted booking values, provided the root booking selection is not changed.

The model provides two relevant client shapes: the application-wide `Client` model and the nested `Booking.client` value. The current dialog reads the nested booking client directly in both the reservation card and patient tab. The existing `ClientDetailStore` has no consolidated client snapshot, navigation state, or notification state, but it is already isolated by the dialog's component-level provider and already exposes reset behavior for detail data.

The existing patient-card spec contains a baseline mismatch: it expects `activeTab`, `selectTab`, and `backToTabs`, while the implementation exposes `panelTab`, `openPanel`, and `closePanel`. This must be accounted for in later test work rather than treated as evidence of current behavior.

### Affected Areas
- `src/app/features/admin/bookings/booking-detail-dialog/booking-detail-dialog.component.ts` — owns the dialog-scoped store, main-tab header, open/close lifecycle, and should coordinate typed patient-content navigation and reset state.
- `src/app/features/admin/bookings/booking-detail-dialog/booking-detail-dialog.component.html` — must keep the header and main tabs outside the content switch while switching only the `p-dialog-content` body between reservation and patient detail views.
- `src/app/features/admin/bookings/booking-detail-dialog/tabs/reserva/reserva-tab.component.ts` — currently owns transient reservation edits and must expose or participate in the single typed patient-tab flow without changing the save/toast behavior.
- `src/app/features/admin/bookings/booking-detail-dialog/tabs/reserva/reserva-tab.component.html` — currently embeds `bw-patient-card`; its patient-card integration must emit or delegate all four typed tabs to the dialog-level navigation.
- `src/app/shared/components/patient-card/patient-card.component.ts` — currently owns panel navigation and notification checkbox signals; navigation should become an output/delegation boundary, while notification values need dialog-scoped persistence.
- `src/app/shared/components/patient-card/patient-card.component.html` — currently renders all four detail bodies inside the card; those bodies need to be reusable from the dialog content area, with a “Volver a la reserva” action.
- `src/app/core/stores/client-detail.store.ts` — existing component-scoped store is the natural location for the consolidated patient snapshot, typed patient navigation state, notification checkbox values, detail data, and lifecycle reset/initialization.
- `src/app/shared/components/patient-card/patient-card.component.spec.ts` — tests must be aligned with the current API and expanded for all four tabs, notification persistence, and the typed output flow; the known baseline member mismatch is already present.
- `src/app/features/admin/bookings/booking-detail-dialog/` — likely needs focused patient-detail components or a reusable detail-content component extracted from the current inline patient-card panel markup; no existing booking-detail dialog spec was found.

### Approaches
1. **Dialog-level typed state with extracted patient detail content (recommended)** — keep `BookingDetailDialogComponent` as the content/navigation orchestrator, introduce one typed `PatientTab` flow for all four tabs, and extract the existing four detail bodies into reusable detail components or a shared patient-detail content component. Store the consolidated client snapshot, active patient tab, notification checkbox values, and detail caches in the dialog-scoped `ClientDetailStore`. The patient card emits a typed selection; the reservation tab forwards it; the dialog changes only its content state. Returning selects the reservation view, recreating `ReservaTabComponent` from the unchanged persisted `BookingStore` selection.
   - Pros: directly satisfies the header/content boundary; preserves the existing dialog lifecycle; guarantees one flow for all four tabs; component-scoped state matches the approved isolation; naturally discards unsaved reservation edits; avoids duplicating API/detail loading logic.
   - Cons: requires extracting or reorganizing the current inline panel markup and adding dialog-level integration tests; the shared patient card must remain compatible with its booking-form-dialog consumer.
   - Effort: Medium

2. **Keep navigation inside `PatientCardComponent` and project the card body upward** — retain the current panel state and inline detail rendering, but use content projection or an output plus conditional styling to make the card visually occupy the dialog content area.
   - Pros: smaller initial change and less movement of existing detail markup.
   - Cons: the dialog cannot cleanly own the `p-dialog-content` replacement; the card remains responsible for dialog navigation semantics; preserving state across component destruction becomes awkward; it weakens the single typed flow and risks coupling the reusable card to this dialog.
   - Effort: Medium

3. **Use a nested PrimeNG dialog or overlay for patient details** — leave reservation content mounted and open each patient detail in a second overlay.
   - Pros: reservation edits and card-local state remain mounted automatically; minimal extraction of existing panel markup.
   - Cons: violates the explicit requirement that only `p-dialog-content` be replaced; introduces focus, stacking, accessibility, and responsive-dialog complexity; header/main tabs would not describe the visible content consistently.
   - Effort: High

### Recommendation
Use the dialog-level typed state approach. The existing `BookingDetailDialogComponent` already provides the correct lifetime boundary for the approved per-open-dialog store, and its template already separates the persistent header from the content switch. Move only navigation and notification persistence into that boundary; keep reservation edits local to `ReservaTabComponent`, so navigating away destroys unsaved edits and returning reads the original persisted booking from `BookingStore`. Initialize the store from one consolidated `Client` snapshot when a reservation opens, reset it when the dialog closes or another reservation opens, and do not reset it on patient-tab changes. Keep notification accordion expansion local, while storing the four checkbox values.

The implementation should preserve the current save path and success toast: a saved reservation is merged into `BookingStore`, so a later return reads the refreshed persisted values; an unsaved edit is never merged and is therefore discarded. The detail components should receive the consolidated client snapshot rather than reconstructing patient identity independently from several sources. All four tabs must use the same `PatientTab` union and selection handler, with no separate per-tab navigation APIs.

### Risks
- Extracting the inline panel markup can change existing visual behavior or lazy-loading triggers; preserve the current `ClientDetailStore` loading guards and verify each of the four views.
- `ClientDetailStore` is component-scoped only when resolved below `BookingDetailDialogComponent`; changes must not accidentally make `booking-form-dialog` patient cards share notification or navigation state.
- Store initialization and reset must distinguish opening another reservation from switching patient tabs; resetting on every content change would lose checkbox values and cached detail data.
- The dialog currently uses a root `BookingStore`, so return behavior depends on leaving `selectedBookingId` intact while changing only patient-content navigation.
- There is no covering spec for `ReservaTabComponent` or `BookingDetailDialogComponent`, and the patient-card spec has stale API expectations; focused tests will be required before relying on regression coverage.

### Ready for Proposal
Yes. The requirements are sufficiently resolved and the recommended architecture is clear. The next phase should define the exact proposal scope, including the dialog-scoped store contract, extracted detail-content boundaries, lifecycle reset rules, and test slices while preserving the existing OpenSpec artifacts unchanged.
