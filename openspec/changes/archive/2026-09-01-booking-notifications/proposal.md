# Proposal: Booking Notifications — wire client notification prefs

## Intent

Toggles are in-memory only (4 keys, default `false`). Contract AGREED: per-client GET/PATCH `/api/v1/clients/{id}`, 5 flags 1:1, partial PATCH; sending by carlitox + cron. Wire toggles to those endpoints.

## Scope

### In Scope

- Model: `NotificationPrefs` (5 keys) + fields on `Client`.
- `ClientDetailStore`: 4→5 keys; init from prefs; async `setNotification` → partial PATCH with rollback.
- Patient-card UI: regroup Email 3 + WhatsApp 2, drop `citaWa`, per-flag label + info tooltip; migrate local signals.
- i18n es+en: labels, tooltips, group headers; fix `popover_text`.
- Migrate tests (4-key, no-request); add PATCH/rollback/init coverage.
- Specs: new `client-notifications`; delta `patient-dialog-navigation`.

### Out of Scope

- Sending, timing, re-sending (carlitox + cron).
- `citaWa` / WhatsApp-immediate (product decision).
- `Booking` model changes (prefs live on `Client`).
- PATCH response shape check — resolved in design.

## Capabilities

### New Capabilities

- `client-notifications`: per-client prefs — 5 flags 1:1, init from GET, partial PATCH on toggle, optimistic + rollback.

### Modified Capabilities

- `patient-dialog-navigation`: "pending contract" requirement → active read/write behavior.

## Approach

Exploration Approach 1: structure-A, zero mapping; store is single source of truth. `setNotification` → optimistic `patchState` + `clientsApi.updateClient` (partial PATCH) + `httpError.handle` rollback (`onStatusChange` pattern). UI regrouped 3+2, per-flag tooltips. Design: PATCH shape, `notifications_enabled`, no-dialog signals, defaults.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/core/models/index.ts` | Modified | Types |
| `src/app/core/stores/client-detail.store.ts` | Modified | 5 keys; PATCH |
| `src/app/core/services/api/clients-api.service.ts` | Modified | Unwrap `{data}` |
| `src/app/shared/components/patient-card/patient-card.component.{ts,html}` | Modified | Regroup; drop `citaWa` |
| `src/app/core/i18n/es.ts` + `en.ts` | Modified | Labels/tooltips |
| `booking-detail-dialog.component.ts` | Modified | Feeds prefs |
| Specs/tests (store, card, dialog, api) | Modified | Migrate asserts |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PATCH response shape unverified | Med | Verify in design |
| "no backend request" tests break | Med | Migrate in same change |
| i18n drift / stale `popover_text` | Med | Update es+en together |
| `sameClient` keeps stale prefs | Med | Repopulate on each open |

## Rollback Plan

Revert the change's single commit; old store initializes to empty 4-key state. No data migration (prefs live in backend). Failed PATCH rolls back UI + toast.

## Dependencies

- Backend GET/PATCH `/clients/{id}` exposes `notification_prefs` (agreed, archived).
- Design: PATCH response shape, `notifications_enabled` exposure.

## Success Criteria

- [ ] Toggles init from GET prefs.
- [ ] Toggle → partial PATCH; error rolls back + toast.
- [ ] UI: 3 Email + 2 WhatsApp, label + tooltip, no `citaWa`; es+en consistent.
- [ ] `npx ng test --no-watch` passes with migrated tests.
