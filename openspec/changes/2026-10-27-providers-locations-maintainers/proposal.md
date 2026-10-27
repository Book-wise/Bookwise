# Pedido FE → BE — Mantenedores de profesionales y sucursales (2026-10-27)

Antes de implementar los mantenedores en el frontend necesitamos cerrar el contrato y los
permisos. El objetivo funcional: **crear y modificar** profesionales y sucursales desde sus
vistas y diálogos, **ver las consecuencias** de cada acción (conflictos con reservas,
reactivaciones, cuotas del plan), y **gatear cada acción por permiso**, inicialmente solo
para administradores.

Este documento no propone rediseñar nada: lista lo que ya existe (verificado en `develop`),
lo que falta, y las preguntas que bloquean la implementación.

---

## 1. Lo que ya existe (verificado en `Bookwise-API` @ `develop`)

| Verbo | Profesionales | Sucursales |
|---|---|---|
| GET (index/show) | `/v1/providers`, `/v1/providers/{id}` — `providers.view` | `/v1/locations`, `/v1/locations/{id}` — `locations.view` |
| POST | `/v1/providers` — `providers.manage` | `/v1/locations` — `locations.manage` |
| PATCH | `/v1/providers/{id}` — `providers.manage` | `/v1/locations/{id}` — `locations.manage` |
| **DELETE** | **no existe** | **no existe** |
| Extra | `PATCH /v1/providers/{id}/roles` | — |

Desactivación: ambos usan `active: false` por PATCH. Con reservas futuras vivas responden
`409 { error: 'deactivation_conflict', requires_confirmation: true, affects: { bookings: [...] } }`.
Sucursales aceptan `force: true` (desactiva igual, con `Log::warning`); **profesionales no
tienen bypass**.

Cuota del plan: `403 { error: 'tenant_professional_limit_reached' | 'tenant_location_limit_reached', limit, current, detail }`,
verificada antes de crear **y antes de reactivar**.

Catálogo de permisos (`RolePermissionService`): `providers.view`, `providers.manage`,
`locations.view`, `locations.manage` (`min_level: 80`, `delegable: true`). `admin_local`
recibe **solo view**; `admin_general` recibe view + manage.

---

## 2. Preguntas que bloquean el frontend

### 2.1 ¿Hay borrado o el ciclo de vida es solo `active`? — BLOQUEANTE

Hoy no hay `DELETE` para ninguna de las dos entidades, aunque los modelos tienen
`SoftDeletes` sin usar. El frontend necesita saber si el mantenedor expone **eliminar** o
solo **activar/desactivar**, porque cambia el diálogo, el copy y las consecuencias:

- Si es solo `active`: la UI ofrece "Desactivar" y "Reactivar", nunca "Eliminar".
- Si habrá `DELETE`: ¿soft o hard? ¿con `force`? ¿qué pasa con las reservas históricas
  (el `provider_id`/`location_id` de una reserva pasada no puede quedar roto)?

**Pedido:** confirmar el ciclo de vida definitivo. Recomendación FE: **sin DELETE**, solo
`active`, para no romper el histórico de reservas.

### 2.2 `force` inconsistente entre las dos entidades

`LocationUpdateRequest` acepta `force`, `ProviderUpdateRequest` **no** (se descarta en
silencio). Como consecuencia, un profesional con reservas futuras **no se puede desactivar
nunca** desde la UI: el backend responde 409 y no hay forma de confirmar.

**Pedido:** o se agrega `force` a `ProviderUpdateRequest` con la misma semántica que
sucursales, o se documenta que el bloqueo de profesional es **duro** (y la UI muestra un
mensaje sin acción posible, con las reservas que lo bloquean).

### 2.3 `PATCH /providers/{id}/roles` sin `permission:providers.manage`

En `routes/api.php` esa ruta declara solo `scope:providers:write`, sin la key. Cualquier
token con scope de escritura puede reasignar roles de un profesional sin tener
`providers.manage`.

**Pedido:** confirmar si es intencional. Si no, agregar `permission:providers.manage` para
que la UI pueda gatear la edición de roles con la misma key que el resto del mantenedor.

### 2.4 Granularidad de permisos por acción

El usuario pidió explícitamente "RBAC y control de permisos **para la acción**", no solo por
pantalla. Hoy existen únicamente `providers.view|manage` y `locations.view|manage`.

**Pedido:** decidir entre:

- **A (recomendada):** mantener `view` + `manage`. `manage` habilita crear, editar y
  (des)activar; la UI gatea cada botón con `manage`. Cero migración de catálogo.
- **B:** agregar `create` / `update` / `delete` por entidad (6 keys nuevas), con su nivel y
  delegabilidad, para poder dar "solo crear" sin "editar".

Sin esta respuesta no se puede cablear el gating de cada acción.

### 2.5 Forma de las respuestas de listado

`GET /providers` y `GET /locations` usan `paginate(15)` y devuelven `Resource::collection`
(`{ data, links, meta }`), pero el frontend los tipa hoy como **array plano** y el
`ReferenceStore` parchea la respuesta tal cual, sin `.data`. No hay interceptor que
desenvuelva (el único interceptor maneja 401/402).

**Pedido:** confirmar si esos dos endpoints **paginarán en producción**. Si sí, el frontend
debe adaptarse (paginador o `per_page` alto) antes de tocar los mantenedores; si no, alinear
la respuesta a array para que el contrato no mienta.

### 2.6 `location_id` obligatorio al crear profesional

`ProviderStoreRequest` exige `location_id` (existe en las sucursales del tenant), pero el
diálogo actual lo envía **solo si no es nulo**. Resultado: crear sin sucursal da 422.

**Pedido:** confirmar que un profesional **siempre** pertenece a una sucursal. Si es así, el
formulario lo marca requerido y selecciona la sucursal activa por defecto. Si un profesional
puede existir sin sucursal (o en varias), el contrato tiene que cambiar.

### 2.7 Teléfono de profesional: ¿E.164 o texto libre?

`ProviderStoreRequest` acepta `phone` hasta 50 caracteres sin formato. El resto del producto
usa `bw-phone-input` y guarda **E.164** (`accounts.billing_phone`, por ejemplo).

**Pedido:** confirmar si conviene normalizar a E.164 también acá. El frontend puede enviar
E.164 desde ya sin cambio de backend (cabe en 50), pero si el backend valida otra cosa hay
que saberlo.

### 2.8 Consecuencia real del `force` en sucursales

El mensaje actual dice "Las reservas existentes no se verán afectadas." con
`Log::warning('Sucursal desactivada por fuerza mayor')`. Necesitamos precisión para el copy:

- Las reservas futuras de esa sucursal: ¿quedan agendadas y visibles, aunque la sucursal esté
  inactiva? ¿se cancelan? ¿el calendario las sigue mostrando?
- ¿Los profesionales asignados a esa sucursal quedan apuntando a una sucursal inactiva?

**Pedido:** describir el efecto observable, para no prometer en la UI algo que el backend no
hace.

### 2.9 ¿Reasignación masiva de profesionales?

No existe endpoint para mover profesionales de una sucursal a otra en bloque (cada uno tiene
un `location_id` único). Si desactivar una sucursal deja N profesionales colgados, la UI
necesitaría ofrecer reasignación.

**Pedido:** confirmar si se implementará. Si no, la UI solo informa cuántos profesionales
quedan en la sucursal inactiva y deja la reasignación manual, uno por uno.

---

## 3. Criterios de aceptación del lado backend

1. Ciclo de vida de ambas entidades definido por escrito (§2.1) y coherente entre las dos
   (`force` sí o `force` no, pero igual en las dos) (§2.2).
2. `PATCH /providers/{id}/roles` con la misma protección que el resto del mantenedor (§2.3).
3. Granularidad de permisos decidida y reflejada en el catálogo (§2.4).
4. Forma de listado coherente con lo que el frontend tipa (§2.5).
5. Errores de cuota y de conflicto con el envelope que ya existe, sin códigos nuevos
   innecesarios.

---

## 4. Qué hace el frontend cuando esté cerrado

1. Alinea `providers-api` / `locations-api` con la forma real de listado.
2. Agrega el alta de profesional (hoy **inalcanzable**: `dialogMode='create'` sin disparador).
3. Cablea `bwIfAbility` en cada acción (crear / editar / (des)activar / roles) con la key
   decidida en §2.4, y `abilityGuard` en las rutas.
4. Muestra las consecuencias: conflicto 409 con las reservas afectadas, cuota 403 con CTA,
   y el resultado de la acción en el diálogo (éxito, error de campo, error de negocio).
5. i18n es/en de todo el copy nuevo (hoy hay strings hardcodeados en el diálogo de
   sucursales).

## 5. Referencias frontend

- `src/app/features/admin/providers/providers-list.component.ts` (acciones, toggle, conflicto)
- `src/app/features/admin/providers/provider-dialog/provider-dialog.component.ts` (create/edit/view)
- `src/app/features/admin/locations/locations-list.component.ts` (create/edit/toggle + force)
- `src/app/features/admin/locations/location-dialog/location-dialog.component.ts`
- `src/app/core/services/api/{providers,locations}-api.service.ts`
- `src/app/shared/config/abilities.config.ts` (catálogo de keys)

---

## 6. Respuesta del backend (2026-10-27) — CERRADO

Las 9 preguntas quedaron resueltas. Resumen de lo que manda el contrato final:

1. **Ciclo de vida: solo `active`**, sin DELETE. `SoftDeletes` declarado y sin uso.
2. **`force` en profesionales: bloqueo duro**, decisión explícita (`ProviderController.php:216-218`).
   Con reservas futuras → 409; hay que resolverlas primero. No hay botón de forzar.
3. **`PATCH /providers/{id}/roles` → habilidad NUEVA `providers.roles`** (`develop` @ `6626fd9`).
   No se usó `providers.manage` porque la spec `location-scope` exige habilitar a
   `admin_location` (70), cuyo baseline no incluye `manage`. La key tiene `min_level` 80: el rol
   la **tiene** pero no puede **delegarla**. La ruta exige además `scope:providers:write`.
   Backfill en tenants ya provisionados: `php artisan permissions:apply-baseline` (explícito).
4. **Granularidad: `view` + `manage` + `roles`** (profesionales) / `view` + `manage`
   (sucursales). Sin `create/update/delete` por entidad.
5. **Listado paginado** `{data, links, meta}`, default 15, `per_page` sin validar ni tope
   server-side → el frontend manda un valor acotado.
6. **`location_id` obligatorio** al crear profesional.
7. **Teléfono de profesional: texto libre ≤50, no E.164.** Sucursales **sin** teléfono.
8. **`force` de sucursal**: 409 con `affects.bookings: N`; con `force: true` procede y deja
   `Log::warning` de auditoría.
9. **Sin reasignación masiva**: solo `PATCH /providers/{id}` con `location_id`, uno por uno.
