# Bookwise

<!-- markdownlint-disable MD033 -->
<div align="center">
  <img src="src/assets/images/Bookwise logo.png" alt="Bookwise" width="420" />

  ![Angular](https://img.shields.io/badge/Angular-21+-DD0031?logo=angular&logoColor=white)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
  ![PrimeNG](https://img.shields.io/badge/PrimeNG-21+-6366F1)
  ![FullCalendar](https://img.shields.io/badge/FullCalendar-6.x-4A90D9)
</div>
<!-- markdownlint-enable MD033 -->

---

## What is this

Frontend for **Bookwise**, a scheduling and booking management system. It allows admins and providers to view, create and manage bookings. Clients can create their own bookings with a user profile. Consumes the Laravel API at `http://127.0.0.1:9999/api/v1` directly — does not go through WooCommerce.

---

## Why Angular

The decision was not about popularity — it was about what the domain required.

**Strong typing over a complex model.** The booking domain has many related entities (`Booking`, `Client`, `Provider`, `Service`, `Location`, `Status`, `Pack`). TypeScript + Angular's inference means a model error is caught at compile time, not in production.

**Signals (Angular 17+) instead of an external store.** The state in this app does not justify NgRx or Zustand. Each component manages its own reactivity with `signal()` and `computed()`. `AuthService` exposes `isAuthenticated`, `userRole`, `isAdmin` as signals that any component can read without subscriptions or boilerplate.

**Standalone components.** No `NgModule`. Each component declares its own dependencies in the `imports` array, making each feature's surface completely explicit and tree-shakeable.

**PrimeNG.** Complex components already solved: `p-calendar`, `p-multiselect`, `p-dialog`, `p-datatable`. The time it would take to build them from scratch adds no business value.

**FullCalendar has official Angular support.** It is the most complete calendar library available and the Angular wrapper works well with the event system and virtual DOM.

---

## How state is managed

No global store. State lives where it makes sense:

```text
AuthService            → isAuthenticated, userRole, currentUser (signals, persisted in localStorage)
FullCalendarComponent  → bookings, loading, selectedBooking, hoveredBooking (local signals)
ClientsListComponent   → clients, searchQuery (local signals with debounce)
```

**Data flow:**

```text
API (HTTP) → service → component signal → template (automatic push)
```

No subjects, no BehaviorSubject, no store. When a component needs data from another, it either goes up through Input/Output or communicates via a shared service. The rule: if state crosses more than one component level, it goes to a service; if it is local to the component, it is a `signal()`.

**Reactivity in the calendar:**

FullCalendar manages its own render cycle outside Angular's zone. Everything that interacts with the calendar DOM runs in `ngZone.runOutsideAngular()`, and state updates return to the zone with `ngZone.run()`. This avoids unnecessary change detection in the rest of the app.

---

## Module structure

```text
src/app/
├── core/                        ← Singleton services, interceptors, guards
│   ├── guards/role.guard.ts     ← Factory guard: protects /admin and /provider by role
│   ├── interceptors/            ← AuthInterceptor: injects Bearer token, handles 401
│   ├── models/index.ts          ← All domain types in one place
│   └── services/
│       ├── api.service.ts       ← Single point of contact with the Laravel API
│       ├── auth.service.ts      ← Session state with signals
│       └── theme.service.ts     ← PrimeNG presets: Aura/Lara/Nora + dark mode
│
├── features/                    ← One folder per feature, not per type
│   ├── auth/                    ← login, register
│   ├── admin/
│   │   ├── bookings/
│   │   │   ├── booking-dialog/       ← Booking detail/edit
│   │   │   ├── booking-form-dialog/  ← Booking creation
│   │   │   ├── block-time-dialog/    ← Time blocking
│   │   │   └── constants/
│   │   │       └── booking-statuses.ts  ← Single source of truth for statuses and colors
│   │   ├── calendar/            ← FullCalendar with location/provider/status filters
│   │   ├── clients/
│   │   ├── dashboard/
│   │   ├── locations/
│   │   ├── packs/
│   │   └── providers/
│   └── provider/
│       ├── calendar/            ← Provider's own monthly calendar
│       └── availability/        ← Weekly availability CRUD
│
├── layouts/                     ← Route shells with sidebar/nav
│   ├── admin-layout/            ← Brand gradient sidebar, toggle, dark mode
│   └── provider-layout/         ← Simplified menubar for providers
│
└── shared/
    └── components/
        ├── phone-input/
        └── toast-modal/
```

**Why feature-based and not type-based.** A global `components/` folder with 40 files tells you nothing. `features/admin/calendar/` says exactly what it is, who uses it and where everything related lives.

**`core/models/index.ts` as a barrel.** All domain types (`Booking`, `Client`, `Provider`, `Location`, `BookingStatus`, `BlockedSlot`, `Pack`, `Service`) in a single file. One import, not ten.

---

## Design system

```text
src/styles/
└── _tokens.scss     ← Single source of truth for brand colors
```

The palette comes from the Bookwise SVG logo. No component hardcodes a brand color — everything uses CSS variables:

```scss
--bw-900: #012663   /* dark navy */
--bw-500: #0b3d95   /* primary blue */
--bw-300: #046af4   /* vibrant / CTA */
--bw-200: #60a7f0   /* light accent */

/* Semantic aliases */
--color-primary:      var(--bw-500)
--color-primary-cta:  var(--bw-300)
--sidebar-bg-from:    var(--bw-900)
--sidebar-bg-to:      var(--bw-600)
```

The sidebar is **theme-invariant** — always dark with the brand gradient regardless of dark mode. Only the main content surfaces change.

**Prefix convention:** all component selectors use `bw-` (`bw-admin-layout`, `bw-full-calendar`, `bw-login`) and global CSS classes carry the same prefix to avoid collisions with third-party libraries.

---

## Routes

```text
/login
/register
/admin                       → bw-admin-layout (guard: admin only)
  /admin/calendar            → bw-full-calendar
  /admin/clients             → ClientsListComponent
  /admin/packs               → PacksListComponent
  /admin/locations           → LocationsListComponent
  /admin/providers           → ProvidersListComponent
/provider                    → ProviderLayoutComponent (guard: provider only)
  /provider/                 → ProviderCalendarComponent
  /provider/availability     → ProviderAvailabilityComponent
```

Route protection uses a `roleGuard` factory function. There is no monolithic guard — the guard receives the required role as an argument in the route definition.

---

## API

Base: `http://127.0.0.1:9999/api/v1` (Laravel)

All requests go through `ApiService`. The `AuthInterceptor` automatically injects the `Bearer token` in every request and redirects to login on a 401.

---

## Running the project

```bash
npm install
ng serve
```

Requires the Laravel API running at `http://127.0.0.1:9999`.

---

<!-- markdownlint-disable MD024 -->

---

## Qué es esto

Frontend de **Bookwise**, sistema de gestión de agenda y reservas. Permite a admins y providers ver, crear y gestionar reservas. Los clientes pueden crear sus propias reservas con perfil de usuario. Consume la API Laravel en `http://127.0.0.1:9999/api/v1` directamente — no pasa por WooCommerce.

---

## Por qué Angular

La decisión no fue por popularidad — fue por lo que el dominio requería.

**Tipado fuerte sobre un modelo complejo.** El dominio de reservas tiene muchas entidades relacionadas (`Booking`, `Client`, `Provider`, `Service`, `Location`, `Status`, `Pack`). TypeScript + la inferencia de Angular hace que un error en el modelo se detecte en compilación, no en producción.

**Signals (Angular 17+) en lugar de un store externo.** El estado de esta app no justifica NgRx ni Zustand. Cada componente maneja su propia reactividad con `signal()` y `computed()`. El `AuthService` expone `isAuthenticated`, `userRole`, `isAdmin` como signals que cualquier componente puede leer sin subscripciones ni boilerplate.

**Standalone components.** No hay `NgModule`. Cada componente declara sus propias dependencias en el array `imports`, lo que hace la superficie de cada feature completamente explícita y tree-shakeable.

**PrimeNG.** Componentes complejos ya resueltos: `p-calendar`, `p-multiselect`, `p-dialog`, `p-datatable`. El tiempo que tomaría construirlos desde cero no agrega valor al negocio.

**FullCalendar tiene soporte oficial para Angular.** Es la librería de calendario más completa disponible y el wrapper Angular funciona bien con el sistema de eventos y el DOM virtual.

---

## Cómo se maneja el estado

Sin store global. El estado vive donde tiene sentido:

```text
AuthService            → isAuthenticated, userRole, currentUser (signals, persiste en localStorage)
FullCalendarComponent  → bookings, loading, selectedBooking, hoveredBooking (signals locales)
ClientsListComponent   → clientes, searchQuery (signals locales con debounce)
```

**Flujo de datos:**

```text
API (HTTP) → service → component signal → template (push automático)
```

No hay subjects, no hay BehaviorSubject, no hay store. Cuando un componente necesita datos de otro, o sube por Input/Output o se comunica vía un servicio compartido. La regla: si el estado cruza más de un nivel de componente, va a un service; si es local al componente, es un `signal()`.

**Reactividad en el calendario:**

FullCalendar maneja su propio ciclo de render fuera de la zona de Angular. Todo lo que interactúa con el DOM del calendario corre en `ngZone.runOutsideAngular()`, y las actualizaciones de estado vuelven a la zona con `ngZone.run()`. Esto evita change detection innecesario en el resto de la app.

---

## Estructura de módulos

```text
src/app/
├── core/                        ← Servicios singleton, interceptors, guards
│   ├── guards/role.guard.ts     ← Factory guard: protege /admin y /provider por rol
│   ├── interceptors/            ← AuthInterceptor: inyecta Bearer token, maneja 401
│   ├── models/index.ts          ← Todos los tipos del dominio en un solo lugar
│   └── services/
│       ├── api.service.ts       ← Único punto de contacto con la API Laravel
│       ├── auth.service.ts      ← Estado de sesión con signals
│       └── theme.service.ts     ← PrimeNG presets: Aura/Lara/Nora + dark mode
│
├── features/                    ← Una carpeta por feature, no por tipo
│   ├── auth/                    ← login, register
│   ├── admin/
│   │   ├── bookings/
│   │   │   ├── booking-dialog/       ← Detalle/edición de reserva
│   │   │   ├── booking-form-dialog/  ← Creación de reserva
│   │   │   ├── block-time-dialog/    ← Bloqueo de horarios
│   │   │   └── constants/
│   │   │       └── booking-statuses.ts  ← Fuente única de estados y colores
│   │   ├── calendar/            ← FullCalendar con filtros location/provider/estado
│   │   ├── clients/
│   │   ├── dashboard/
│   │   ├── locations/
│   │   ├── packs/
│   │   └── providers/
│   └── provider/
│       ├── calendar/            ← Calendario mensual propio del provider
│       └── availability/        ← CRUD de disponibilidad semanal
│
├── layouts/                     ← Shells de rutas con sidebar/nav
│   ├── admin-layout/            ← Sidebar con gradiente de marca, toggle, dark mode
│   └── provider-layout/         ← Menubar simplificada para providers
│
└── shared/
    └── components/
        ├── phone-input/
        └── toast-modal/
```

**Por qué feature-based y no type-based.** Una carpeta `components/` global con 40 archivos no le dice nada a nadie. `features/admin/calendar/` dice exactamente qué es, quién lo usa y dónde vive todo lo relacionado.

**`core/models/index.ts` como barrel.** Todos los tipos del dominio (`Booking`, `Client`, `Provider`, `Location`, `BookingStatus`, `BlockedSlot`, `Pack`, `Service`) en un solo archivo. Un import, no diez.

---

## Design system

```text
src/styles/
└── _tokens.scss     ← Fuente única de colores de marca
```

La paleta viene del logo SVG de Bookwise. Ningún componente hardcodea un color de marca — todo usa variables CSS:

```scss
--bw-900: #012663   /* navy oscuro */
--bw-500: #0b3d95   /* azul primario */
--bw-300: #046af4   /* azul vibrante / CTA */
--bw-200: #60a7f0   /* acento claro */

/* Aliases semánticos */
--color-primary:      var(--bw-500)
--color-primary-cta:  var(--bw-300)
--sidebar-bg-from:    var(--bw-900)
--sidebar-bg-to:      var(--bw-600)
```

El sidebar es **tema-invariante** — siempre oscuro con gradiente de marca independientemente del dark mode. Solo cambian las superficies del contenido principal.

**Convención de prefijos:** todos los selectores de componentes usan `bw-` (`bw-admin-layout`, `bw-full-calendar`, `bw-login`) y las clases CSS globales llevan el mismo prefijo para evitar colisiones con librerías de terceros.

---

## Rutas

```text
/login
/register
/admin                       → bw-admin-layout (guard: solo admin)
  /admin/calendar            → bw-full-calendar
  /admin/clients             → ClientsListComponent
  /admin/packs               → PacksListComponent
  /admin/locations           → LocationsListComponent
  /admin/providers           → ProvidersListComponent
/provider                    → ProviderLayoutComponent (guard: solo provider)
  /provider/                 → ProviderCalendarComponent
  /provider/availability     → ProviderAvailabilityComponent
```

La protección de rutas usa un `roleGuard` como factory function. No hay un guard monolítico — el guard recibe el rol requerido como argumento en la definición de ruta.

---

## API

Base: `http://127.0.0.1:9999/api/v1` (Laravel)

Todos los requests pasan por `ApiService`. El `AuthInterceptor` inyecta el `Bearer token` automáticamente en cada request y redirige al login si recibe un 401.

---

## Correr el proyecto

```bash
npm install
ng serve
```

Requiere la API Laravel corriendo en `http://127.0.0.1:9999`.
