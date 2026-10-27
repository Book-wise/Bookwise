# Manejo de clientes ("Base de Pacientes")

Rehacer la gestión de clientes del panel admin siguiendo la referencia de Kinesilk
("Base de Pacientes"): listado con panel de filtros avanzados, buscador global, contador con
total real, columnas ordenables, detalle del cliente, alta/edición y desactivación.

## Specs

- S1 (usuario, verbatim): "puedes revisar la imagen registro de pacientes en esta ruta y ademas
  la imagen filtro de pacientes y filtro de pacientes 2 para formular el manejo de clientes?"
- S2 (usuario, decisión): la primera entrega es **todo, incluidos los filtros avanzados**
  (no por fases: lista + filtros + detalle + alta/edición).
- S3 (usuario, decisión): los filtros que hoy no tienen respaldo (cumpleaños, ¿ha reservado?,
  servicio/profesional) se le piden al backend **ahora**, no después.
- S4 (usuario, decisión): el tacho de basura de la referencia **desactiva (soft)**, no borra.
- S5 (usuario, verbatim): "comunicate con el backend cuando necesites".

## Estado actual (verificado 2026-10-27 en este repo)

| Pieza | Hallazgo |
|---|---|
| `src/app/app.routes.ts:62-64` | Ruta `clients` con `abilityGuard(ABILITIES.clientsView)` |
| `clients-list.component.ts` (68 líneas) | Buscador + tabla. Llama `getClients({ search })` **sin `per_page`** → el API devuelve 15 → **la lista se trunca a 15 clientes** |
| `clients-list.component.html` (74 líneas) | Botones "Ver" y "Ver Packs" **sin `(onClick)`** (decorativos); `type="text"` duplicado; strings hardcodeados; `[paginator]="true" [rows]="10"` client-side sobre lo que llegó |
| `core/models/index.ts:97-112` | `Client` ya tiene `rut`, `gender`, `custom_attributes`, `notifications_enabled`, `notification_prefs`, `created_at`. **No tiene fecha de nacimiento** |
| `clients-api.service.ts` | `getClients({location_id, search, page, per_page})` tipado `Client[]` (array plano) · `getClient(id)` desenvuelve `{data}` · `createClient` / `updateClient` |
| `booking-form-dialog.component.ts:564` | Único lugar que crea clientes hoy (alta al vuelo en la reserva) |
| `shared/components/patient-card/` | Ya existen `bw-patient-card` y `bw-patient-detail-content` para reusar en el detalle |
| `shared/config/abilities.config.ts:21-23` | Ya existen `clients.view`, `clients.create`, `clients.update` |
| i18n | **No hay claves `clients.*`** en `es.ts`/`en.ts`: la pantalla está toda hardcodeada en español |

## Gaps contra la referencia

1. **Fecha de nacimiento inexistente.** El resource documentado del backend
   (`backend/api-endpoints.md:82`) es `{ id, first_name, last_name, email, phone, rut, gender,
   wc_customer_id, active }`: sin fecha de nacimiento. El filtro "Cumpleaños" necesita schema
   nuevo (migración + resource + validación).
2. **Filtros por sede/profesional/servicio/estado de reserva/¿ha reservado?** son agregados
   sobre `bookings` y `client_packs`; hoy el FE no los pide y no sabemos si el API los acepta.
3. **Total para "Mostrando X de N"**: depende de paginación con `meta`.
4. **Orden por columna**: tiene que ser server-side si la paginación lo es.
5. **Consecuencia de desactivar**: qué pasa con reservas futuras y packs del cliente.

## Tasks

- ⏳ T1 [S3] Cerrar contrato con `Bookwise-API`. — **BLOQUEADA**: esperando respuesta al
  `openspec/changes/2026-10-27-clients-management/proposal.md`.
- ⏳ T2 [S1] Listado: buscador global (nombre, apellido, RUT, email, teléfono), contador
  "Mostrando X de N", columnas ordenables, RUT visible, acciones reales. Depende de T1
  (paginación/totales/orden).
- ⏳ T3 [S1] Panel "Filtros avanzados" colapsable: Local/sede, Profesional/prestador, Servicios,
  Estado de la reserva, Género, Cumpleaños, Paciente creado en el período, ¿Ha reservado?,
  Personalizados; con **Buscar** y **Reestablecer**. Depende de T1.
- ⏳ T4 [S1] Detalle de cliente reusando `bw-patient-detail-content` + reservas y packs.
- ⏳ T5 [S1] Alta y edición de cliente desde la lista (RUT validado por `ChileanRutRule` en el
  backend), gateadas con `clients.create` / `clients.update`.
- ⏳ T6 [S4] Desactivar cliente (soft, `active: false`) con confirmación y consecuencias
  explicadas; el historial de reservas se preserva.
- ⏳ T7 [S1] i18n es/en de toda la pantalla (hoy no existe ninguna clave `clients.*`).
- ⏳ T8 [S1] Specs + `ng build` + `ng test`.
- ❌ Fuera de alcance declarado: **Importar pacientes** y **Crear una audiencia con este
  listado** (CRM/marketing, no pedido).

## Decisión de alcance (2026-10-27)

Se preguntó y el usuario eligió: primera entrega **completa** (incluye filtros avanzados), pedir
**todo** el contrato al backend ahora, y **desactivar** en vez de borrar. Queda registrado para
no re-preguntar.

## Referencias

- `/mnt/d/documentos/trabajo/kinesilk/registro de pacientes.png` — pantalla completa.
- `/mnt/d/documentos/trabajo/kinesilk/filtros de paciente.png` — mitad inferior del panel.
- `/mnt/d/documentos/trabajo/kinesilk/filtros de paciente 2.png` — mitad superior del panel.

## Log

- L1 (usuario, verbatim): "puedes revisar la imagen registro de pacientes en esta ruta y ademas
  la imagen filtro de pacientes y filtro de pacientes 2 para formular el manejo de clientes?"
- L2 (exploración): mapa del frontend de clientes y del doc de endpoints del backend. Aparecen
  el truncado a 15, los botones decorativos, la ausencia de fecha de nacimiento y la ausencia
  total de i18n.
- L3 (usuario, decisiones): alcance completo; pedir todo el contrato ahora; tacho = desactivar.
- L4 (usuario, verbatim): "comunicate con el backend cuando necesites".
