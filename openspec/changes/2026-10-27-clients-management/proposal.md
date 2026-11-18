# Pedido FE → BE — Manejo de clientes / "Base de Pacientes" (2026-10-27)

Contexto: el frontend va a rehacer la gestión de clientes siguiendo una referencia de producto
(panel de filtros avanzados, buscador global, contador con total real, columnas ordenables,
detalle, alta/edición y desactivación). El usuario decidió hacer **todo** en una entrega y pedir
**todo** el contrato ahora. Este documento es el pedido concreto; nada de esto está implementado
todavía en el frontend.

## 1. Lo que ya existe (verificado)

Frontend (`Bookwise`, `feat/contract-catchup`):

- `Client` ya modela `rut`, `gender`, `custom_attributes`, `notifications_enabled`,
  `notification_prefs`, `created_at`, `updated_at`, `active`, `wc_customer_id`.
- `ClientsApiService`: `GET /clients` (tipado array plano), `GET /clients/{id}` (desenvuelve
  `{data}`), `POST /clients`, `PATCH /clients/{id}`, `GET /clients/{id}/packs`.
- Catálogo de permisos con `clients.view`, `clients.create`, `clients.update`.
- Ya existen componentes de presentación reusables: `bw-patient-card`, `bw-patient-detail-content`.

Backend (según `Bookwise-API` → `docs/.../api-endpoints.md`, a confirmar por el mantenedor):

- `GET /clients` con scope `clients:read`; `POST` y `PATCH /clients/{id}` con `clients:write`.
- `POST /clients` valida RUT chileno (`ChileanRutRule`).
- Resource del cliente documentado como
  `{ id, first_name, last_name, email, phone, rut, gender, wc_customer_id, active }`.
- **No** hay `DELETE /clients` documentado.

## 2. Preguntas que bloquean el frontend

### 2.1 Forma de las respuestas de listado — BLOQUEANTE

Hoy `GET /providers` y `GET /locations` devuelven **array plano en la raíz** (se confirmó que el
controlador hace `response()->json(Resource::collection($paginator))`, saltándose
`PaginatedResourceResponse`). Eso ya nos rompió las dos listas en producción.

Necesitamos saber, para `GET /clients`:

1. ¿Devuelve array plano o `{data, links, meta}`?
2. ¿Se puede estandarizar a `{data, links, meta}` en **todos** los listados (`clients`,
   `providers`, `locations`)? Es la única forma de tener `meta.total` y `meta.last_page`.

Sin `meta` no podemos mostrar "Mostrando X de N" ni paginar de verdad: solo podríamos pedir una
página y deducir el final por tamaño de página.

### 2.2 Fecha de nacimiento — BLOQUEANTE

El filtro "Cumpleaños" (rango Desde/hasta) de la referencia no tiene respaldo: el resource no
incluye fecha de nacimiento y el modelo del frontend tampoco.

Pedimos: campo `birth_date` (date, nullable) en `clients`, expuesto en el resource, aceptado en
`POST`/`PATCH` con validación (`date`, no futura, formato `YYYY-MM-DD`).

### 2.3 Filtros aceptados hoy por `GET /clients` — BLOQUEANTE

El frontend hoy solo manda `search`, `location_id`, `page`, `per_page`. Necesitamos el contrato
completo de query params. Filtros que la pantalla va a ofrecer:

| Filtro UI | Query param propuesto | Origen del dato |
|---|---|---|
| Buscador global | `search` | nombre, apellido, RUT, email, teléfono |
| Activo / inactivo | `active` | columna propia |
| Local/sede | `location_id` | existe, pero es agregado sobre `bookings` |
| Profesional/prestador | `provider_id` | agregado sobre `bookings` |
| Servicios | `service_id` | agregado sobre `bookings` / `client_packs` |
| Estado de la reserva | `booking_status_id` | agregado sobre `bookings` |
| Género | `gender` | columna propia |
| Cumpleaños | `birth_date_from` / `birth_date_to` | requiere 2.2 |
| Creado en el período | `created_from` / `created_to` | `created_at` |
| ¿Ha reservado? | `has_booked` | agregado sobre `bookings` |
| Personalizados | `custom_attributes[...]` | requiere 2.10 |

Preguntas: ¿cuáles existen ya, cuáles hay que construir y cuáles se descartan? Los cinco que
cruzan `bookings` implican joins/`EXISTS`: decinos si los tomás y con qué costo aceptable.

### 2.4 Semántica de "¿Ha reservado?"

¿"Tiene alguna reserva alguna vez" o "tiene reserva futura"? Propuesta del frontend: dos valores
(`ever` / `upcoming`) en vez de un booleano ambiguo. Si es solo booleano, decir cuál.

### 2.5 Orden por columna — BLOQUEANTE junto con 2.1

La referencia ordena por Nombre, Apellido, Correo, Teléfono y RUT. Con paginación server-side el
orden tiene que ser del servidor. Pedimos `sort` + `direction` (`asc|desc`) con **allowlist**:
`first_name`, `last_name`, `email`, `phone`, `rut`, `created_at`. Default: `last_name asc`.

### 2.6 Ciclo de vida y desactivación

El usuario decidió que el tacho de la referencia **desactive (soft)**, no borre. Necesitamos:

1. Confirmar que no habrá `DELETE /clients` (igual que providers/locations).
2. `PATCH /clients/{id}` con `{ active: false }` desactiva.
3. **Consecuencia**: ¿qué pasa si el cliente tiene reservas futuras y/o packs con sesiones
   disponibles? ¿Se permite desactivar igual (dejando las reservas vivas), hay `409
   requires_confirmation` con `affects`, o se bloquea? Con eso escribimos el copy y el flujo.
4. ¿Desactivar afecta la creación de reservas nuevas para ese cliente?

### 2.7 RBAC

- ¿Qué scope y permiso exige cada operación? El catálogo del frontend ya tiene
  `clients.view`, `clients.create`, `clients.update` (no existe `clients.manage`).
- ¿Desactivar requiere `clients.update`?
- ¿Los filtros de listado requieren algún scope extra (por ejemplo, ver `bookings` para el filtro
  por estado de reserva)?

### 2.8 `per_page` en `/clients`

Ya se acotó a **1–100** en `/providers` y `/locations` (422 `errors.per_page` fuera de rango).
¿`/clients` tiene el mismo tope? ¿Default 15?

### 2.9 RUT

- ¿Es único por tenant? ¿Qué error devuelve al duplicar (`422 errors.rut`)?
- ¿`PATCH` también valida con `ChileanRutRule`, o solo `POST`?
- ¿Se normaliza (con o sin puntos/guion) o se guarda tal cual lo escribe el usuario?

### 2.10 Campos del resource

¿El resource actual expone `created_at`, `custom_attributes`, `notifications_enabled` y
`notification_prefs`? El modelo del frontend los declara, pero el resource documentado no los
lista. El filtro "Creado en el período" y el orden por creación necesitan `created_at`.

## 3. Criterios de aceptación del lado backend

1. `GET /clients` documentado con **todos** sus query params y la forma exacta de la respuesta
   (plano o `{data, links, meta}`), con `meta.total` y `meta.last_page`.
2. `birth_date` en el resource y en `POST`/`PATCH`.
3. Orden server-side con allowlist y default explícito.
4. Contrato de desactivación con las consecuencias de §2.6.
5. Tabla de scopes/permisos por operación (§2.7).
6. Un test que cubra cada filtro nuevo (idealmente uno por combinación de agregado).

## 4. Qué hace el frontend cuando esté cerrado

1. Rediseñar `clients-list` con el panel de filtros de la referencia (colapsables + Buscar +
   Reestablecer), buscador global, contador y columnas ordenables.
2. Detalle de cliente reusando `bw-patient-detail-content` + reservas y packs.
3. Alta/edición gateadas con `clients.create` / `clients.update`.
4. Desactivar con confirmación y el copy de consecuencias que salga de §2.6.
5. i18n es/en de toda la pantalla (hoy no existe ninguna clave `clients.*`).
6. Specs + `ng build` + `ng test`, y review nativo antes de entregar.

Fuera de alcance declarado: **Importar pacientes** y **Crear una audiencia con este listado**.

## 5. Referencias frontend

- `odd/tasks/clientes-base-de-pacientes.md` — estado actual, gaps y tasks.
- `src/app/features/admin/clients/` — pantalla actual (lista mínima).
- `src/app/core/services/api/clients-api.service.ts` — contrato que consume hoy el frontend.
- Imágenes de referencia: `/mnt/d/documentos/trabajo/kinesilk/registro de pacientes.png`,
  `filtros de paciente.png`, `filtros de paciente 2.png`.
