# Design: Tenant Switch Reactivity

## Technical Approach

An imperative coordinator (`TenantSwitchService`) owns the switch use case, in order: (1) `AuthService.switchTenant` (identity only, no navigation), (2) exactly one `ReferenceStore.reloadAll()`, (3) selection resolution, (4) `BookingStore` tenant reset + `lastSwitch` publication. `AuthService` stays auth-only (never imports `ReferenceStore`); `ReferenceStore` never imports `AuthService`. Selection memory is per `(userId, tenantId)`; the provider default is `null` (all); `BookingStore.scopeProviderId` becomes derived. All 4 entry points delegate to the coordinator and drop their partial reloads.

## Architecture Decisions

### D1 — Coordinator API and error propagation

```ts
// core/services/tenant-switch.service.ts
export interface TenantSwitchResult {
  userId: number | null; tenantId: number;
  locationId: number | null; providerId: number | null;
}
@Injectable({ providedIn: 'root' })
export class TenantSwitchService {
  readonly lastSwitch = signal<TenantSwitchResult | null>(null);
  switchTenant(tenantId: number): Observable<void>;
}
```

`Observable<void>` completes after all steps. **Errors propagate**: an `auth.switchTenant` failure rejects it (no `catchError` in the coordinator), so call sites keep their `switchTenantErrorKey(err)` toast. Reference-load errors stay non-fatal via the store's per-entity `catchError`.

### D2 — No eager pre-auth load

Entry points inject **only `TenantSwitchService`**; none injects `ReferenceStore`. The coordinator resolves the store **lazily inside `switchTenant()`** via `this.injector.get(ReferenceStore)` — never a field initializer or constructor parameter — so constructing the coordinator cannot construct the store. `AuthService` never imports `ReferenceStore`; `ReferenceStore` never imports `AuthService`.

### D3 — Logout cleanup

**Prefix enumeration**, not a tracked-key index. `CalendarPrefsService.clearForUser(userId)` removes every `localStorage` key prefixed `bw:lastLocationId:<userId>:` or `bw:lastProviderId:<userId>:`, plus legacy `bw:lastLocationId:<userId>`. Rejected: a tracked-key index (drifts, leaks); enumerating `me().businesses` (fails when `me` is null at logout). `AuthService.logout()` calls `clearForUser(userId)` instead of `setLastLocationId(userId, null)`.

### D4 — Selection restore/reset owner

**Single owner of switch-time restore/reset: `TenantSwitchService`.** Steady-state edits stay in `full-calendar.component`. Handoff: `lastSwitch` (mounted agenda) + tenant-scoped prefs (unmounted agenda / reload).

| Case | Location | Provider |
|------|----------|----------|
| memory valid/active | remembered | remembered |
| memory stale or absent | first active | `null` (all) |
| none available | `null` | `null` (all) |

C2/attention-role filtering stays in the agenda (`hasAttentionRole`), so the coordinator resolves the location and carries provider memory; the agenda reconciles the provider, treating `null` as "all providers". `BookingStore` never computes selection. `resetTenantState()` clears the selection **and** `bookings`/`blockedSlots`/`selectedBookingId`: the agenda skips reloading when range and selection are unchanged (`fetchEventsForCalendar`'s guard), so a same-numeric-id tenant would otherwise render the previous tenant's bookings — a cross-tenant correctness guard, not convenience.

### D5 — `scopeProviderId` reactivity

Remove stored `filters.scopeProviderId`; derive it:

```ts
withComputed((store, auth = inject(AuthService)) => ({
  scopeProviderId: computed(() =>
    auth.user()?.role === 'provider' ? (auth.user()?.provider_id ?? null) : null),
  isProviderRole: computed(() => store.scopeProviderId() !== null),
}))
```

Remove it from `FilterState`, `initialFilters`, and `setFilters`'s guard. Rejected: an `effect` patching state (write-after-read, loop-prone); a `computed` has no side effects, so only the agenda's refetch triggers loads.

### D6 — Single `reloadAll()`, structurally

(a) All `loadLocations()`/`loadProviders()` calls are removed from the 4 entry points — the coordinator is the only switch-path loader. (b) `reloadAll()` memoizes its in-flight `forkJoin` (`shareReplay(1)` + `finalize` reset), so concurrent callers join one round-trip; it reloads the five tenant lists (locations, providers, services, clients, packs; regions/comunas are geography and excluded) and clears them first, so a failed load cannot leak the previous tenant's data. (c) `onInit`'s `loadAll()` stays the app-initial load, fired when a post-auth feature first constructs the store; it is **not** a precondition for a switch, since `reloadAll()` is self-sufficient. Every entry point is reachable only post-auth: `profile`/`businesses-list` under `/admin` (`roleGuard(['admin'])` + `onboardingGuard`); `account-menu`/`app-header` mounted only by `AdminLayoutComponent` (`/admin`) and `ProviderLayoutComponent` (`/provider`, `roleGuard(['provider'])`). `roleGuard` redirects to `/login` when `userRole()` is null.

### D7 — Typing and `AuthMeData → User`

Add `provider_id?: number | null` to `AuthMeData`. `AuthService` gains `private toUser(me: AuthMeData): User` mapping `id, email, name, phone, avatar_url, role, provider_id, tenant_id, email_verified_at, onboarding_complete, business`. `switchTenant` calls `setUser(this.toUser(me))`, never `login()`.

### D8 — Testing strategy

Standard Mode (strict TDD off); `npx ng test --no-watch`.

- **New** `tenant-switch.service.spec.ts`: ordering (auth → reload → selection), one reload, auth error propagates, no reload/selection on failure, resolution rules, `lastSwitch`.
- **Changed** `auth.service.spec.ts`: `switchTenant` sets `_me` + `setUser`, does not navigate; `logout` calls `clearForUser`.
- **Changed** `calendar-prefs.service.spec.ts`: `(userId, tenantId)` signatures, tenant isolation, `clearForUser` removes tenant + legacy keys, leaves other users.
- **Changed** `booking.store.spec.ts`: derived `scopeProviderId` updates when `authUser` changes; `setFilters` rejects it; `resetTenantState`.
- **Changed** `reference.store.spec.ts`: keep `onInit`; add `reloadAll()` (five lists once, coalescing, clears stale, non-fatal errors).
- **Changed** `profile.component.spec.ts`: `switchTo` delegates to the coordinator, no `refStore` reloads, toasts.
- **Changed** `full-calendar.component.spec.ts`: `lastSwitch` effect re-applies selection; tenant-scoped pref read/write.
- **New, thin** call-site specs: `account-menu`, `app-header`, `businesses-list` delegate `switchTo`.

## Data Flow

```
account-menu | app-header | profile | businesses-list
                  └───────────┬───────────┘
                              ▼
                TenantSwitchService.switchTenant(id)
   1. AuthService.switchTenant(id) ──► setMe + setUser (NO navigate)
   2. ReferenceStore.reloadAll()  ──► ONE forkJoin (5 tenant lists)
   3. resolveSelection(userId, tenantId) ──► tenant-scoped prefs
   4. BookingStore.resetTenantState() + lastSwitch.set(result)
                              │
             ┌────────────────┴────────────────┐
             ▼                                 ▼
   mounted full-calendar             unmounted → tenant-scoped
   (effect on lastSwitch)            pref applied on next mount
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `core/services/tenant-switch.service.ts` | Create | Coordinator: ordered switch, lazy store, `lastSwitch` |
| `core/services/auth.service.ts` | Modify | `switchTenant` sets user via `toUser`; `logout` uses `clearForUser` |
| `core/services/calendar-prefs.service.ts` | Modify | `(userId, tenantId)` keys, provider key, `clearForUser` |
| `core/stores/reference.store.ts` | Modify | awaitable, coalesced `reloadAll()`; clear-before-load |
| `core/stores/booking.store.ts` | Modify | derived `scopeProviderId`; `resetTenantState()` (selection + stale data) |
| `core/models/index.ts` | Modify | `provider_id` on `AuthMeData` |
| `account-menu`, `app-header`, `profile`, `businesses-list` | Modify | inject coordinator only; drop `ReferenceStore` + partial reloads |
| `features/admin/calendar/full-calendar.component.ts` | Modify | `lastSwitch` effect; tenant-scoped pref read/write |

## Interfaces / Contracts

```ts
// CalendarPrefsService
getLastLocationId(userId: number | null, tenantId: number | null): number | null;
setLastLocationId(userId: number | null, tenantId: number | null, locationId: number | null): void;
getLastProviderId(userId: number | null, tenantId: number | null): number | null;
setLastProviderId(userId: number | null, tenantId: number | null, providerId: number | null): void;
clearForUser(userId: number): void;

// ReferenceStore
loadAll(): void;                    // onInit app-initial fan-out (5 tenant lists + regions)
reloadAll(): Observable<void>;      // switch path: 5 tenant lists, coalesced, clear-first

// BookingStore
resetTenantState(): void;           // clears bookings/blockedSlots/selectedBookingId + selection
```

**Naming mapping**: `loadAll()` is today's `rxMethod<void>` fired by `onInit` — a fire-and-forget fan-out of six loads, no awaitable handle, no clearing. `reloadAll()` is the switch reload: awaitable, coalesced, clear-first. The spec's "reload once via `loadAll()`" is realized by `reloadAll()`; `loadAll()` keeps its app-initial role.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, or process-integration boundary. DI + client state only.

## Migration / Rollout

No migration; FE-only. Legacy `bw:lastLocationId:<userId>` keys become inert and are removed on next logout. Rollback: revert the feature branch.

## Open Questions

None. The first-visit provider default is `null` ("all providers"), matching
current admin behavior; the user is never forced into a provider.
