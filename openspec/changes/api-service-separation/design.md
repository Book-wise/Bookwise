# Design: ApiService Separation

## Technical Approach

Extract the monolithic `ApiService` (~359 L, 39 methods) into 7 standalone domain services under `src/app/core/services/api/`, one per bounded context. Each service gets exact copies of its methods with identical signatures, HTTP verbs, URL paths, and response types. This is a **mechanical refactor** — zero behavioral change. Consumers are migrated one-by-one, and `ApiService` is deleted only after the last consumer is gone.

## Architecture Decisions

### Decision: File structure

| Option | Tradeoff | Choice |
|--------|----------|--------|
| Flat in `services/` | Pollutes directory with 7 new files alongside existing services | ❌ |
| `services/api/` subdirectory | Clean grouping, easy to exclude from code review scans | ✅ |
| `services/api/domain-name-api.service.ts` | Consistent naming, self-documenting | ✅ |

**Result**: 7 files at `src/app/core/services/api/{domain}-api.service.ts`

### Decision: Base class vs standalone

| Option | Tradeoff | Choice |
|--------|----------|--------|
| Abstract base class (`BaseApiService`) | DRY for `baseUrl` + `http` injection; but adds indirection, makes tree-shaking harder, and differs from project conventions | ❌ |
| Standalone `providedIn: 'root'` | Matches existing service pattern (`auth.service.ts`, `theme.service.ts`), independently testable, no coupling | ✅ |

**Result**: Each service is standalone. The `baseUrl` + `HttpClient` injection is 2 lines — acceptable repetition (7 × 2 = 14 lines) vs the complexity of a base class.

### Decision: Shared HttpParams builder

| Option | Tradeoff | Choice |
|--------|----------|--------|
| Inline `HttpParams` construction in each method | ~7 methods repeat the same `Object.entries(...).forEach(...set)` pattern | ❌ |
| Extract `buildHttpParams(obj)` utility | Single 5-line helper, imported only where needed, no DI overhead | ✅ |

**Result**: Create `src/app/core/services/api/build-http-params.ts` with a pure function `buildHttpParams(obj: Record<string, any>): HttpParams`. Each domain service imports it where needed — zero coupling, pure tree-shakeable.

### Decision: SalesApiService vs within BookingsApiService

| Option | Tradeoff | Choice |
|--------|----------|--------|
| Sales methods inside BookingsApiService | Spec originally listed them together; fewer files | ❌ |
| Separate SalesApiService | Sales/transactions are a distinct bounded context; independent evolution; avoids bloating BookingsApiService to 13 methods | ✅ |

**Result**: Create `sales-api.service.ts` with sales + transactions methods. BookingsApiService covers only bookings + available slots.

### Decision: Consumer migration strategy

| Option | Tradeoff | Choice |
|--------|----------|--------|
| Batch (all 22 at once) | One massive diff, hard to review, risky rollback | ❌ |
| One-by-one with BAT (Bulk ApiService Termination) | Each migration is an isolated commit; `ApiService` stays alive as fallback until the last consumer; clear finish line | ✅ |

**Result**: Migrate one consumer per commit. `ApiService` is deleted in a final commit only after `grep -r 'ApiService' src/` returns nothing for source files.

### Decision: Test mock update strategy

| Option | Tradeoff | Choice |
|--------|----------|--------|
| Refactor all 4 spec providers at once | Tests broken until migration completes | ❌ |
| Migrate spec alongside its consumer | Each consumer commit keeps its tests green by swapping the provide token | ✅ |

**Result**: When migrating consumer X, its spec's `{ provide: ApiService, useValue: mock }` becomes `{ provide: BookingsApiService, useValue: mock }`. The mock object exposes only the methods that consumer actually calls.

## Data Flow

```
Consumer (component/store)
    │  injects DomainApiService (not ApiService)
    ▼
DomainApiService  (7 services, each providedIn: 'root')
    │  this.http.get|post|patch|delete(`${this.baseUrl}/path`, ...)
    ▼
HttpClient  →  API Backend (127.0.0.1:9999/api/v1)
```

No interceptors, no caching, no error transformation — identical to current flow.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/core/services/api/locations-api.service.ts` | Create | Locations + Regions + Comunas methods (9 methods) |
| `src/app/core/services/api/auth-api.service.ts` | Create | `login`, `register` (2 methods) |
| `src/app/core/services/api/providers-api.service.ts` | Create | Full CRUD on providers (4 methods) |
| `src/app/core/services/api/services-api.service.ts` | Create | Services + Packs methods (5 methods) |
| `src/app/core/services/api/clients-api.service.ts` | Create | Clients + ClientPacks methods (7 methods) |
| `src/app/core/services/api/blocked-slots-api.service.ts` | Create | Blocked slots CRUD + group delete (5 methods) |
| `src/app/core/services/api/bookings-api.service.ts` | Create | Bookings + AvailableSlots methods (6 methods) |
| `src/app/core/services/api/sales-api.service.ts` | Create | Sales + Transactions methods (7 methods) |
| `src/app/core/services/api/build-http-params.ts` | Create | Pure function `buildHttpParams(obj)` — shared HttpParams helper |
| `src/app/core/services/api.service.ts` | Delete | After last consumer is migrated |
| 22 consumer `.ts` files | Modify | Swap `inject(ApiService)` → `inject(SpecificApiService)` |
| 4 spec files | Modify | Swap provide token from `ApiService` to specific service(s) |

## Consumer Migration Order

### Phase 1 — Services (zero-risk, testable independently)
1. Create **LocationsApiService**, **AuthApiService** (no cross-deps)
2. Create **ProvidersApiService**, **ServicesApiService**
3. Create **ClientsApiService**, **BlockedSlotsApiService**
4. Create **BookingsApiService** (largest, last)

### Phase 2 — Stores (core consumers, broadest impact)
5. **reference.store.ts** → LocationsApiService, ProvidersApiService, ServicesApiService, ClientsApiService
6. **booking.store.ts** → BookingsApiService, BlockedSlotsApiService
7. **historial.store.ts** → BookingsApiService
8. **client-detail.store.ts** → BookingsApiService, ClientsApiService

### Phase 3 — Components (isolated, per-commit)
9–29. 22 components migrated individually (see consumer mapping in spec)

### Phase 4 — Cleanup
30. Delete `api.service.ts`
31. Remove barrel alias if any

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (new services) | Each domain service method calls correct URL/method/params | `HttpTestingController` — verify single request per method |
| Unit (consumer specs) | Existing specs pass with new provide token | Swap `ApiService` → `SpecificApiService` in `TestBed.configureTestingModule` |
| Manual smoke | `ng serve` and verify calendar, booking list, client list open without errors | Browser check after store migration |

## Migration / Rollout

**Feature flag**: None — pure refactor, no new behavior.

**ApiService lifecycle**: The original `api.service.ts` stays alive until Phase 4. To prevent accidental new consumers during migration, add a `@deprecated` JSDoc tag on the `ApiService` class after the first domain service is created.

If a migration breaks at any point, the commit is small enough to revert cleanly (one consumer ± its spec).

## Open Questions

- None — spec covers all consumers and mappings precisely.
