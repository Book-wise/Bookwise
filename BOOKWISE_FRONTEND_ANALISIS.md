# Análisis Técnico, Funcional y Visual — Bookwise Frontend

**Fecha del levantamiento:** 2026-07-06
**Commit analizado:** `c794506` (rama `develop`, working tree limpio salvo `docs/` sin trackear)
**Repositorio:** `Bookwise/` (frontend). No se auditó `Bookwise-API/` (backend), presente como carpeta hermana en este mismo checkout pero fuera del alcance de esta tarea.
**Metodología:** lectura completa del código fuente, ejecución real de `npm install`, `ng build` (producción y desarrollo), `ng test`, `ng serve`, captura de pantallas con Chrome headless contra el servidor de desarrollo local, y revisión cruzada contra una documentación técnica preexistente en `docs/` (sin trackear en git, fechada el mismo commit) que fue verificada y no simplemente copiada.

Convención: todo dato no verificable directamente se marca `NO DETERMINADO` con la razón.

---

## 1. Resumen ejecutivo

Bookwise es el frontend de un sistema de agenda y reservas para centros de atención (el dominio —RUT, CLP, WhatsApp, español por defecto— apunta a Chile). Es una **SPA Angular 21** standalone, sin `NgModule`, con signals como único mecanismo de estado, PrimeNG como librería de componentes y FullCalendar para la agenda. Consume una API Laravel externa vía `ApiService`, un único punto de contacto HTTP.

El código está ordenado, tipado con `strict: true`, usa alias de import limpios, y tiene una capa de manejo de errores HTTP centralizada (toasts + detección de offline/online) más cache en memoria con revalidación. La suite de tests (98 casos en 4 archivos) **pasa completa**.

Sin embargo, el levantamiento encontró tres hechos que cambian el diagnóstico de "listo para desplegar" a "requiere trabajo antes de producción":

1. **`ng build` en configuración de producción falla** (ver §17, §20, §23) por exceder los presupuestos de tamaño de estilos por componente definidos en `angular.json`. No es un error de compilación de código — es una política de build que hoy no se cumple.
2. **Quedan restos visibles de una marca/proyecto anterior.** La pantalla de registro y la barra superior del layout de profesional muestran literalmente **"Kinesilk"** en vez de "Bookwise" (capturado en pantalla, no solo en código). El `package-lock.json` original (antes de que esta auditoría lo regenerara y se revirtiera) tenía `"name": "e-commerce"`. Esto sugiere que el proyecto fue clonado/renombrado desde una base anterior sin completar el rebranding.
3. **El README describe una funcionalidad que no existe en las rutas actuales**: dice que "los clientes pueden crear sus propias reservas con perfil", pero `UserRole` solo admite `'admin' | 'provider'` y no hay ninguna ruta pública de autoservicio para clientes. El README no puede tomarse como fuente de verdad sin contrastarlo con el código, tal como pedía el encargo.

El resto del frontend (calendario, formulario de reservas, bloqueos, pagos, clientes) está implementado con profundidad razonable, incluyendo detección de pacientes duplicados, validación de RUT chileno, cache stale-while-revalidate y manejo defensivo de la ausencia de red. La disponibilidad de profesionales, en cambio, es **enteramente mock** (datos en memoria, sin persistencia real).

---

## 2. Propósito funcional

Bookwise gestiona la agenda de un centro de atención con **sedes, profesionales, servicios y packs de sesiones**. Permite:

- Login y registro (con redirección automática según rol).
- Un panel de **administrador** para ver el dashboard, gestionar la agenda (crear/editar/mover/cancelar reservas), bloquear horarios, listar clientes, ubicaciones, profesionales y packs, y cobrar/registrar pagos de una reserva.
- Un panel de **profesional (provider)** con su propia agenda filtrada y una pantalla de disponibilidad semanal.

No hay portal de autoservicio para el cliente final (paciente): las reservas siempre las crea un admin desde el calendario, aunque el modelo de datos y el README sugieren que en algún momento se planeó esa capacidad.

---

## 3. Stack tecnológico

Confirmado por `package.json`, `angular.json` y los binarios efectivamente instalados:

| Capa | Tecnología | Versión declarada | Versión resuelta |
| --- | --- | --- | --- |
| Framework | Angular (standalone, zoneless) | `^21.1.0` / `^21.2.10` | `21.2.10` |
| Lenguaje | TypeScript | `~5.9.2` | 5.9.x |
| CLI / build | `@angular/cli`, `@angular/build` | `^21.1.4` | `21.2.8` |
| Componentes UI | PrimeNG + PrimeIcons + `@primeng/themes` | `^21.1.6` | `21.1.6` |
| Calendario | FullCalendar (`core`, `daygrid`, `interaction`, `list`, `timegrid`) | `^6.1.20` | 6.1.20 |
| Gráficos | Chart.js | `^4.5.1` | 4.x |
| Teléfono internacional | `intl-tel-input` | `^28.0.4` | 28.x |
| Reactividad HTTP | RxJS | `~7.8.0` | 7.8.x |
| Testing | Vitest + jsdom (vía `@angular/build:unit-test`) | `^4.0.8` / `^27.1.0` | 4.x / 27.x |
| Runtime local | Node.js | No declarado (`engines` ausente) | Verificado: v22.22.1 |
| Gestor de paquetes | npm | Declarado `packageManager: npm@11.12.1` | Verificado: 9.2.0 (desajuste, ver §19) |

**Punto de entrada:** `src/main.ts` → `bootstrapApplication(App, appConfig)`. Sin `NgModule` raíz.

**Comandos:**
- `npm start` → `ng serve` (desarrollo, puerto por defecto 4200).
- `npm run build` → `ng build` (config. `production` por defecto — **falla hoy**, ver §17).
- `npm run watch` → `ng build --watch --configuration development`.
- `npm test` → `ng test` (Vitest vía `@angular/build:unit-test`).

---

## 4. Arquitectura del frontend

Standalone components + signals, sin store global (NgRx/Zustand ausentes por decisión documentada en el README). `appConfig` (`src/app/app.config.ts`) registra: router con `withComponentInputBinding()`, `provideHttpClient` con el interceptor de auth, `provideZonelessChangeDetection()`, animaciones, PrimeNG (preset Aura, traducciones de calendario en español) y `MessageService` para toasts.

Patrones transversales confirmados en el código:

- **Estado con signals**: `AuthService` expone `token`, `user`, `isAuthenticated`, `userRole`, `isAdmin`, `isProvider` como `computed()`. Los componentes usan `signal()` local para loading/datos.
- **Comunicación entre componentes hermanos vía servicio + `Subject`**: `BookingUpdateService.updated$` (un `Subject<Booking>`) es el mecanismo por el cual `BookingFormDialogComponent` avisa a `FullCalendarComponent` que debe refrescar tras guardar — no hay un store, es un bus de eventos puntual.
- **Cache en memoria con stale-while-revalidate**: `DataCacheService` (TTLs de 30s a 5min según recurso) evita refetch constante de clientes/servicios/packs/providers/locations en los diálogos de reserva.
- **Zona de Angular gestionada manualmente en el calendario**: `FullCalendarComponent` corre la inicialización y los callbacks de FullCalendar con `ngZone.runOutsideAngular()` y vuelve a entrar con `ngZone.run()` solo cuando debe actualizar signals — evitando change detection innecesaria en cada movimiento del mouse sobre el calendario.
- **`CUSTOM_ELEMENTS_SCHEMA`** en `FullCalendarComponent` para permitir los custom elements de FullCalendar — esto desactiva la verificación estricta de templates de Angular para ese componente puntual (ver §18).

No hay lazy-loading a nivel de `NgModule` (no existen), pero sí a nivel de **componente**: todas las rutas usan `loadComponent()`, confirmado en `app.routes.ts` y en los chunks separados que produce el build (`admin-dashboard-component`, `full-calendar-component`, `provider-calendar-component`, etc. — ver salida real de build en §17).

---

## 5. Estructura del repositorio

```
Bookwise/
├── README.md                 # bilingüe ES/EN, desactualizado en al menos 2 puntos (ver §24)
├── package.json / package-lock.json
├── angular.json               # proyecto "bookwise", prefijo de selector "bw"
├── tsconfig*.json             # strict: true, alias de path (@core, @models, @services, @shared, @features, @layouts, @env, @i18n, @guards, @interceptors)
├── public/                    # solo favicon.ico
├── docs/                      # documentación técnica preexistente, sin trackear en git (ver nota abajo)
├── docs/bookwise-frontend-analysis/  # evidencia visual generada por ESTA auditoría (15 capturas)
└── src/
    ├── main.ts, index.html, styles.scss, styles/_tokens.scss
    ├── environments/{environment.ts, environment.prod.ts}
    ├── assets/{images,fonts}
    └── app/
        ├── core/          # models, services, guards, interceptors, i18n (es/en)
        ├── features/      # auth, admin/{dashboard,calendar,bookings,clients,locations,packs,providers}, provider/{calendar,availability}
        ├── layouts/        # admin-layout, provider-layout
        └── shared/         # components (patient-card, phone-input, toast-modal), pipes, validators, utils, config, constants
```

**Nota sobre `docs/`:** al iniciar esta auditoría ya existía en el working tree una carpeta `docs/` completa (22 archivos, ~940 líneas), sin trackear en git, fechada el mismo commit `c794506`, que documenta el repositorio con una metodología casi idéntica a la de este encargo (hechos confirmados vs. inferencias vs. desconocidos). Se verificó su contenido contra el código fuente línea por línea en los puntos críticos y **es preciso**; se usó como material de apoyo pero este documento es la entrega formal, con ejecución real (build/test/serve) que `docs/` explícitamente no había hecho.

**Conteo:** 58 archivos `.ts` bajo `src/app` (sin contar specs), 4 archivos de test.

---

## 6. Tipos de usuario y roles

Confirmado por `src/app/core/models/index.ts` y `src/app/core/guards/role.guard.ts`:

```ts
export type UserRole = 'admin' | 'provider';
```

Solo existen **dos roles**. No hay rol de cliente/paciente final, pese a que:
- El README (ambos idiomas) dice: *"Clients can create their own bookings with a user profile."*
- El modelo `Client` existe y es rico (RUT, `wc_customer_id`, atributos custom), pero es gestionado por el admin, nunca por el propio cliente.

`roleGuard(allowedRoles: UserRole[])` es una factory: sin usuario autenticado redirige a `/login`; con rol distinto al requerido redirige al dashboard del rol real. No hay guard granular por acción (todo o nada a nivel de rama de ruta).

---

## 7. Inventario de rutas y pantallas

Fuente: `src/app/app.routes.ts`, verificado navegando cada ruta contra el servidor de desarrollo real.

| Ruta | Pantalla | Propósito | Usuario | Protección | Componentes principales | Datos consumidos | Acciones | Estado | Dependencia API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | — | Redirección | Todos | Ninguna | — | — | — | Funcional | Ninguna |
| `/login` | Login | Autenticación | Público | Ninguna | `LoginComponent` | Credenciales | Iniciar sesión | **Funcional** (UI verificada por captura; integración real no verificable sin backend) | `POST /auth/login` |
| `/register` | Registro | Alta de usuario | Público | Ninguna | `RegisterComponent`, `PhoneInputComponent` | Formulario | Crear cuenta | **Funcional con defecto visual crítico** — branding "Kinesilk" (ver §11) | `POST /register` |
| `/admin` | Dashboard | KPIs y gráficos | Admin | `roleGuard(['admin'])` | `AdminDashboardComponent` | `getLocations`, `getProviders`, `getBookings` | Ninguna (solo lectura) | **Parcialmente funcional** — KPIs son reales, los 2 gráficos usan arrays fijos en `initCharts()` (ver §11) | GET locations/providers/bookings |
| `/admin/locations` | Ubicaciones | Listado de sedes | Admin | Heredada | `LocationsListComponent` | `getLocations` | Ninguna — **no hay botón crear/editar** | **Parcialmente funcional** (solo lectura; título de la página en inglés "Locations", ver §11) | GET `/locations` |
| `/admin/providers` | Profesionales | Listado de providers | Admin | Heredada | `ProvidersListComponent` | `getProviders` | Ninguna — solo lectura | **Parcialmente funcional** (sin alta/edición desde UI) | GET `/providers` |
| `/admin/calendar` | Agenda | Calendario semanal/mensual/diario con reservas y bloqueos | Admin | Heredada | `FullCalendarComponent` + 4 diálogos hijos | `getBookings`, `getBlockedSlots`, `getLocations`, `getProviders` | Crear/editar/mover/redimensionar reserva, bloquear horario, ver/editar pago | **Funcional** — la pantalla más completa del sistema (697 líneas en el componente) | GET/POST/PATCH bookings, blocked-slots |
| `/admin/clients` | Clientes | Listado + búsqueda | Admin | Heredada | `ClientsListComponent` | `getClients` (debounce 300ms) | Buscar (alta ocurre solo embebida en el flujo de reserva) | **Funcional** (verificado: estado vacío "No se encontraron clientes" correcto) | GET `/clients` |
| `/admin/packs` | Packs | Listado de packs de servicio | Admin | Heredada | `PacksListComponent` | `getPacks` | Ninguna — solo lectura | **Parcialmente funcional** (sin alta/edición desde UI) | GET `/packs` |
| `/provider` | Mi agenda | Calendario propio | Provider | `roleGuard(['provider'])` | `ProviderCalendarComponent` | Igual que admin/calendar, filtrado por `provider_id` + primera `location_id` del usuario | Ver/gestionar su propia agenda | **Funcional** | GET/PATCH bookings |
| `/provider/availability` | Disponibilidad | CRUD de horario semanal | Provider | Heredada | `ProviderAvailabilityComponent` | `AvailabilityService` (mock) + `getLocations` | Agregar/eliminar/guardar franjas | **Mock** — la persistencia es un array en memoria del servicio Angular, se pierde al recargar la página; no hay endpoint backend real (comentarios `TODO` explícitos en el código) | Ninguna real (simulada) |
| `**` | — | Redirección a `/login` | Todos | Ninguna | — | — | — | Funcional | Ninguna |

Diálogos embebidos en `/admin/calendar` (no son rutas propias, pero son pantallas funcionales de facto):

| Diálogo | Propósito | Estado |
| --- | --- | --- |
| `BookingFormDialogComponent` | Crear/editar reserva, alta rápida de cliente/servicio, detección de duplicados, repetición | **Funcional** — el componente más elaborado (671 líneas) |
| `BlockTimeDialogComponent` | Bloquear horario por sede/profesional, con repetición | **Funcional** |
| `BookingDialogComponent` | Resumen rápido al hacer click en una reserva | **Funcional** |
| `PaymentDetailDialogComponent` (tabs: reserva, pago, recordatorios, paciente, ficha, historial) | Detalle completo de una reserva | **Parcialmente funcional** — tabs "reserva", "pago" y "paciente" funcionan; **"recordatorios", "ficha" e "historial" son placeholders** ("Sin recordatorios configurados.", "Ficha médica próximamente.", "Historial de reservas próximamente." — texto literal en el HTML) |

---

## 8. Flujos de usuario

### Login
1. Usuario ingresa email/password → `POST /auth/login`.
2. `AuthService.login()` guarda token + usuario en `localStorage` y redirige por rol.
3. Errores de validación del backend se traducen vía `translateValidationMessage`.
**Estado real:** UI funcional y probada visualmente; el resultado del login contra un backend real no pudo verificarse (no hay backend disponible en este entorno, ver §17).

### Registro
1. Formulario con nombre, email, teléfono (componente `intl-tel-input`), password + confirmación.
2. Validación de coincidencia de contraseñas en cliente antes de habilitar el botón.
3. `POST /register` → mismo flujo de login post-registro (auto-login).
**Estado real:** funcional pero con el defecto de marca crítico ya mencionado.

### Crear reserva desde el calendario
1. Click en botón "Nueva reserva" o en un slot vacío del calendario.
2. Diálogo carga clientes/servicios/packs/providers/locations (con cache).
3. Selección de paciente (o alta rápida con detección de duplicados por email/teléfono — nunca por nombre solo), servicio o pack, fecha/hora, estado, repetición opcional.
4. Guardar → `POST /bookings` → `BookingUpdateService.notify()` → el calendario refresca sin recargar la página.
**Validaciones confirmadas en código:** requiere cliente + servicio/pack + fecha/hora (`isFormValid()`); envía exactamente uno de `service_id`/`service_pack_id` (comentado como regla 422 esperada del backend, no verificada).

### Bloquear horario
1. Definir alcance (sede o profesional), fechas, motivo, repetición opcional.
2. Validación en cliente: fin debe ser posterior a inicio (`endBeforeStart`).
3. `POST /blocked-slots`.

### Pago de reserva
1. Desde el detalle de una reserva, tab "Pago".
2. Si no existe venta asociada, permite crearla (`POST /sales`); si existe, permite registrar abonos (`POST /sales/:id/transactions`).
**Estado real:** funcional en cuanto a UI y llamadas; reglas de negocio de saldo (`amount_exceeds_remaining`) están solo documentadas como comentario en el tipo `CreateTransactionRequest`, no verificables sin backend.

### Gestionar disponibilidad de profesional
1. Provider entra a `/provider/availability`.
2. Agrega/elimina franjas horarias localmente.
3. "Guardar cambios" → `AvailabilityService.saveProviderAvailability()` — **esto solo actualiza un array en memoria del servicio Angular**, no llama a ningún endpoint. Al recargar la página se pierde todo lo agregado, salvo el mock hardcodeado inicial (provider 1, lunes a viernes 9–18h).

### Flujos no encontrados en el código
- Recuperación de contraseña: no existe pantalla ni endpoint invocado — `NO DETERMINADO / no implementado`.
- Autoservicio de cliente final (registro/reserva propia): no existe ruta — contradice al README (ver §24).

---

## 9. Integración con la API

Toda la comunicación HTTP pasa por `ApiService` (`src/app/core/services/api.service.ts`, 285 líneas), salvo `AvailabilityService.getLocationAvailability()` que llama a `HttpClient` directamente para `available_slots`.

**Base URL:**
- Desarrollo: `http://127.0.0.1:9999/api/v1` (`environment.ts`).
- Producción: `/api/v1` (relativo — implica que el frontend espera ser servido desde el mismo origen que la API, o detrás de un proxy inverso que reescriba `/api/v1`. Esto es una inferencia razonable, no confirmada por ningún archivo de configuración de proxy en el repo).

**Autenticación:** Bearer token vía `authInterceptor` (`src/app/core/interceptors/auth.interceptor.ts`), inyectado en cada request si existe token en `AuthService`. En `401`, el interceptor fuerza `logout()` (limpia `localStorage` y redirige a `/login`) — no hay refresh token ni reintento.

**Manejo de errores:** `HttpErrorService` centraliza la traducción de errores HTTP/API a toasts (PrimeNG `MessageService`), con 3 ramas: error de negocio (`{error, detail}`), validación Laravel (`{errors: {campo: [...]}}, y genérico/framework. Además detecta estado offline/online real del navegador (`navigator.onLine` + evento `offline`/`online` + polling cada 3s) y muestra un banner persistente — **comportamiento confirmado visualmente** en las capturas de §13 (banner "Sin conexión" / "Conexión restaurada").

**Sin reintentos ni timeouts explícitos** configurados en `HttpClient` (no hay `retry()`/`timeout()` en ningún request revisado).

**Detectado — resto de nomenclatura previa:** el comentario de tipo en `http-error.service.ts` dice literalmente *"Shape of the error body returned by the **Kinesilk** API"* — coherente con los hallazgos de branding de §11.

### URLs hardcodeadas / datos simulados detectados

| Hallazgo | Ubicación | Detalle |
| --- | --- | --- |
| Disponibilidad de provider 100% mock | `src/app/core/services/availability.service.ts` | `getProviderAvailability`, `saveProviderAvailability`, `checkScheduleCollision` y `getAvailableHours` no llaman a ningún endpoint real; los tres primeros usan un array en memoria, el cuarto genera horarios con **`Math.random() > 0.3`** para simular disponibilidad |
| Gráficos del dashboard con datos fijos | `admin-dashboard.component.ts::initCharts()` | Arrays literales (`['Centro 1','Centro 2','Centro 3']`, `[12,8,5]`, etc.) — no vienen de la API pese a que el dashboard sí carga KPIs reales al lado |
| `console.log` de datos de usuario en producción | `payment-tab.component.ts:220` | `console.log('Note saved:', this.noteText())` — queda en el bundle de producción salvo que el build lo elimine (no verificado; Angular CLI no strippea `console.log` por defecto) |

---

## 10. Contrato preliminar Frontend → API

Tabla completa de endpoints que el frontend espera consumir (fuente: `ApiService`). **Ninguno de estos fue verificado contra un backend real** — esta tabla es literalmente lo que el frontend *asume* que existe, pensada para contrastar con el análisis del backend (Bookwise-API / "Gepeto").

| Método | Endpoint | Auth esperada | Payload enviado | Respuesta esperada | Uso |
| --- | --- | --- | --- | --- | --- |
| GET | `/locations` | Público (comentado) | — | `Location[]` | Listado de sedes |
| GET | `/locations/:id` | Público | — | `Location` | Detalle de sede |
| GET | `/services` | Público | — | `Service[]` | Listado de servicios |
| POST | `/services` | No explícita | `{name, price, duration_minutes}` | `Service` | Alta rápida desde el form de reserva |
| GET | `/packs` | Público | — | `PaginatedResponse<ServicePack>` | Listado de packs |
| GET | `/available_slots` | Público | `location_id?, provider_id?, service_id?, date?` | `AvailableSlot[]` | Slots disponibles (uso parcial, mezclado con mock) |
| GET/POST/PATCH/DELETE | `/blocked-slots[...]` | No explícita | ver `CreateBlockedSlot` | `BlockedSlot` / `BlockConflictResponse` | Bloqueos de horario |
| POST | `/auth/login` | Público | `{email, password}` | `{token, user}` | Login |
| POST | `/register` | Público | `RegisterData` | `{token, user}` | Registro |
| GET | `/providers`, `/providers/:id` | Requerida (Bearer) | `location_id?` | `Provider[]` / `Provider` | Listado/detalle de profesionales |
| GET/POST/PATCH | `/bookings[...]`, `/bookings/:id/cancel` | Requerida | ver `CreateBooking`/`UpdateBooking` | `Booking` / `PaginatedResponse<Booking>` | CRUD de reservas |
| GET/POST/PATCH | `/clients[...]`, `/clients/:id/packs` | Requerida | `Partial<Client>` | `Client[]` / `Client` / `ClientPack[]` | CRUD de clientes |
| GET/POST/PATCH | `/sales[...]`, `/sales/:id/transactions` | Requerida | ver `CreateSaleRequest`/`CreateTransactionRequest` | `Sale` / `SaleDetailResponse` / transacciones | Pagos |
| DELETE | `/sales/:saleId/transactions/:transactionId` | Requerida | — | `DeleteTransactionResponse` | Eliminar abono |
| GET/PATCH | `/client-packs[...]`, `/client-packs/:id/use` | Requerida | `{booking_id}` | `ClientPack[]` / `ClientPack` | Consumo de sesiones de pack |

**Reglas de negocio que el frontend asume pero no puede validar (comentadas en los tipos, no en runtime):**
- `CreateBooking`: exactamente uno entre `service_id` y `service_pack_id` — el frontend nunca envía ambos ni ninguno cuando el formulario es válido, pero no hay guardas explícitas más allá de `isFormValid()`.
- `CreateSaleRequest`: exactamente uno entre `booking_id` y `client_pack_id`; backend devolvería `sale_already_exists` si ya hay venta.
- `CreateTransactionRequest`: backend devolvería `amount_exceeds_remaining` si el abono excede el saldo — el frontend solo formatea ese mensaje si llega, no lo previene en cliente.

**Endpoints que el frontend necesitaría y que NO existen en `ApiService`:** crear/editar/eliminar `Location`, `Provider` o `ServicePack` (las 3 pantallas de listado son de solo lectura), y cualquier endpoint real de disponibilidad de profesional (`/providers/:id/availability`, comentado como TODO pero nunca implementado).

---

## 11. Estado visual

Se evaluó contra capturas reales del servidor de desarrollo (`docs/bookwise-frontend-analysis/*.png`), no solo contra el código.

**Hallazgo crítico — branding inconsistente ("Kinesilk"):**
- `docs/bookwise-frontend-analysis/03-register-desktop.png` y `04-register-tablet.png`: la pantalla de registro muestra el título **"Kinesilk"** (línea 5 de `register.component.html`: `<h1 class="brand-name">Kinesilk</h1>`), con una paleta morada en degradé que no tiene relación con los tokens `--bw-*` usados en el resto de la aplicación, sin logo, y con un botón verde en vez del azul de marca.
- `docs/bookwise-frontend-analysis/13-provider-calendar-desktop.png` y `15-provider-calendar-mobile.png`: la barra superior del layout de profesional dice **"Kinesilk - Profesional"** (`provider-layout.component.html`, no interpolado — es texto literal).
- Esto no es un detalle menor: es la primera pantalla que ve un profesional nuevo y la única de alta de cuenta pública, y ambas exponen el nombre de un producto/cliente anterior.

**Inconsistencias de idioma (i18n incompleto):**
- El dashboard admin muestra la tarjeta KPI **"Locations"** en inglés (`docs/bookwise-frontend-analysis/05-admin-dashboard-desktop.png`) mientras el resto de la interfaz —incluido el ítem de menú "Ubicaciones"— está en español.
- La pantalla `/admin/locations` tiene como título de página **"Locations"** en inglés (`docs/bookwise-frontend-analysis/08-admin-locations-desktop.png`), pese a que el ítem de navegación que lleva ahí dice "Ubicaciones".
- El resto de la app (calendario, toasts, formularios) sí está correctamente internacionalizado vía `LanguageService` + diccionarios `es.ts`/`en.ts` (342 líneas cada uno) — el problema es puntual a 2 pantallas, no sistémico.

**Sistema de diseño:** sí existe uno real, no son solo estilos dispersos. `src/styles/_tokens.scss` centraliza paleta de marca (`--bw-50` a `--bw-900`), escala tipográfica semántica por rol (`--bw-font-title`, `--bw-font-kpi`, etc., no por tamaño crudo), pesos, tracking y **una escala de z-index documentada y explícita** (`--z-base` a `--z-topbar`, con la nota "PrimeNG usa 1000+, nunca superar 500 para el chrome de la app"). El modo oscuro se implementa sobreescribiendo variables en `body.dark-theme` con `!important` extensivo sobre clases internas de PrimeNG (`.p-datatable`, `.p-dialog`, `.p-select`, `.fc`), lo cual es frágil ante actualizaciones de PrimeNG pero funciona hoy.

**Gráficos con datos fijos junto a datos reales:** el dashboard mezcla KPIs reales (locations, providers, citas de hoy/pendientes — con `0` correcto cuando no hay backend, ver captura) con dos gráficos (dona y línea) que muestran siempre los mismos números de ejemplo (`initCharts()`), sin indicación visual de que son ilustrativos. Un usuario real podría confundirlos con datos de negocio.

**Toasts superpuestos en mobile:** en `docs/bookwise-frontend-analysis/12-admin-calendar-mobile.png` se ve el toast "Sin conexión" y un toast de "Conexión restaurada" apilados y parcialmente solapados en la parte superior en viewport de 390px — el manejo de múltiples toasts en mobile no despeja el anterior antes de mostrar el siguiente.

**Toast tapando controles del header en `/provider/availability`:** en `docs/bookwise-frontend-analysis/14-provider-availability-desktop.png` el banner "Sin conexión" se superpone parcialmente al selector de idioma y al botón "Salir" del layout de profesional.

**Skeletons:** están implementados de forma consistente (`SkeletonModule` de PrimeNG + una animación custom `bw-skeleton-shimmer` en `styles.scss`) en prácticamente todas las pantallas con carga asíncrona — buen nivel de pulido en estados de carga.

---

## 12. Sistema de componentes

No hay una librería de componentes propia documentada (tipo Storybook); el "sistema" es la combinación de PrimeNG (preset Aura por defecto, con Lara y Nora seleccionables en runtime vía `ThemeService`) más los tokens de `_tokens.scss`. Componentes compartidos reales y reutilizados:

- `PhoneInputComponent`: wrapper `ControlValueAccessor` + `Validator` sobre `intl-tel-input`, reutilizado en registro y alta rápida de cliente.
- `PatientCardComponent`: ficha de paciente con tabs (planes, sesiones, prepago, recientes), carga lazy de ventas/reservas solo al abrir cada tab — buen patrón de rendimiento.
- `ToastService`/`ToastModalComponent`: capa propia sobre PrimeNG para toasts/confirmaciones.
- `BwCurrencyPipe` + `currency.config.ts`: formato CLP centralizado (`Intl.NumberFormat('es-CL')`).
- `rut.validator.ts` / `rut.directive.ts`: validación de RUT chileno con cálculo de dígito verificador — implementación correcta y con tests.

**Duplicación detectada:** `BookingDialogComponent` declara su propia interfaz local `BookingFormData` (líneas 25–37) que se superpone casi por completo con `BookingFormData` en `features/admin/bookings/interfaces/booking-form-data.interface.ts`, usada por `BookingFormDialogComponent`. Son dos diálogos de reserva con dos modelos de formulario ligeramente distintos en vez de uno compartido.

**Componentes grandes:** `full-calendar.component.ts` (697 líneas), `booking-form-dialog.component.ts` (671), `provider-calendar.component.ts` (580), `block-time-dialog.component.ts` (409) concentran mucha lógica (fetch, transformación a eventos FullCalendar, drag&drop, tooltips, menús contextuales) en un solo archivo cada uno — funcionan, pero son candidatos naturales a descomposición si crecen más.

---

## 13. Responsividad

Evaluado con capturas reales en 3 anchos: 390px (mobile), 768px (tablet), 1440px (desktop).

**Funciona correctamente:**
- Login: layout de dos columnas en desktop colapsa a una columna apilada en mobile, sin overflow horizontal ni recortes (`01-login-desktop.png` vs `02-login-mobile.png`).
- Sidebar admin: se oculta y pasa a menú hamburguesa por debajo de 992px (`isMobile` calculado con `window.innerWidth < 992`, con listener de `resize`).
- Calendario: recalcula `contentHeight` dinámicamente contra el alto de viewport (`getContentHeight()`), y tiene un flag `isMobile` propio (`< 768px`) que ajusta el comportamiento de selección de slots.
- Tablas (`p-datatable`): tienen `overflow-x: auto` y `text-overflow: ellipsis` con `max-width` reducido bajo 1024px (`styles.scss`), evitando que rompan el layout en pantallas angostas.
- Toast: ancho forzado a `calc(100vw - 2rem)` bajo 640px.

**Problemas encontrados (evidencia visual):**
- Apilamiento/solape de toasts en mobile (§11).
- Toast solapando controles de header en desktop en `/provider/availability` (§11) — no es exclusivo de mobile.
- El menubar de profesional en mobile (`15-provider-calendar-mobile.png`) hace wrap del texto "Kinesilk - Profesional" a dos líneas, ocupando espacio vertical significativo antes de llegar al contenido.

**No verificado:** orientación horizontal en tablet/mobile, dispositivos táctiles reales (solo se emuló viewport, no eventos touch), Safari/iOS (las capturas se tomaron con Chromium headless) — `NO DETERMINADO`, requiere pruebas en dispositivo o BrowserStack/similar.

---

## 14. Accesibilidad

Revisión estática sobre las 58 plantillas + verificación visual. Sin lector de pantalla real disponible en este entorno — los puntos marcados como verificados son solo estructurales.

| Hallazgo | Severidad | Evidencia |
| --- | --- | --- |
| Uso de `aria-*` casi inexistente: solo 2 de los archivos `.html` del proyecto usan algún atributo `aria-` (`patient-card.component.html`, `payment-detail-dialog.component.html`, ambos con un único `aria-label` en un botón de icono) | **Alto** | `grep -rl "aria-" src/app --include="*.html"` → 2 resultados |
| Asociación `label`/`for` explícita solo en 5 archivos de plantilla; la mayoría de los campos dependen de los componentes de PrimeNG (que sí generan `id`/`for` internos en algunos casos, pero no todos — no verificado campo por campo) | **Medio** | `grep -rl "for=" src/app --include="*.html"` → 5 resultados |
| Sin `role=` explícito salvo un caso (`patient-card.component.html`) | **Medio** | — |
| Estado (booking status) se comunica con color + texto simultáneamente (el punto de color siempre va acompañado del label), no solo color | Correcto (no es hallazgo negativo) | `booking-dialog.component.html`, templates de `p-select` con `bw-status-dot` + texto |
| Imágenes con `alt`: las 3 etiquetas `<img>` del proyecto tienen `alt` descriptivo (`"Bookwise"`, `"BW"`) | Correcto | `grep -rn "<img" src/app --include="*.html"` → 3/3 con `alt` |
| Navegación por teclado / orden de foco / trampas de foco en diálogos (`p-dialog`) | `NO DETERMINADO` | Requiere prueba manual con teclado; PrimeNG's `p-dialog` gestiona foco por defecto pero no se probó en este repo específico |
| Contraste de color | `NO DETERMINADO` | Requiere herramienta de contraste (axe/Lighthouse) contra la app corriendo con datos reales; no se ejecutó en este levantamiento |

**Conclusión:** no hay evidencia de que la accesibilidad haya sido una prioridad de diseño. No es necesariamente "roto" (PrimeNG aporta accesibilidad base en varios de sus componentes), pero el proyecto no tiene una capa de accesibilidad propia verificable.

---

## 15. Seguridad

| Área | Hallazgo | Severidad |
| --- | --- | --- |
| Almacenamiento de token | `auth_token` y `auth_user` (JSON con datos del usuario) se guardan en **`localStorage` sin cifrar** (`auth.service.ts`). Estándar en SPAs pero significa que **cualquier XSS exitoso puede robar el token** sin necesidad de acceso a cookies `HttpOnly`. No hay expiración/rotación de token gestionada en frontend (el único mecanismo de invalidación es un 401 del backend). | **Medio-Alto** (riesgo estándar de SPA con Bearer token en localStorage, agravado por la ausencia casi total de CSP) |
| Content-Security-Policy | `src/index.html` no define ningún `<meta http-equiv="Content-Security-Policy">` ni headers de seguridad — no hay mitigación de XSS a nivel de documento. | **Alto** (para desplegar en producción) |
| Vulnerabilidades de dependencias | `npm audit --omit=dev` reporta **7 vulnerabilidades (1 moderada, 6 altas)** en `@angular/compiler`, `@angular/core` y `@angular/animations` (rango `21.0.0-next.0 - 21.2.16`), específicamente dos avisos de **bypass de sanitización → XSS** (GHSA-58w9-8g37-x9v5, GHSA-f3m7-gqxr-g87x). Hay fix disponible vía `npm audit fix` — no se aplicó, por estar fuera del alcance de esta auditoría (no se debía modificar el código/dependencias). | **Alto** — verificado con comando real, no es una advertencia genérica |
| Secretos en el repositorio | No se encontraron API keys, contraseñas ni tokens hardcodeados en `src/` (`grep` dirigido sin resultados). `.gitignore` excluye explícitamente `src/env.ts` (variable de entorno con secretos, no presente en el repo) y `CLAUDE.md`. | Correcto |
| `console.log` con datos de usuario | `payment-tab.component.ts:220` imprime el contenido de una nota (`this.noteText()`) a la consola del navegador en cada guardado — no es una fuga de credenciales, pero sí de datos de negocio/paciente en un entorno de producción. | **Bajo-Medio** |
| Protección de rutas | Solo client-side (`roleGuard`), como es esperable en una SPA — la autorización real depende enteramente del backend, que no se pudo auditar. | Esperado, no es un defecto del frontend en sí |
| Sanitización de HTML dinámico | `FullCalendarComponent.buildEventContent()` construye HTML manualmente para el contenido de eventos, pero sí escapa el título de la reserva antes de insertarlo (`title.replace(/[&<>"']/g, ...)` — reemplazo manual de entidades, línea ~500). El resto del contenido HTML de eventos (bloqueos, badges de pago) usa strings estáticos o interpolación numérica, sin texto libre de usuario sin escapar detectado. | Correcto en el punto revisado, pero es un patrón manual (no usa `DomSanitizer`) que depende de que nadie olvide escapar el próximo campo libre que se agregue ahí. |
| Subida de archivos | No se encontró funcionalidad de carga de archivos en el frontend. | N/A |
| Enlaces externos | Los enlaces `wa.me` (WhatsApp) usan `target="_blank" rel="noopener noreferrer"` correctamente (verificado en `payment-detail-dialog.component.html`). | Correcto |

---

## 16. Variables de entorno

No hay archivo `.env` (Angular no usa ese mecanismo nativamente); la configuración por ambiente vive en `src/environments/`:

```ts
// environment.ts (desarrollo)
{ production: false, apiUrl: 'http://127.0.0.1:9999/api/v1' }

// environment.prod.ts (producción)
{ production: true, apiUrl: '/api/v1' }
```

No hay `environment.staging.ts` ni configuración de QA — solo desarrollo y producción están contempladas en `angular.json` (`configurations.production` / `configurations.development`, con `production` como default del target `build`).

`.gitignore` excluye `src/env.ts` (un archivo que no existe en el repo actual pero está previsto como posible mecanismo de secretos — `NO DETERMINADO` para qué se usaría exactamente, no hay referencias a `env.ts` en el código fuente).

Para el levantamiento local se creó un entorno de desarrollo apuntando a `http://127.0.0.1:9999/api/v1` (valor ya presente por defecto en el repo, no se creó ningún archivo adicional con credenciales).

---

## 17. Ejecución local

Ejecutado realmente en este levantamiento (no solo revisado):

| Paso | Comando | Resultado |
| --- | --- | --- |
| Instalación | `npm install` | **OK** — 491 paquetes, sin errores (1 warning de deprecación de `@primeng/themes`, ver §19) |
| Build producción | `ng build` (config. `production`, default) | **FALLA (exit 1)** — ver detalle abajo |
| Build desarrollo | `ng build --configuration development` | **OK** — compila y genera bundle sin errores |
| Tests | `ng test` (`--watch=false`) | **OK — 98/98 tests pasando**, 4 archivos de spec, ~33s |
| Servidor de desarrollo | `ng serve` | **OK** — arranca en ~8s, sirve correctamente `/login`, `/register` y (con sesión inyectada vía `localStorage`, ver nota) las rutas `/admin/*` y `/provider/*` |

**Detalle de la falla de `ng build` en producción:**

```
✘ [ERROR] src/app/shared/components/patient-card/patient-card.component.scss
  exceeded maximum budget. Budget 8.00 kB was not met by 115 bytes (total 8.12 kB)

✘ [ERROR] src/app/features/provider/calendar/provider-calendar.component.scss
  exceeded maximum budget. Budget 8.00 kB was not met by 1.96 kB (total 9.96 kB)

✘ [ERROR] src/app/features/admin/calendar/full-calendar.component.scss
  exceeded maximum budget. Budget 8.00 kB was not met by 4.82 kB (total 12.82 kB)

Application bundle generation failed.
```

Esto ocurre porque `angular.json` define, para la configuración `production`:
```json
{ "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
```
y tres hojas de estilo de componente superan hoy los 8kB (además, el bundle inicial total —800.17kB— supera el `maximumWarning` de 500kB, aunque eso solo genera advertencia, no error). **No es un error de compilación de TypeScript ni de template** — el build de desarrollo, que no aplica presupuestos, compila sin ningún error. Es puramente una política de tamaño de CSS por componente que el código actual no cumple.

**Nota sobre las capturas de pantalla de pantallas protegidas:** dado que no hay backend disponible en este entorno (`environment.ts` apunta a `http://127.0.0.1:9999`, no accesible), no fue posible completar un login real. Para poder documentar visualmente el shell de `/admin/*` y `/provider/*` (sidebar, layout, estados de carga/error), se inyectó manualmente en `localStorage` del navegador un `auth_user`/`auth_token` sintéticos (vía Puppeteer controlando el mismo Chrome instalado en el sistema, sin modificar ningún archivo del proyecto) — esto no es una vulneración de seguridad ni un login real: el guard de rutas (`roleGuard`) solo verifica la presencia de un rol en el objeto de usuario almacenado localmente, sin validar el token contra el backend hasta la primera llamada HTTP real (que en este entorno falla por falta de red, mostrando correctamente el banner "Sin conexión" — ver capturas). Es la misma técnica que cualquier desarrollador usaría para inspeccionar el frontend sin backend disponible.

**Bloqueo real, no resuelto:** no se pudo probar ningún flujo que requiera datos reales de la API (crear reserva, ver clientes existentes, cobrar un pago) porque no hay una instancia de `Bookwise-API` corriendo y accesible en `127.0.0.1:9999` en este entorno. Esto está fuera del alcance de "no modificar código para hacerlo levantar" — el bloqueo es la ausencia del backend, no un defecto del frontend.

---

## 18. Tests y calidad

**Tests:** 4 archivos, 98 casos, **100% pasando**:
- `app.spec.ts`: creación básica del componente raíz.
- `client-similarity.util.spec.ts`: normalización de texto, matching por teléfono/email, deduplicación.
- `patient-card.component.spec.ts`: iniciales, advertencia de contacto incompleto, link de WhatsApp, tabs, carga lazy.
- `booking-form-dialog.component.spec.ts`: alternancia de paneles, reset de formulario, validación de RUT, detección de pacientes similares.

**Cobertura real:** no configurada (`ng test` no corre con `--coverage` por defecto y no se activó). De 58 archivos TypeScript bajo `src/app`, solo 3 componentes/servicios de negocio tienen test directo — **la mayoría de la lógica del calendario (697 líneas), el diálogo de bloqueo (409 líneas), los servicios de auth/api/cache/disponibilidad, y los 3 listados admin no tienen ningún test**. No hay tests E2E (Cypress/Playwright) en el repo.

**Calidad técnica — puntos positivos:**
- `tsconfig.json` con `strict: true` real (no aflojado).
- Separación consistente por feature, no por tipo (confirmado, coincide con lo que documenta el propio README).
- Alias de import limpios y usados de forma consistente en todo el código revisado.
- Manejo de errores HTTP centralizado y reutilizado en absolutamente todos los componentes revisados (patrón `httpError.handle(err, 'acción')` repetido de forma consistente).
- `OnPush` change detection en varios componentes de listado (`ClientsListComponent`, `AdminDashboardComponent`, `PacksListComponent`, `ProvidersListComponent`, `LocationsListComponent`).

**Calidad técnica — puntos a mejorar:**
- Componentes grandes concentrando fetch + transformación + UI (§12).
- Interfaz `BookingFormData` duplicada entre dos diálogos (§12).
- `CUSTOM_ELEMENTS_SCHEMA` en `FullCalendarComponent` relaja la verificación de templates de Angular para ese archivo — necesario para integrar FullCalendar, pero es una superficie donde errores de template no se detectan en compilación.
- `console.log` residual en código de producción (§9, §15).
- Sin `engines` en `package.json` pese a que Angular 21 tiene requisitos mínimos de Node — el entorno de esta auditoría (Node v22.22.1) funcionó, pero no hay garantía documentada para otros entornos.

---

## 19. Dependencias

Runtime: Angular 21.x (10 paquetes `@angular/*`), PrimeNG 21.1.6 + PrimeIcons + `@primeng/themes` (**paquete marcado como deprecado** por su propio autor: *"Deprecated. Please migrate to @primeuix/themes"* — mensaje real de `npm install`), FullCalendar 6.x (5 subpaquetes), Chart.js 4.x, `intl-tel-input` 28.x, RxJS 7.8.x.

Dev: `@angular/build`, `@angular/cli`, `@angular/compiler-cli`, TypeScript 5.9.x, Vitest 4.x, jsdom 27.x.

**Vulnerabilidades:** ver §15 (`npm audit`: 7, de las cuales 6 son "high").

**Desajuste de tooling:** `package.json` declara `"packageManager": "npm@11.12.1"`, pero el npm disponible en este entorno es `9.2.0`. Esto causó una diferencia real y reproducible: al correr `npm install` con npm 9.2.0, `package-lock.json` se reescribió (perdiendo metadata `libc` de paquetes opcionales, y normalizando el campo `"name"` de `"e-commerce"` a `"bookwise"` — ver nota de branding en el resumen ejecutivo). **Se revirtió ese cambio con `git checkout -- package-lock.json`** antes de cerrar esta auditoría, por lo que el repositorio queda intacto, pero el hallazgo en sí (el lockfile committeado tenía `"name": "e-commerce"`) es evidencia adicional de un rebranding incompleto, independiente de la versión de npm usada para generarlo.

**Deprecaciones activas:** `@primeng/themes` (usado en `app.config.ts` y `theme.service.ts`) vs. `@primeuix/themes` (usado directamente en `theme.service.ts` para `updatePreset` — **el proyecto ya depende de ambos paquetes simultáneamente**, uno deprecado y su reemplazo, probablemente producto de una migración a medio terminar de PrimeNG.

---

## 20. Estado de preparación para despliegue

Es una **SPA pura** (`browser` target de `@angular/build:application`, sin SSR/SSG — no hay `provideServerRendering` ni configuración de Angular Universal en el repo). Requiere:

- Un servidor de archivos estáticos con **fallback a `index.html`** para que el enrutamiento del lado del cliente funcione en refresh/deep-link (no hay configuración de `nginx.conf`, `.htaccess`, `web.config`, `_redirects` ni `vercel.json`/`netlify.toml` en el repo — **debe crearse**, no existe hoy).
- Compatibilidad genérica con **Nginx, Apache, IIS, Cloudflare Pages, Netlify, Vercel o cualquier CDN**, siempre que se configure el fallback SPA — nada en el código ata el proyecto a un proveedor específico.
- Un **servidor Node solo sería necesario si se decide migrar a SSR** — no es necesario para el estado actual del proyecto.
- La API en producción se espera en la **misma ruta relativa `/api/v1`** del mismo origen (o vía proxy inverso) — esto es una decisión de infraestructura que Bookwise-API y el equipo de arquitectura deben confirmar; el frontend no trae configuración de proxy propia.

**Bloqueador de build (repetido de §17):** `ng build` con la configuración por defecto (`production`) falla hoy. No se puede generar un artefacto de producción tal como está el repo sin: (a) reducir el CSS de los 3 componentes señalados, o (b) ajustar los presupuestos en `angular.json`. Esta decisión es del equipo — **no se modificó nada**, conforme a las restricciones del encargo.

**Source maps:** la configuración `production` de `angular.json` no fija `sourceMap` explícitamente; el comportamiento por defecto de Angular CLI en producción es `sourceMap: false`, por lo que no deberían filtrarse en el bundle final — no verificable de forma definitiva sin lograr un build de producción exitoso.

**Compresión / HTTPS / headers de seguridad / caché / dominio:** ninguno está configurado en el repositorio (no hay `nginx.conf`, Dockerfile, ni pipeline) — son responsabilidad exclusiva de la infraestructura de destino, que no existe todavía en este repo.

**Docker / CI/CD:** no hay `Dockerfile`, `docker-compose.yml`, ni carpeta `.github/workflows` (ni ningún otro sistema de CI) en el repositorio.

---

## 21. Propuesta inicial de infraestructura

(Propuesta preliminar — no implementada, sujeta a decisión del equipo de arquitectura)

- **Desarrollo:** `ng serve` local contra una instancia local o compartida de `Bookwise-API`. Sin cambios necesarios salvo resolver el punto de acceso a la API para cada desarrollador.
- **QA/Staging:** build de producción (una vez resuelto el bloqueador de presupuesto de CSS) servido como estático (Nginx, Cloudflare Pages o similar) con `environment.prod.ts` apuntando a `/api/v1` detrás de un proxy inverso hacia una instancia de staging de `Bookwise-API`, o bien introducir un tercer archivo `environment.staging.ts` con una URL absoluta si staging y la API no comparten origen — **hoy no existe ese tercer ambiente**, habría que crearlo.
- **Producción:** mismo esquema que staging, con el dominio/CDN definitivo, HTTPS, cabeceras de seguridad (especialmente CSP, dado el hallazgo de §15) y un pipeline de CI que al menos corra `npm ci && npm test && ng build` antes de publicar — ninguno de estos pasos existe hoy en el repo.
- Se recomienda decidir explícitamente **quién resuelve el fallback SPA** (`try_files $uri /index.html;` en Nginx, o el equivalente en el proveedor elegido) antes de la primera publicación, ya que su ausencia rompe cualquier acceso directo a una ruta que no sea `/`.

---

## 22. Riesgos

| Riesgo | Impacto | Evidencia |
| --- | --- | --- |
| Build de producción no genera artefacto hoy | Bloquea cualquier despliegue tal como está el repo | §17, §20 (ejecutado y reproducido) |
| Branding "Kinesilk" visible en producción si se despliega sin revisión | Reputacional / confusión de usuarios y posible filtración de que el producto proviene de un cliente/proyecto anterior | §11 (capturado en pantalla) |
| 6 vulnerabilidades "high" en el propio Angular (XSS por sanitización) | Seguridad — superficie de ataque real en el framework base | §15 (`npm audit` real) |
| Ausencia de CSP y de gestión segura de token | Un XSS exitoso compromete la sesión sin fricción adicional | §15 |
| Disponibilidad de profesional 100% simulada | Cualquier decisión de negocio basada en esa pantalla hoy es ficticia; si se despliega así, un profesional real "guardaría" un horario que se pierde al recargar | §7, §9 |
| Gráficos del dashboard con datos de ejemplo sin distinción visual | Riesgo de que un administrador tome decisiones basado en números que no son reales | §11 |
| Tres pantallas de "gestión" (ubicaciones, profesionales, packs) son solo de lectura | Expectativa de negocio (CRUD completo) vs. realidad del código — brecha funcional no documentada previamente de forma explícita | §7 |
| Cobertura de test muy acotada (3 de 58 archivos) | Cambios futuros en calendario, diálogos de bloqueo o servicios core pueden romper funcionalidad sin que ningún test lo detecte | §18 |
| README desactualizado en puntos de arquitectura de negocio (rol cliente) | Riesgo de que nuevos integrantes del equipo asuman capacidades que no existen | §6, §24 |

---

## 23. Bloqueadores

1. **`ng build` (producción) falla** por presupuestos de CSS excedidos en 3 componentes — impide generar un artefacto desplegable sin una decisión del equipo (reducir CSS o ajustar `angular.json`). Confirmado por ejecución real, no es una suposición.
2. **No hay backend accesible** en este entorno (`127.0.0.1:9999` no responde) — impide verificar cualquier flujo de extremo a extremo (login real, creación de reserva, pagos, contratos de API reales). No se intentó ni se debía intentar levantar el backend como parte de este encargo.
3. **No hay infraestructura de despliegue definida** (sin Dockerfile, sin CI, sin configuración de servidor web) — cualquier estrategia de publicación debe crearse desde cero, no adaptarse de algo existente.

---

## 24. Incógnitas

Todo lo siguiente es `NO DETERMINADO` desde este repositorio, con la razón puntual:

- **Comportamiento real del backend Laravel** (reglas de colisión de agenda, validación de precios, consumo de sesiones de pack, autorización real por rol) — el backend no fue auditado, solo se documentó lo que el frontend *espera*.
- **Si "cliente" y "paciente" son sinónimos oficiales del dominio** o solo una mezcla de etiquetas de UI — el modelo usa `Client`/`clients` en todo el código, pero la UI dice "Paciente" en el formulario de reserva y en `PatientCardComponent`.
- **Por qué el README describe un flujo de autoservicio de cliente que no existe en las rutas** — pudo ser una funcionalidad planeada y descartada, o documentación aspiracional nunca sincronizada con el código. No hay manera de saberlo sin preguntar al equipo.
- **Origen exacto del nombre "Kinesilk"** y si el proyecto fue efectivamente clonado de un producto anterior con ese nombre, o si es un placeholder interno — la evidencia (branding visible + comentario de código + nombre en lockfile) es consistente con un rebranding incompleto, pero no hay confirmación explícita en ningún archivo.
- **Contraste de color y navegación por teclado real** — requieren herramientas (axe, Lighthouse, prueba manual) no ejecutadas en este levantamiento.
- **Compatibilidad cross-browser real** (Safari, Firefox, versiones específicas) — las capturas se tomaron con Chromium headless únicamente.
- **Comportamiento en dispositivos táctiles reales** — solo se emuló el viewport, no gestos táctiles.
- **Propósito de `src/env.ts`** (excluido en `.gitignore` pero inexistente y sin referencias en el código) — posible mecanismo de secretos previsto pero nunca implementado, o resto de otra plantilla de proyecto.
- **Resultado de un `ng build` de producción una vez resuelto el presupuesto de CSS** — no se puede confirmar que no aparezcan más errores más allá de los 3 ya identificados, porque el build se detiene en el primer conjunto de errores.

---

## 25. Recomendaciones priorizadas

**Antes de cualquier despliegue (bloqueante):**
1. Resolver el fallo de `ng build` en producción: reducir el CSS de `patient-card`, `provider-calendar` y `full-calendar`, o decidir conscientemente subir el presupuesto `anyComponentStyle` en `angular.json` (esto último es una decisión de política de equipo, no solo técnica).
2. Reemplazar toda referencia a "Kinesilk" (registro y layout de profesional) por la marca Bookwise, y auditar si hay más restos del nombre anterior en assets, comentarios o configuración no revisados en detalle.
3. Definir y documentar la estrategia de despliegue (fallback SPA, proxy de `/api/v1`, HTTPS, CSP) antes de publicar en cualquier ambiente compartido.

**Alta prioridad, no bloqueante:**
4. Agregar una Content-Security-Policy y revisar la estrategia de almacenamiento de token (evaluar si el riesgo de XSS + localStorage es aceptable para el negocio o si conviene una alternativa).
5. Actualizar Angular a una versión que resuelva las 6 vulnerabilidades "high" reportadas por `npm audit`, validando que no rompa nada (hay next/prerelease de por medio, requiere pruebas).
6. Decidir si `/admin/locations`, `/admin/providers` y `/admin/packs` deben tener alta/edición real, o si la gestión de esas entidades vive intencionalmente en otro sistema — hoy es una laguna funcional silenciosa.
7. Implementar el endpoint real de disponibilidad de profesional y eliminar el mock en memoria antes de que un profesional real dependa de esa pantalla.
8. Traducir "Locations" (KPI del dashboard y título de página) al español, y hacer un barrido de i18n sobre el resto de textos hardcodeados que puedan haber quedado fuera de `es.ts`/`en.ts`.

**Media prioridad:**
9. Ampliar cobertura de tests a calendario, diálogo de bloqueo y servicios core (`auth`, `api`, `data-cache`, `availability`) antes de que se vuelvan más complejos.
10. Unificar `BookingFormData` en un solo tipo compartido entre `BookingDialogComponent` y `BookingFormDialogComponent`.
11. Eliminar el `console.log` de `payment-tab.component.ts` y auditar si hay más (se encontró solo uno, pero vale un barrido periódico).
12. Resolver la convivencia de `@primeng/themes` (deprecado) y `@primeuix/themes` — completar la migración a uno solo.
13. Corregir el solapamiento de toasts en mobile y sobre el header de `/provider/availability`.

**Baja prioridad / seguimiento:**
14. Actualizar el README para reflejar que no existe autoservicio de cliente final, o construir esa funcionalidad si sigue siendo un objetivo del producto.
15. Añadir `engines` a `package.json` para fijar la versión mínima de Node soportada.
16. Evaluar accesibilidad con herramientas automatizadas (axe/Lighthouse) una vez que haya un ambiente estable con datos reales.

---

## 26. Próximos pasos

1. Compartir este documento con el jefe de proyecto, el arquitecto de software y el diseñador de sistemas para validar los hallazgos antes de planificar trabajo.
2. Contrastar la sección "Contrato preliminar Frontend → API" (§10) con el análisis equivalente del backend (Bookwise-API), para identificar endpoints faltantes, con forma distinta a la esperada, o reglas de negocio no implementadas.
3. Decidir, como equipo, la resolución del bloqueador de build (§17, §23) antes de fijar cualquier fecha de despliegue.
4. Definir con el diseñador de sistemas si el hallazgo de branding "Kinesilk" requiere solo un reemplazo de texto o una revisión visual más amplia de esas dos pantallas.
5. Priorizar, junto al jefe de proyecto, cuáles de las recomendaciones de §25 entran en el próximo ciclo de trabajo.
6. Una vez resuelto el build, repetir la captura de evidencia visual (§13) contra un build de producción real y, si es posible, contra un backend real para documentar los flujos de extremo a extremo que hoy no se pudieron probar.

---

## Tabla de decisiones

| ID | Tema | Estado actual | Riesgo | Decisión necesaria | Responsable sugerido |
| --- | --- | --- | --- | --- | --- |
| D1 | Build de producción falla por presupuesto de CSS | 3 componentes exceden el límite de 8kB definido en `angular.json` | Alto — bloquea despliegue | Reducir CSS de los 3 componentes vs. ajustar el presupuesto en `angular.json` | Arquitecto de software + equipo frontend |
| D2 | Branding "Kinesilk" visible en registro y layout de profesional | Confirmado visualmente en producción de código actual | Alto — reputacional | Reemplazar texto/estilos por marca Bookwise; auditar otros restos | Diseñador de sistemas + equipo frontend |
| D3 | Disponibilidad de profesional es 100% mock (sin persistencia real) | Funcional en UI, no persiste datos reales | Alto — decisiones de negocio sobre datos ficticios | Priorizar implementación del endpoint real en el backend y conexión desde el frontend | Arquitecto de software + equipo backend |
| D4 | Gráficos del dashboard con datos fijos de ejemplo | Mezclados sin distinción visual con KPIs reales | Medio — confusión de datos reales vs. ilustrativos | Conectar a datos reales o marcar explícitamente como "ejemplo" | Jefe de proyecto + equipo frontend |
| D5 | Ubicaciones/Profesionales/Packs son solo de lectura en el frontend | Sin alta/edición desde la UI admin | Medio — brecha funcional no documentada | Confirmar si la gestión vive en otro sistema o debe construirse aquí | Jefe de proyecto |
| D6 | 6 vulnerabilidades "high" en dependencias de Angular (XSS) | Confirmado con `npm audit` | Alto — seguridad | Planificar actualización de Angular con plan de pruebas | Arquitecto de software |
| D7 | Sin CSP ni headers de seguridad definidos | No configurado en ningún archivo del repo | Alto (en combinación con D6 y con token en localStorage) | Definir CSP y cabeceras como parte de la infraestructura de despliegue | Arquitecto de software + DevOps |
| D8 | Sin infraestructura de despliegue (Docker/CI/servidor web) | Inexistente en el repositorio | Alto — sin esto no hay despliegue reproducible | Definir estrategia (Nginx/Docker/CDN) y crear pipeline de CI | Arquitecto de software + DevOps |
| D9 | README describe autoservicio de cliente final inexistente | Contradicción documentación vs. código | Medio — puede desalinear expectativas del equipo/negocio | Actualizar README o confirmar si es roadmap pendiente | Jefe de proyecto |
| D10 | Cobertura de tests limitada a 3 de 58 archivos | Suite actual pasa 98/98, pero cubre poca superficie | Medio — riesgo de regresiones futuras | Priorizar tests en calendario, bloqueos y servicios core | Equipo frontend |
