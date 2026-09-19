# Delta for Tenant Switching

## Purpose

A business switch MUST atomically refresh identity, reference data, and
selection via a coordinator.

## ADDED Requirements

### Requirement: Identity refreshes on switch

After a switch, `AuthService.user()` MUST reflect the tenant's `name`, `email`,
and `avatar`, and `/auth/me` MUST be refreshed. Identity MUST be set via
`setUser`, never `login()`.

#### Scenario: Profile reflects the new tenant

- GIVEN an admin_general on tenant A
- WHEN they switch to tenant B
- THEN the profile shows tenant B's identity, set via `setUser`, not `login()`

### Requirement: A dedicated coordinator owns the switch

The coordinator MUST run IN ORDER: await the auth switch, reload reference data
once, then resolve the new selection. `AuthService` and `ReferenceStore` MUST
NOT depend on each other; `AuthService` stays auth-only. All entry points MUST
use it.

#### Scenario: Ordered orchestration

- GIVEN a switch to tenant B
- WHEN the coordinator runs
- THEN the auth switch is awaited before the reload
- AND selection resolves after it

#### Scenario: Single full reload, no partials

- GIVEN a successful switch
- WHEN the coordinator completes
- THEN exactly one full reload ran, with no partial reload

### Requirement: Reference data follows the tenant

After a switch the reference store MUST reload once via `loadAll()` (locations,
providers, services, clients, packs).

#### Scenario: All reference entities reload

- GIVEN tenant A data loaded
- WHEN a switch to tenant B succeeds
- THEN all five lists reload from tenant B

### Requirement: Selection memory is per tenant

Selection MUST be remembered per user AND tenant. Location: restore the
remembered one, else first available. Provider: restore the remembered one;
with no memory, default to `null` (all), never first available. Same-tenant
navigation MUST remember the last; clearing the provider MUST return to all.

#### Scenario: Switch restores the remembered selection

- GIVEN tenants A and B remember different locations and providers
- WHEN the active tenant switches to B
- THEN tenant B's remembered location and provider are restored

#### Scenario: Switch to a tenant with no memory defaults

- GIVEN tenant B has no remembered selection
- WHEN the active tenant switches to B
- THEN B's first available location is selected
- AND the provider is `null` (all providers)

#### Scenario: Same-tenant navigation remembers

- GIVEN a selection in tenant B
- WHEN the user navigates away and back without switching
- THEN the last location and provider are restored

#### Scenario: No prior selection defaults

- GIVEN no prior selection anywhere
- WHEN the agenda initializes
- THEN the first available location is selected
- AND the provider is `null` (all providers)

#### Scenario: Provider selection can be cleared

- GIVEN a provider selected in tenant B
- WHEN the user clears it
- THEN the provider is `null` (all), remembered as cleared

### Requirement: Persisted preference is tenant-scoped

Selection prefs MUST be scoped by user AND tenant
(`bw:lastLocationId:<userId>:<tenantId>`). Logout MUST clear the user's
tenant-scoped keys.

#### Scenario: Stale id cannot resolve cross-tenant

- GIVEN a remembered location id from tenant A
- WHEN tenant B has a location with the same numeric id
- THEN the remembered id is NOT applied to tenant B

#### Scenario: Logout clears the tenant-scoped keys

- GIVEN a user with tenant-scoped preferences
- WHEN they log out
- THEN every tenant-scoped preference is removed

### Requirement: Booking scope is reactive

The booking scope provider id MUST derive reactively from the authenticated
user identity.

#### Scenario: Scope follows the user

- GIVEN a provider-scoped user whose provider id changes on switch
- WHEN the identity updates after a switch
- THEN the scope provider id reflects the new identity
- AND the agenda re-scopes without store re-initialization

## Out of Scope

- Backend **B1**: switch responses returning `{ token, user, abilities }`,
  old-token revocation, and the 401 race.
- `switchAccount`: no frontend implementation or UI.
