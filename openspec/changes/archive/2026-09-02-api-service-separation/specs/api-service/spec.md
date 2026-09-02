# ApiService Separation — Migration Spec

## Purpose

Extract the monolithic `ApiService` (~312 L, 30+ methods) into 7 domain-specific services, one per bounded context. This is a **mechanical refactor** — zero behavioral changes, zero method signature changes.

## ADDED Requirements

### Requirement: Per‑domain services MUST be created with identical contracts

Each new service MUST expose the same methods, signatures, HTTP verbs, URL paths, params, and response types as the current `ApiService` methods for its domain.

| Domain Service | Methods | Routes |
|---|---|---|
| **AuthApiService** | `login`, `register` | `POST /auth/login`, `POST /register` |
| **BookingsApiService** | `getBookings`, `getBooking`, `createBooking`, `updateBooking`, `cancelBooking`, `getAvailableSlots` | `GET/POST/PATCH /bookings`, `PATCH /bookings/{id}/cancel`, `GET /available_slots` |
| **BookingsApiService** (sales) | `getSales`, `getSale`, `createSale`, `updateSale`, `getTransactions`, `createTransaction`, `deleteTransaction` | `GET/POST/PATCH /sales`, `GET/POST/DELETE /sales/{saleId}/transactions` |
| **ClientsApiService** | `getClients`, `getClient`, `createClient`, `updateClient`, `getClientPacks`, `getClientPacksList`, `useClientPack` | `GET/POST/PATCH /clients`, `GET /clients/{id}/packs`, `GET /client-packs`, `PATCH /client-packs/{id}/use` |
| **LocationsApiService** | `getLocations`, `getLocation`, `createLocation`, `updateLocation`, `getRegions`, `getComunas`, `getAllComunas` | `GET/POST/PATCH /locations`, `GET /regions`, `GET /regions/{id}/comunas`, `GET /comunas` |
| **ProvidersApiService** | `getProviders`, `getProvider`, `createProvider`, `updateProvider` | `GET/POST/PATCH /providers` |
| **ServicesApiService** | `getServices`, `getService`, `createService`, `getPacks`, `getPack` | `GET/POST /services`, `GET /packs` |
| **BlockedSlotsApiService** | `getBlockedSlots`, `createBlockedSlot`, `updateBlockedSlot`, `deleteBlockedSlot`, `deleteBlockedSlotGroup` | `GET/POST/PATCH/DELETE /blocked-slots`, `DELETE /blocked-slots/group/{groupId}` |

Each service MUST inject `HttpClient` with the same `baseUrl` from environment and MUST NOT add/modify error handling.

#### Scenario: Happy path — AuthApiService created with identical login contract

- GIVEN the monolithic `ApiService.login(credentials)` returns `Observable<AuthResponse>`
- WHEN `AuthApiService` is created
- THEN it MUST expose `login(credentials: LoginCredentials): Observable<AuthResponse>` calling `POST {baseUrl}/auth/login`
- AND the response shape MUST be identical to the original

#### Scenario: Error path — method signature preserved

- GIVEN a consumer that calls `api.getBlockedSlots({ date_from, date_to, location_id, provider_id })`
- WHEN refactored to inject `BlockedSlotsApiService`
- THEN `getBlockedSlots` MUST accept the same params object and return `Observable<{ data: BlockedSlot[] }>`
- AND any existing test mocking `ApiService.getBlockedSlots` MUST be updatable by replacing the provider token alone

### Requirement: Consumer DI MUST be updated per domain

Each consumer MUST inject only the service(s) it needs. No consumer injects `ApiService` after migration.

| Consumer | Injects now | Injects after |
|---|---|---|
| `booking.store.ts` | ApiService | BookingsApiService, BlockedSlotsApiService |
| `reference.store.ts` | ApiService | LocationsApiService, ProvidersApiService, ServicesApiService, ClientsApiService |
| `historial.store.ts` | ApiService | BookingsApiService |
| `client-detail.store.ts` | ApiService | BookingsApiService, ClientsApiService |
| `login.component.ts` | ApiService | AuthApiService |
| `register.component.ts` | ApiService | AuthApiService |
| `full-calendar.component.ts` | ApiService | LocationsApiService, ProvidersApiService, BlockedSlotsApiService |
| `admin-dashboard.component.ts` | ApiService | BookingsApiService |
| `clients-list.component.ts` | ApiService | ClientsApiService |
| `booking-dialog.component.ts` | ApiService | BookingsApiService |
| `booking-form-dialog.component.ts` | ApiService | BookingsApiService, ProvidersApiService, ClientsApiService, ServicesApiService |
| `block-time-dialog.component.ts` | ApiService | BlockedSlotsApiService |
| `payment-detail-dialog.component.ts` | ApiService | BookingsApiService |
| `similar-patients.service.ts` | ApiService | ClientsApiService |
| `payment-tab.component.ts` | ApiService | BookingsApiService |
| `reserva-tab.component.ts` | ApiService | BookingsApiService, ProvidersApiService, ClientsApiService |
| `historial-pagos.component.ts` | ApiService | BookingsApiService |
| `provider-calendar.component.ts` | ApiService | BlockedSlotsApiService |
| `provider-availability.component.ts` | ApiService | *(unused — remove import)* |
| `locations-list.component.ts` | ApiService | LocationsApiService |
| `location-dialog.component.ts` | ApiService | LocationsApiService |
| `providers-list.component.ts` | ApiService | ProvidersApiService |
| `provider-dialog.component.ts` | ApiService | ProvidersApiService |
| `packs-list.component.ts` | ApiService | ServicesApiService |
| 4 spec files | ApiService mock | Updated provide tokens |

#### Scenario: Booking store injects two services instead of one

- GIVEN `booking.store.ts` currently `inject(ApiService)` and uses `api.getBookings()` and `api.getBlockedSlots()`
- WHEN refactored
- THEN it MUST inject `BookingsApiService` and `BlockedSlotsApiService` independently
- AND existing `rxMethod` pipes using those methods MUST continue to work with zero logical changes

### Requirement: Monolithic ApiService MUST be removed after migration

Once all consumers are migrated and no import of `ApiService` remains, the file `api.service.ts` MUST be deleted. No deprecated re-export or barrel alias SHALL be left.

### Requirement: Service creation order MUST follow dependency graph

Services with zero internal dependencies MUST be created first, in parallel. The recommended order is:

1. **AuthApiService**, **LocationsApiService** — no cross-dependencies
2. **ProvidersApiService**, **ServicesApiService** — no cross-dependencies
3. **ClientsApiService** — depends on `Client` model only
4. **BlockedSlotsApiService** — depends on models only
5. **BookingsApiService** — depends on models only (largest, last)
6. **Consumer migration** — update all 22 consumers
7. **Delete ApiService** — remove the original file

## REMOVED Requirements

### Requirement: Monolithic ApiService class

(Reason: Violates SRP/ISP — all 30+ endpoints in one class. Causes unnecessary coupling, large dependency injection surface, and reduced testability.)
(Migration: Each consumer injects the specific domain service(s) listed in the consumer mapping table above. Test providers switch from `ApiService` to the new domain service token.)
