# Exploration: State Management Analysis — Bookwise

> Date: 2026-06-26
> Project: Bookwise
> Stack: Angular 21 standalone, zoneless, signals, PrimeNG 21, FullCalendar 6.1, Vitest

---

## Current State

Bookwise es un sistema de gestión de agenda para kinesiología (Kinesilk). Corre en Angular 21 con zoneless change detection y signals nativas. Consume una API Laravel REST en `http://127.0.0.1:9999/api/v1`.

### Estado actual de state management

| Mecanismo | Propósito | Alcance |
|---|---|---|
| `signal()` locales | UI state por componente | Component-level |
| `BookingUpdateService` (Subject\<Booking\>) | Notificar cambios de booking | Cross-component |
| `DataCacheService` (Map + stale-while-revalidate) | Cachear datos maestros | Global |
| `AuthService` (signals + localStorage) | Sesión del usuario | Global |
| `LanguageService` (signal + localStorage) | Idioma | Global |

---

## Pain Points (Validated)

### PP1 — 2 calendarios casi idénticos (1177 líneas duplicadas)

- **`full-calendar.component.ts`** (admin): 697 líneas
- **`provider-calendar.component.ts`** (provider): 580 líneas
- ~90% de código duplicado: `fetchEventsForCalendar`, `handleEventMove`, `buildEventContent`, `handleEventClick`, tooltips, nowLabel, filtros por status, init/destroy calendar.
- Difieren SOLO en: `lockedProviderId`/`lockedLocationId` vs filtros libres por location/provider.

### PP2 — `forkJoin` repetido en 7 lugares

- `booking-dialog` (L144): clients, services, providers, locations
- `booking-form-dialog` (L251): clients, services, packs, providers, locations
- `block-time-dialog` (L122): locations, providers
- `full-calendar` (L414 + L354): bookings+blocked-slots, locations
- `admin-dashboard` (L67): locations, providers, bookings
- `provider-availability` (L79): locations, availability
- **Cada componente fetcha independientemente, sin deduplicación.**

### PP3 — 40 `.subscribe()` manuales

Distribuidos en 12+ archivos. Sin pipeline reactivo consistente. Pattern repetido:
```typescript
this.api.getX().subscribe({
  next: data => this.mySignal.set(data),
  error: err => this.httpError.handle(err, '...')
});
```

### PP4 — BookingUpdateService es un Subject primitivo

- `booking-update.service.ts` (13 líneas): `private _updated = new Subject<Booking>()`
- Único mecanismo cross-component para notificar cambios en bookings
- Los calendarios escuchan y **refetchan TODOS los eventos** ante cualquier cambio
- Sin metadata de evento, sin filtros, sin tipado

### PP5 — Nested subscriptions (callback hell)

- **`reserva-tab.component.ts`** L145-153:
  ```typescript
  this.api.updateBooking(...).subscribe({
    next: () => {
      this.api.getBooking(b.id).subscribe({ ... })  // nested!
    }
  });
  ```
- **`reserva-tab.component.ts`** L191-196: mismo patrón con updateClient → getBooking
- Refetch innecesario que un store eliminaría (la entidad ya está actualizada)

### PP6 — Dashboard con datos hardcodeados

- `admin-dashboard.component.ts` L88-104:
  ```typescript
  this.locationChartData.set({
    labels: ['Centro 1', 'Centro 2', 'Centro 3'],
    datasets: [{ data: [12, 8, 5], ... }]  // hardcoded!
  });
  ```
- Los charts no reflejan datos reales de la API

### PP7 — Signal boilerplate repetido en 5+ componentes

```typescript
locations  = signal<Location[]>([]);
providers  = signal<Provider[]>([]);
services   = signal<(Service | ServicePack)[]>([]);
clients    = signal<Client[]>([]);
```

Declarado en: booking-form-dialog, booking-dialog, block-time-dialog, full-calendar, provider-calendar, admin-dashboard, provider-availability.

### PP8 — Mock data en AvailabilityService

- `availability.service.ts` L26-33: array mock de disponibilidad
- L37-41: `getProviderAvailability()` devuelve `of(mock).pipe(delay(300))`
- L52-61: `saveProviderAvailability()` muta el array mock
- L64-69: `checkScheduleCollision()` devuelve `of({ has_collision: false })`
- Todo tiene TODO comments esperando endpoint real

### PP9 — Sin optimistic updates

- Drag & drop en ambos calendarios (full-calendar L535, L562; provider-calendar L466, L482):
  - Espera respuesta API → recién ahí actualiza UI
  - Llama `revert()` si falla, pero la UI queda en estado inconsistente durante la llamada

### PP10 — Cobertura de tests casi nula

- 1 solo archivo de tests real: `booking-form-dialog.component.spec.ts` (227 lines)
- 1 smoke test: `app.spec.ts` (23 lines)
- Cero tests para: full-calendar, provider-calendar, dashboard, auth, payments, data-cache, booking-update

---

## Additional Findings

### AF1 — Referencia reactiva aislada en PaymentTabComponent
`payment-tab.component.ts` usa `toSignal` + `switchMap` + `combineLatest` para reactividad — es el patrón más cercano a un store en todo el código base, pero está aislado.

### AF2 — Patrón inconsistente entre booking-dialog y booking-form-dialog
Hay **dos** diálogos de booking (`booking-dialog` y `booking-form-dialog`) que hacen lo mismo pero con implementaciones diferentes. Esto apunta a código legacy que debería unificarse.

### AF3 — LanguageService maneja traducciones inline
`language.service.ts` usa un `Record<string, string>` plano para traducciones. No hay lazy-loading por feature, todo se carga al inicio.

---

## Approaches

### 1. @ngrx/signals (SignalStore) ← RECOMENDADO

Librería liviana de state management construida sobre Angular signals.

| Aspecto | Detalle |
|---|---|
| **Pros** | Zero boilerplate comparado con NgRx clásico. `withEntities` para CRUD de colecciones. `rxMethod` para pipelines reactivos automáticos. Signals-native → compatible con zoneless. Adopción incremental (1 store a la vez). |
| **Cons** | Nueva dependencia. API aún en evolución. El equipo necesita aprender el patrón. |
| **Esfuerzo** | Medio |
| **Fit** | **Excelente** — el proyecto ya es 100% signals + zoneless |

### 2. Full NgRx (actions, reducers, effects, selectors)

Framework completo de state management.

| Aspecto | Detalle |
|---|---|
| **Pros** | Ecosistema maduro. DevTools. Documentación extensa. |
| **Cons** | Boilerplate masivo. Contradice la dirección signals-native del proyecto. La capa de signals de NgRx es reciente e inmadura. Excesivo para el tamaño del proyecto. |
| **Esfuerzo** | Alto |
| **Fit** | **Pésimo** — contradictorio con signals + zoneless |

### 3. DIY Service State

Expandir servicios actuales con más signals/BehaviorSubjects.

| Aspecto | Detalle |
|---|---|
| **Pros** | Sin nuevas dependencias. El equipo conoce el patrón. |
| **Cons** | Sin entity management. Sin devtools. Cada store reinventa la rueda. Sin `rxMethod` para pipelines reactivos. Mayor probabilidad de bugs. |
| **Esfuerzo** | Medio-Alto |
| **Fit** | **Aceptable** — pero terminaríamos reconstruyendo lo que @ngrx/signals ya provee |

---

## Recommendation

**@ngrx/signals (SignalStore)** — liviano, signals-native, incremental.

La arquitectura actual del proyecto (Angular 21 standalone + zoneless + signals) está pidiendo un store basado en signals. @ngrx/signals es la extensión natural: no agrega complejidad innecesaria y resuelve los 10 pain points identificados.

---

## Proposed Store Architecture

### BookingStore
- **Owns**: Bookings (withEntities), blockedSlots, filters (locationId, providerId, statusIds, dateRange), loading state
- **Methods**: loadEvents, createBooking, updateBooking, cancelBooking, moveBooking (optimistic)
- **Replaces**: BookingUpdateService, full-calendar fetch, provider-calendar fetch
- **Elimina**: PP1 (ambos calendarios leen del mismo store), PP3, PP4, PP5, PP9

### ReferenceStore
- **Owns**: Clients, Services, Providers, Locations, Packs (withEntities), loading state
- **Methods**: loadAll, invalidateClients, invalidateServices, getByLocation
- **Replaces**: DataCacheService, todos los forkJoin de referencia
- **Elimina**: PP2, PP7, PP8

### AuthStore (opcional)
- **Owns**: User, token, role (expandir AuthService actual)
- Solo si los roles/permisos crecen en complejidad

---

## Migration Strategy

```
Fase 1: Instalar dependencias + BookingStore
  npm install @ngrx/signals @ngrx/rxjs-interop
  Crear BookingStore con withEntities + rxMethod
  Conectar full-calendar → reemplazar fetch manual por store
  Migrar provider-calendar al mismo BookingStore
  ✅ PP1, PP4 resueltos

Fase 2: ReferenceStore + eliminar forkJoin
  Crear ReferenceStore
  Reemplazar DataCacheService en booking-form-dialog, booking-dialog, block-time-dialog
  Eliminar DataCacheService
  ✅ PP2, PP7 resueltos

Fase 3: Optimistic updates + eliminar BookingUpdateService
  Agregar moveBooking con optimistic update
  Eliminar BookingUpdateService
  ✅ PP3, PP5, PP9 resueltos

Fase 4: Dashboard real + Availability con store
  Conectar dashboard a BookingStore + ReferenceStore para charts reales
  Migrar AvailabilityService al patrón store
  ✅ PP6, PP8 resueltos

Fase 5: Tests
  Tests unitarios para BookingStore (fáciles — son pure functions)
  Tests unitarios para ReferenceStore
  ✅ PP10 resuelto
```

---

## Files That Would Change

| File | Change |
|---|---|
| `package.json` | Add @ngrx/signals, @ngrx/rxjs-interop |
| `src/app/core/stores/booking.store.ts` | NEW — BookingStore |
| `src/app/core/stores/reference.store.ts` | NEW — ReferenceStore |
| `src/app/core/services/booking-update.service.ts` | DELETE |
| `src/app/core/services/data-cache.service.ts` | DELETE |
| `src/app/core/services/availability.service.ts` | REFACTOR — usar store |
| `src/app/features/admin/calendar/full-calendar.component.ts` | REFACTOR — usar BookingStore |
| `src/app/features/provider/calendar/provider-calendar.component.ts` | REFACTOR — usar BookingStore |
| `src/app/features/admin/dashboard/admin-dashboard.component.ts` | REFACTOR — conectar a stores |
| `src/app/features/admin/bookings/booking-dialog/booking-dialog.component.ts` | REFACTOR — usar ReferenceStore |
| `src/app/features/admin/bookings/booking-form-dialog/booking-form-dialog.component.ts` | REFACTOR — usar ReferenceStore |
| `src/app/features/admin/bookings/block-time-dialog/block-time-dialog.component.ts` | REFACTOR — usar ReferenceStore |
| `src/app/features/admin/bookings/payment-detail/reserva-tab.component.ts` | REFACTOR — eliminar nested subscribe |
| `src/app/features/provider/availability/provider-availability.component.ts` | REFACTOR — usar store |

---

## Risks

- **Curva de aprendizaje**: El equipo necesita interiorizar `rxMethod` y `withEntities`
- **Migración de DataCacheService**: El stale-while-revalidate actual da datos inmediatos + refresco background. ReferenceStore debe mantener ese comportamiento.
- **Coexistencia temporal**: BookingUpdateService y BookingStore convivirán durante Fase 1; asegurar que no haya doble refresh.

---

## Ready for Proposal

**Yes**. El análisis es completo y los hallazgos están validados con evidencia de código. El siguiente paso es crear un Proposal para un cambio formal de refactor de state management.
