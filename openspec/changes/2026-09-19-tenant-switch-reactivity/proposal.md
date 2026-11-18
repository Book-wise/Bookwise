# Proposal: Tenant Switch Reactivity

## Intent

`switchTenant` leaves old tenant data visible: (A) `_user` stale; (B) `scopeProviderId` set once; (C) call sites reload only locations+providers; (D) selection carries over.

## Scope

### In Scope
- New `TenantSwitchService`: owner of "what a business switch means".
- `AuthService.switchTenant` refreshes identity (`setUser`); stays auth-only.
- Type `provider_id` on `AuthMeData`; `scopeProviderId` reactive to `auth.user()`.
- Per-tenant selection memory + scoped pref (see Approach).
- Drop partial reloads from the 4 call sites.

### Out of Scope
- BE **B1** (token/abilities shape, revocation, 401 race) and FE follow-up.
- `switchAccount`; `current_account_id`/`current_tenant_id` typing.

## Capabilities

### New Capabilities
- `tenant-switching`: switching business refreshes identity, reference data, and selection.

### Modified Capabilities
- None — `business-profile`/`onboarding-account` unchanged.

## Approach

- **Coordinator, not coupling**: `TenantSwitchService` (`core/services/tenant-switch.service.ts`) owns the use case, IN ORDER: (1) await `AuthService.switchTenant(tenantId)`; (2) `ReferenceStore.loadAll()` ONCE; (3) resolve the new tenant's selection (location: remembered or first available; provider: remembered or `null` = all). `AuthService` stays auth-only and never imports `ReferenceStore`; `ReferenceStore` never imports `AuthService`. The 4 call sites call the coordinator, the one place that can't be forgotten.
- **Prior reasoning corrected**: the earlier "orchestrator/effect" rejection targeted a REACTIVE/effect design (loses ordering, risks double-load), still rejected. The imperative coordinator is chosen. Tradeoff: one more service.
- **Selection memory is PER TENANT**: a switch restores that tenant's remembered location and provider; with no memory the location defaults to first available and the provider to `null` (all providers); same-tenant navigation remembers the last; clearing the provider returns to all.
- **Pref scoping**: `CalendarPrefsService` keys last-location by user AND tenant (`bw:lastLocationId:<userId>:<tenantId>`), so a remembered id can never resolve to another tenant's location; the chosen mechanism, not clearing on switch. `logout()` MUST clear that user's tenant keys.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `core/services/tenant-switch.service.ts` | New | coordinator |
| `core/services/auth.service.ts` | Modified | identity refresh; logout clears tenant keys |
| `core/services/calendar-prefs.service.ts` | Modified | tenant-scoped key |
| `core/stores/reference.store.ts` | Modified | reload on switch |
| `core/stores/booking.store.ts` | Modified | reactive scope; tenant reset (selection + stale data) |
| `core/models/index.ts` | Modified | type `provider_id` |
| 4 switch call sites | Modified | call coordinator |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Eager `ReferenceStore` init pre-auth | Low | lazy, post-auth call sites |
| Selection pref id collides across tenants | Med | user+tenant-scoped keys |

## Rollback Plan

Revert the feature branch; FE-only, no schema changes.

## Dependencies

- `ReferenceStore.loadAll()` (exists); BE **B1** blocks the token/abilities follow-up.

## Success Criteria

- [ ] Profile shows the new tenant after switch.
- [ ] Agenda scope + services/clients/packs follow the new tenant.
- [ ] Each tenant restores its own remembered location and provider; a first visit defaults to first available location and all providers.
- [ ] No partial reloads remain; suite passes with updated specs.
