# Tasks: Tenant Switch Reactivity

## Review Workload Forecast

Estimated changed lines: ~1050–1150

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

### Suggested Work Units

| Unit | PR | Focused test | Runtime harness | Rollback boundary |
|------|----|--------------|-----------------|-------------------|
| 1 Foundation: identity, tenant prefs, logout cleanup | PR1 | `npx ng test --no-watch` | `npx ng serve` logout/login | `models`, `calendar-prefs`, `auth.service`, `full-calendar` pref calls |
| 2 `ReferenceStore.reloadAll()` | PR2 | `npx ng test --no-watch` | N/A — not wired | `reference.store.ts` + spec |
| 3 Derived scope + `resetTenantState()` | PR3 | `npx ng test --no-watch` | N/A — unit-verified | `booking.store.ts` + spec |
| 4 `TenantSwitchService` | PR4 | `npx ng test --no-watch` | N/A — not wired | `tenant-switch.service.ts` + spec |
| 5 Wire entry points + agenda effect | PR5 | `npx ng test --no-watch` | `npx ng serve` switch business | 4 call sites, `full-calendar`, specs |
| 6 Backend B1 adaptation: token rotation + stale-token 401 | PR6 | `npx ng test --no-watch` | `npx ng serve` switch business (multi-tab) | `auth-api.service`, `auth.service`, `auth.interceptor`, `models` + specs |

Bases: PR1=tracker, PRn=PR(n-1).

## Phase 1: Foundation — identity + tenant prefs (PR1)

- [x] 1.1 `core/models/index.ts`: add `provider_id?: number | null` to `AuthMeData` (R6; D7).
- [x] 1.2 `calendar-prefs.service.ts`: keys `(userId, tenantId)`; provider get/set (`bw:lastProviderId:<userId>:<tenantId>`); `clearForUser` prefix enumeration incl. legacy (R4, R5; D3).
- [x] 1.3 `calendar-prefs.service.spec.ts`: tenant isolation, provider key, `clearForUser` removes tenant+legacy, leaves others (R5).
- [x] 1.4 `auth.service.ts`: add `toUser`; `switchTenant` sets `_me`+`setUser(toUser(me))` (no `login()`); `logout` calls `clearForUser(userId)` (R1, R5; D3, D7).
- [x] 1.5 `auth.service.spec.ts`: switchTenant sets `_me`+`setUser`, no navigation; logout calls `clearForUser` (R1, R5).
- [x] 1.6 `full-calendar.component.ts`: update pref calls to `(userId, tenantId)` signatures (compile fix) (R5).

## Phase 2: Reference reload (PR2)

- [x] 2.1 `reference.store.ts`: add `reloadAll(): Observable<void>` — clear five tenant lists, `forkJoin` five loaders, `shareReplay(1)` + `finalize` reset; keep `loadAll()`/`onInit` (R3; D6).
- [x] 2.2 `reference.store.spec.ts`: five lists once, concurrent coalescing, clears stale, non-fatal errors, onInit unchanged (R3).

## Phase 3: Reactive booking scope + reset (PR3)

- [x] 3.1 `booking.store.ts`: remove `scopeProviderId` from `FilterState`/`initialFilters`/`setFilters`; derive via `withComputed` from `auth.user()`; drop onInit patch (R6; D5).
- [x] 3.2 `booking.store.ts`: add `resetTenantState()` clearing `bookings`/`blockedSlots`/`selectedBookingId` + selection (R2, R4; D4).
- [x] 3.3 `booking.store.spec.ts`: derived scope on auth change; `setFilters` rejects it; `resetTenantState` (R6; D4/D5).

## Phase 4: Coordinator (PR4)

- [x] 4.1 Create `core/services/tenant-switch.service.ts`: `lastSwitch`, `switchTenant(tenantId): Observable<void>`, lazy `injector.get(ReferenceStore)`; auth → one `reloadAll` → resolve selection (location remembered/first active, provider remembered/`null`) → `resetTenantState()` + `lastSwitch.set` (R2, R3, R4; D1–D4).
- [x] 4.2 Create `tenant-switch.service.spec.ts`: ordering, one reload, auth error propagates without reload/selection, resolution rules, `lastSwitch` (R2; D8).

## Phase 5: Wiring entry points + agenda (PR5)

- [x] 5.1 `account-menu`, `app-header`, `businesses-list`: inject `TenantSwitchService`; remove `ReferenceStore` + partial reloads; delegate `switchTo`, keep toasts (R2; D2, D6).
- [x] 5.2 `profile.component.ts`: `switchTo` delegates to coordinator; drop partial reloads; retain `refStore` reads (counts/timezone) (R2; D2, D6).
- [x] 5.3 `full-calendar.component.ts`: effect on `tenantSwitch.lastSwitch()` re-applies selection; persist/read provider memory (R4; D4).
- [x] 5.4 Update `profile.component.spec.ts` + `full-calendar.component.spec.ts`; new thin specs `account-menu`, `app-header`, `businesses-list` (R1, R2, R4; D8).

## Phase 6: Backend B1 adaptation — token rotation (PR6)

Implements the item `design.md` lists under **Out of Scope** ("Backend B1: switch responses returning `{ token, user, abilities }`, old-token revocation, and the 401 race"). The backend now rotates the token on every switch and revokes the old one.

- [x] 6.1 `core/models/index.ts`: add `AuthSwitchResponse { token, user: AuthMeData, abilities: string[] }` (abilities TOP-LEVEL).
- [x] 6.2 `auth-api.service.ts`: `switchTenant` returns the full `{ token, user, abilities }` payload instead of unwrapping `user`. (`switchAccount` does not exist in the frontend — skipped.)
- [x] 6.3 `auth.service.ts`: `switchTenant` adopts the rotated session — `setToken(res.token)`, `_me`/`_meLoaded`, `setUser(toUser(res.user))`, `_abilities.set(res.abilities ?? [])`; never `login()`. Add `abilities` signal + `hasAbility()`; clear abilities on `logout`.
- [x] 6.4 `auth.service.ts`: make `getStoredToken()` public and add `syncTokenFromStorage()` for cross-tab recovery (interceptor must compare against the PERSISTED token, not the in-memory signal).
- [x] 6.5 `auth.interceptor.ts`: on 401, compare the request's `Authorization` token against the persisted token — differ → stale token, do NOT logout, re-sync; equal/absent → genuine, `logout()` as before.
- [x] 6.6 Specs: `auth.service.spec.ts` (rotated token adoption, abilities, persisted-token accessor), `auth-api.service.spec.ts` (payload shape), new `auth.interceptor.spec.ts` (stale 401 no logout + re-sync; genuine 401 logs out).
