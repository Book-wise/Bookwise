# Tasks: ApiService Separation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~800–1000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 7 stacked PRs |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Utility + 4 small services | PR 1 | build-http-params, Auth, Locations, Providers — ~180 lines |
| 2 | 5 larger services | PR 2 | Services, Clients, BlockedSlots, Bookings, Sales — ~300 lines |
| 3 | Store migrations | PR 3 | 4 stores + spec updates — ~120 lines |
| 4 | Component migrations A | PR 4 | login, register, full-calendar, admin-dashboard, clients-list, booking-dialog — ~60 lines |
| 5 | Component migrations B | PR 5 | booking-form-dialog, block-time-dialog, payment-detail-dialog, similar-patients, payment-tab, reserva-tab — ~120 lines |
| 6 | Component migrations C | PR 6 | historial-pagos, provider-calendar, provider-availability, locations-list, location-dialog, providers-list, provider-dialog, packs-list + remaining specs — ~80 lines |
| 7 | Cleanup | PR 7 | Delete ApiService + ng build verify — ~360 deletions |

## Phase 1: Domain Services

- [ ] T-01 Create `build-http-params.ts` — pure `buildHttpParams(obj)`. Test: params object built correctly.
- [ ] T-02 Create `auth-api.service.ts` — `login`, `register`. Test: HttpTestingController per method.
- [ ] T-03 Create `locations-api.service.ts` — 7 methods (locations/regions/comunas). Test: HttpTestingController.
- [ ] T-04 Create `providers-api.service.ts` — 4 methods (providers CRUD). Test: HttpTestingController.
- [ ] T-05 Create `services-api.service.ts` — 5 methods (services + packs). Test: HttpTestingController.
- [ ] T-06 Create `clients-api.service.ts` — 7 methods (clients + client-packs). Test: HttpTestingController.
- [ ] T-07 Create `blocked-slots-api.service.ts` — 5 methods (CRUD + group delete). Test: HttpTestingController.
- [ ] T-08 Create `bookings-api.service.ts` — bookings + available slots only (6 methods, NO sales). Test: HttpTestingController.
- [ ] T-09 Create `sales-api.service.ts` — 7 methods (sales + transactions). Per spec, separate from bookings. Test: HttpTestingController.
- [ ] T-10 Add `@deprecated` JSDoc on `ApiService` class after first domain service created.

## Phase 2: Store Migrations

- [ ] T-11 Migrate `reference.store.ts` → inject LocationsApiService, ProvidersApiService, ServicesApiService, ClientsApiService. Update spec.
- [ ] T-12 Migrate `booking.store.ts` → inject BookingsApiService, BlockedSlotsApiService. Update spec.
- [ ] T-13 Migrate `historial.store.ts` → inject BookingsApiService. Update spec.
- [ ] T-14 Migrate `client-detail.store.ts` → inject BookingsApiService, ClientsApiService. Update spec.

## Phase 3: Component Migrations

- [ ] T-15 `login.component.ts` → AuthApiService
- [ ] T-16 `register.component.ts` → AuthApiService
- [ ] T-17 `full-calendar.component.ts` → LocationsApiService, ProvidersApiService, BlockedSlotsApiService
- [ ] T-18 `admin-dashboard.component.ts` → BookingsApiService
- [ ] T-19 `clients-list.component.ts` → ClientsApiService
- [ ] T-20 `booking-dialog.component.ts` → BookingsApiService
- [ ] T-21 `booking-form-dialog.component.ts` → BookingsApiService, ProvidersApiService, ClientsApiService, ServicesApiService
- [ ] T-22 `block-time-dialog.component.ts` → BlockedSlotsApiService
- [ ] T-23 `payment-detail-dialog.component.ts` → BookingsApiService
- [ ] T-24 `similar-patients.service.ts` → ClientsApiService
- [ ] T-25 `payment-tab.component.ts` → BookingsApiService
- [ ] T-26 `reserva-tab.component.ts` → BookingsApiService, ProvidersApiService, ClientsApiService
- [ ] T-27 `historial-pagos.component.ts` → BookingsApiService
- [ ] T-28 `provider-calendar.component.ts` → BlockedSlotsApiService
- [ ] T-29 `provider-availability.component.ts` → remove unused ApiService import
- [ ] T-30 `locations-list.component.ts` → LocationsApiService
- [ ] T-31 `location-dialog.component.ts` → LocationsApiService
- [ ] T-32 `providers-list.component.ts` → ProvidersApiService
- [ ] T-33 `provider-dialog.component.ts` → ProvidersApiService
- [ ] T-34 `packs-list.component.ts` → ServicesApiService

## Phase 4: Cleanup

- [ ] T-35 Delete `api.service.ts` after `grep -r 'ApiService' src/` returns no source matches.
- [ ] T-36 Remove barrel alias if ApiService was re-exported from an index file.
- [ ] T-37 Run `ng build` to confirm zero errors.
