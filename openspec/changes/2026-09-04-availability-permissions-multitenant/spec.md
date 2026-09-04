# Spec — Contrato de disponibilidad por profesional (backend)

> Contrato de intercambio para el backend. El front ya consume `AvailabilityStore` + preview; al conectar el endpoint real solo cambia el service.

## Modelo de datos

- `provider_availability`: `id`, `provider_id` (FK), `location_id` (FK), `day_of_week` (0=domingo..6=sábado), `start_time` (time), `end_time` (time), `is_active` (bool).
- `provider_availability_overrides`: `id`, `provider_id`, `location_id`, `date` (date), `start_time` (time), `end_time` (time), `is_active` (bool).
- Regla overrides: si existen filas para una fecha → ESA es la disponibilidad del día (ninguna activa = no disponible). Si no → plantilla semanal del día de la semana.

## Endpoints

### 1) Plantilla + overrides
```
GET /api/v1/providers/{provider}/availability
```
```json
{ "data": { "provider_id": 1, "location_id": 1,
  "weekly": [ { "day_of_week": 1, "start_time": "09:00", "end_time": "18:00", "is_active": true } ],
  "overrides": [ { "date": "2026-09-20", "start_time": "09:00", "end_time": "13:00", "is_active": true } ] } }
```
```
PUT /api/v1/providers/{provider}/availability   // body = { weekly, overrides }; reemplazo transaccional, idempotente
```
Permisos: solo el propio provider / admin_local / admin_general del tenant. Recepcionista/staff → solo `GET`. `403` si no autorizado.

### 2) Disponibilidad efectiva por rango (consolidado)
```
GET /api/v1/availability/{provider}?from=YYYY-MM-DD&to=YYYY-MM-DD
```
```json
{ "data": [ { "date": "2026-09-04", "source": "weekly",
   "windows": [ { "start_time": "09:00", "end_time": "10:00" }, { "start_time": "11:30", "end_time": "18:00" } ],
   "booked_minutes": 90, "blocked_minutes": 0, "is_available": true } ] }
```
- `windows` ya descuenta reservas y bloqueos.
- **Agente** (rol `agent`): `from` se clampa a hoy → no revela pasado.
- **Usuarios de app**: permiten `from` en pasado (revisión).

### 3) Upgrade consultas existentes
- `GET /api/v1/available_slots` → usar plantilla/overrides del provider + bloqueos.
- `GET /api/v1/agent/check-availability` → idem; nunca sugiere horario pasado.

### 4) Precondición al crear reserva (flujo humano)
- `POST /api/v1/bookings` rechaza si el slot cae fuera de las ventanas efectivas → `409 { "error": "invalid_input", "conflict": { "type": "out_of_availability" } }`.
- Mantener conflictos `booking` y `blocked_slot`.
- **Siempre** rechaza `start_time < hoy`.

## Reglas transversales
- Disponibilidad pertenece al **profesional** (`provider_id`) + **sucursal** (`location_id`), no al rol.
- Provider **inactivo** o **location inactiva** → no agendable, no visible para agente/staff; el provider no modifica su info; admin/admin_local sí lo ven.
- **Auditoría**: `provider_availability_changes` + `GET /providers/{id}/availability/changes`.
- **Notificación** al profesional cuando un admin sobreescribe.
- **Staff** con permisos de escritura agenda solo para sí mismo.

## Notas
- Zona horaria: horas en la timezone de la location (America/Santiago); `available_slots` devuelve ISO con tz.
- El token `agent` **no** tiene `bookings:write` → el agente consulta y presenta; la reserva la confirma cliente/humano.
- Naming: "Carlitox" mailer (Mailgun) es distinto del agente conversacional (`AgentController` / `api/v1/agent/*`).
