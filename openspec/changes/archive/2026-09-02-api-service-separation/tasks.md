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

- [x] T-01 Create `build-http-params.ts` — pure `buildHttpParams(obj)`. Test: params object built correctly.
- [x] T-02 Create `auth-api.service.ts` — `login`, `register`. Test: HttpTestingController per method.
- [x] T-03 Create `locations-api.service.ts` — 7 methods (locations/regions/comunas). Test: HttpTestingController.
- [x] T-04 Create `providers-api.service.ts` — 4 methods (providers CRUD). Test: HttpTestingController.
- [x] T-05 Create `services-api.service.ts` — 5 methods (services + packs). Test: HttpTestingController.
- [x] T-06 Create `clients-api.service.ts` — 7 methods (clients + client-packs). Test: HttpTestingController.
- [x] T-07 Create `blocked-slots-api.service.ts` — 5 methods (CRUD + group delete). Test: HttpTestingController.
- [x] T-08 Create `bookings-api.service.ts` — bookings + available slots only (6 methods, NO sales). Test: HttpTestingController.
- [x] T-09 Create `sales-api.service.ts` — 7 methods (sales + transactions). Per spec, separate from bookings. Test: HttpTestingController.
- [x] T-10 Add `@deprecated` JSDoc on `ApiService` class after first domain service created.

## Phase 2: Store Migrations

- [x] T-11 Migrate `reference.store.ts` → inject LocationsApiService, ProvidersApiService, ServicesApiService, ClientsApiService. Update spec.
- [x] T-12 Migrate `booking.store.ts` → inject BookingsApiService, BlockedSlotsApiService. Update spec.
- [x] T-13 Migrate `historial.store.ts` → inject BookingsApiService, SalesApiService. Update spec.
- [x] T-14 Migrate `client-detail.store.ts` → inject ClientsApiService, SalesApiService, BookingsApiService. Update spec.

## Phase 3: Component Migrations

- [x] T-15 `login.component.ts` → AuthApiService
- [x] T-16 `register.component.ts` → AuthApiService
- [x] T-17 `full-calendar.component.ts` → LocationsApiService, ProvidersApiService, BlockedSlotsApiService
- [x] T-18 `admin-dashboard.component.ts` → BookingsApiService
- [x] T-19 `clients-list.component.ts` → ClientsApiService
- [x] T-20 `booking-dialog.component.ts` → BookingsApiService (componente consolidado en `booking-dialog.store.ts`)
- [x] T-21 `booking-form-dialog.component.ts` → BookingsApiService, ProvidersApiService, ClientsApiService, ServicesApiService
- [x] T-22 `block-time-dialog.component.ts` → BlockedSlotsApiService
- [x] T-23 `payment-detail-dialog.component.ts` → BookingsApiService (consolidado en `payment-tab.component.ts`, usa SalesApiService)
- [x] T-24 `similar-patients.service.ts` → ClientsApiService
- [x] T-25 `payment-tab.component.ts` → BookingsApiService (usa SalesApiService)
- [x] T-26 `reserva-tab.component.ts` → BookingsApiService, ProvidersApiService, ClientsApiService
- [x] T-27 `historial-pagos.component.ts` → BookingsApiService (usa SalesApiService)
- [x] T-28 `provider-calendar.component.ts` → BlockedSlotsApiService
- [x] T-29 `provider-availability.component.ts` → remove unused ApiService import
- [x] T-30 `locations-list.component.ts` → LocationsApiService
- [x] T-31 `location-dialog.component.ts` → LocationsApiService
- [x] T-32 `providers-list.component.ts` → ProvidersApiService
- [x] T-33 `provider-dialog.component.ts` → ProvidersApiService
- [x] T-34 `packs-list.component.ts` → ServicesApiService

## Phase 4: Cleanup

- [x] T-35 Delete `api.service.ts` after `grep -r 'ApiService' src/` returns no source matches.
- [x] T-36 Remove barrel alias if ApiService was re-exported from an index file.
- [x] T-37 Run `ng build` to confirm zero errors.
