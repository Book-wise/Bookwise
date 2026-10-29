# Deploy + verificación: contrato de feriados y días laborables

Checklist para cuando el backend pase el hash del contrato (holidays + tenant settings).
Rama frontend: `feat/contract-catchup` (10 commits locales, sin push).

## 0. Prerequisitos de datos (sino no se puede verificar nada)

- [ ] Backend con la migración `holidays` corrida (`tenants:migrate`).
- [ ] Feriados cargados del año: `php artisan holidays:sync 2026` (y 2025/2027 si se quiere cubrir navegación). Confirmar **16 feriados 2026**.
- [ ] Sucursal **A** con `working_days` configurado (ej. `[1,2,3,4,5,6]`, lun–sáb).
- [ ] Sucursal **B** con los 7 días (o distinto) para ver el cambio de sombreado al cambiar de sucursal.
- [ ] Tenant con `block_bookings_on_holidays` **true** y después probar **false** (mismo tenant alcanza).
- [ ] Un provider con al menos una `location_id` asignada (para la agenda del profesional).

## 1. Deploy backend

- [x] Merge del contrato a `develop` — **`ed801fb`** (review nativa aprobada; se corrigió un finding crítico de `TenantContext` stale que podía filtrar config de otro tenant en `/available_slots`).
- [ ] **Deploy a dev (`dev.bookwise.cl`)** — ⛔ **BLOQUEADO por credenciales SSH del servidor** (lo resuelve el encargado del droplet en DigitalOcean). NO es código/contrato. El backend avisa apenas corra. Hasta entonces, las migraciones (columna nueva `block_bookings_on_holidays` + drop de `locations.works_on_holidays`) **NO** están aplicadas: no dar el contrato por vivo en dev.
- [ ] `php artisan migrate` / `tenants:migrate` (migración `holidays`).
- [ ] `php artisan holidays:sync 2026`.
- [ ] Deploy.

### Smoke tests de API (antes de mirar la UI)

- [ ] `GET /api/v1/holidays?year=2026` → `{ "data": [ { "date": "2026-01-01", "name": "Año Nuevo" }, ... ] }` (envelope, array plano, ordenado por fecha).
- [ ] `GET /api/v1/holidays?from=2026-12-01&to=2027-01-31` → rango **inclusivo**, cruza año.
- [ ] `GET /api/v1/holidays?year=2026&from=2026-12-01&to=2027-01-31` → **422** (params excluyentes).
- [ ] `GET /api/v1/available_slots?start_date=<feriado>&location_id=<A>` → `meta.is_holiday: true`, `meta.holiday_name`, `meta.total_slots: 0` (si bloquea).
- [ ] `GET /api/v1/tenant/settings` (admin) → incluye `block_bookings_on_holidays`.
- [ ] `PATCH /api/v1/tenant/settings { "block_bookings_on_holidays": false }` → 200, y **no** pisa `business_name` (parcial).
- [ ] `GET /api/v1/auth/me` (provider) → `user.business.block_bookings_on_holidays` presente.
- [ ] `POST /api/v1/bookings` en feriado con bloqueo ON → **422** `{ "error": "non_working_day", "detail": "..." }`.
- [ ] `POST`/`PATCH /api/v1/locations` con `working_days: []` → **422** bajo `errors.working_days`.

## 2. Deploy frontend

- [ ] Merge de `feat/contract-catchup` (o `develop` con los 10 commits) y deploy.
- [ ] `ng build` verde en el pipeline.

## 3. Verificación en dev — UI

### 3.1 Configuraciones — toggle global (`/admin/configuraciones`, admin)
- [ ] Aparece la sección **"Feriados"** con el toggle "Bloquear reservas en feriados".
- [ ] El toggle refleja el valor actual del tenant.
- [ ] Cambiarlo llama `PATCH /tenant/settings` (parcial) y persiste (recargar y verificar).
- [ ] Si el PATCH falla → el toggle **revierte** al valor previo y muestra toast de error.
- [ ] Un **provider** no ve esta sección (solo admin).

### 3.2 Diálogo de sucursal (`/admin/locations` → editar)
- [ ] 7 checkboxes **Lun–Dom**, con **Lun–Sáb tildados** por defecto en "Nueva sucursal".
- [ ] Destildar todos → el botón Guardar queda deshabilitado (validación no-vacío).
- [ ] Guardar persiste `working_days` (reabrir y verificar tildes).
- [ ] **Horas (R3-002)**: en una sucursal "sin configurar" (horas `null`, muestra `08:00`/`22:00` por `effective_*`), editar **solo el nombre** y guardar → el horario **sigue sin configurar** (no se materializa `08:00:00`). Verificar en el PATCH que no viaja `opening_time`.
- [ ] Vaciar un horario y guardar → envía `null` explícito (vuelve a "sin configurar").

### 3.3 Agenda admin (`/admin/calendar`)
- [ ] **Feriados del año**: el frontend carga el **año actual ±1** (`new Date().getFullYear()`, dinámico) en ambas agendas — el año en curso siempre está cubierto. Verificar con un feriado del año actual y, si se puede, cruzar al año siguiente (ene del año+1 ya cargado).
- [ ] Día con weekday **fuera** de `working_days` de la sucursal elegida → celda **rayada** (`.fc-day-closed`).
- [ ] **Feriado con bloqueo ON** → celda con patrón **ámbar** (`.fc-day-holiday`) **y** nombre del feriado en el header del día (escritorio). En **mobile**, badge `●` con el nombre en tooltip.
- [ ] **Feriado con bloqueo OFF** → etiqueta/nombre del feriado **sin** rayado; la agenda opera normal.
- [ ] Cambiar de sucursal A → B → el sombreado se recalcula según `working_days` de cada una.
- [ ] **Scroll**: `rerenderDays()` ahora **guarda/restaura** el scroll de `.fc-scroller` alrededor de `calendar.render()`. Verificar que al cargar feriados o cambiar de sucursal la vista **semana** no salta a 08:00.

### 3.4 Agenda del profesional (`/provider/calendar`)
- [ ] Sombreado de **feriados** según `auth.me().business.block_bookings_on_holidays`.
- [ ] Sombreado de **días no laborables** según `working_days` de su sucursal (vía `ReferenceStore`).
- [ ] **Hidratación**: se re-renderiza al cambiar `ReferenceStore.locations()`, así el sombreado por **weekday** aparece cuando llegan las locations (no solo feriados). Verificar que aparece.
- [ ] **Mobile**: en vista semana, el nombre del feriado se ve como badge `●` con tooltip.
- [ ] Mismo chequeo de scroll que 3.3.

### 3.5 Reservas en feriado bloqueado
- [ ] Crear/editar reserva en fecha feriado con bloqueo ON → toast **"Sucursal cerrada"** con detalle "La sucursal no atiende en la fecha indicada: día no laborable o feriado." (no un error crudo).
- [ ] Cubre tanto el form de reserva como el drag/resize de la agenda (ambos pasan por `httpError`).

### 3.6 Regresiones de esta tanda
- [ ] Selector de profesionales de la agenda: muestra **todos los activos** (incluida Ana, recepcionista) — sin filtro de rol.
- [ ] Badges de cobro en eventos: `paid` → `$`, `partial` → `A`, `unpaid` → sin badge (igual que la leyenda).
- [ ] `available_slots` con el shape nuevo (`start`/`end`/`meta`) no rompe nada (no tenía consumidores productivos; solo specs).

- [ ] El botón de la guía de estados (icono `?`) **abre con click y cierra con un segundo click**.
- [ ] La guía incluye **"Feriado (cerrado)"** (swatch ámbar) y **"Día no laborable"** (swatch gris claro).

## 4. Regresión automatizada
- [ ] Suite completa: esperar **~7 flaky preexistentes** (`calendar-navigation`, `booking-detail-dialog`, `booking-form-dialog` ×2, `historial-reserva` ×3). Nada nuevo en locations/calendario/config.
- [ ] Specs nuevas verdes: `location-dialog` (16), `holidays-api` (3), `configuraciones` (3), `calendar-holidays.util` (5), `full-calendar` (40).

## 5. Follow-ups conocidos (del review `review-984ef1f58c46b26b`, informativos)
Sin corrección obligatoria; tratar como trabajo posterior:
- R3-001/002/004 (WARNING): lógica de sombreado/carga de feriados + `calendar.render()` (el caveat de scroll).
- R3-003 (WARNING): `effect` de carga de tenant settings en configuraciones.
- R3-005 (WARNING): snapshot de horas en el diálogo.
- R3-006/007 (SUGGESTION): `isDayClosed` y `getHolidays`.

## 6. Rollback / notas
- El sombreado es **calculado en el front** (no materializa BlockedSlots). Desactivarlo = apagar `block_bookings_on_holidays` o desplegar el front anterior; no hay datos que limpiar.
- `available_slots` cambió de shape (`date`→`start_date`, `start_time/end_time`→`start/end`); el front nuevo ya lo consume bien. Si se revierte el front, el backend nuevo sigue aceptando `start_date`.

## Commits de esta tanda (rama `feat/contract-catchup`)
`0ca1603` filtro de rol · `2a1f667` business-days T1/T2/T4/T5 · `80fd3f1` R3-002 horas · `b96d0b2` retiro works_on_holidays · `3383844` cleanups · `3f591f9` holidays service + available_slots · `66028b7` tenant settings + toggle · `e82e56e` sombreado admin · `e6e347a` sombreado provider.
