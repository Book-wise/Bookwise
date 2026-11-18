# RBAC en el frontend (Fase B — diseño)

Análisis y recomendación arquitectónica para gatear la UI por **capacidad**
(ability), no por rol. Estado: **pendiente de implementar** (no autorizado aún).

## Specs

- **S1** — "vale la pena mencionar que solicite los permisos a su administrador o de plano,
  las features que no corresponden o se bloquean, o dejan de ser visibles, secciones, segun
  corresponda opciones de menu que no correspondan al perfil... podemos simplemente ir
  quitando componentes o restringirlos... como implementarias de manera correcta estas
  features Role based en el front?"
- **S2** — Copy neutro sin voseo para el estado "sin permiso": "No tienes permiso para esta
  acción. Solicita acceso a tu administrador." (ya aplicado en `biz.permission_required.detail`).

## Decisión de diseño

No gatear por **rol** (`staff`/`admin`, ni por `is_admin_general`/`is_admin_local`), sino por
**capacidad** (`abilities`). El backend ya hizo ese movimiento en F7 A (salió `role:admin`,
deniega con `permission:locations.manage`, `providers.manage`, `sales.manage`, `roles:read/write`).
La matriz de permisos es configurable por tenant, así que `@if (rol === X)` hardcodeado se rompe
cuando un admin toca la matriz.

## Modelo en capas (defensa en profundidad)

1. **Catálogo de abilities** — constantes tipadas, cero magic strings:
   `ABILITIES = { bookingsView: 'bookings.view', locationsManage: 'locations.manage', ... }`.
2. **Predicados en `AuthService`** — ya existe `abilities()` + `hasAbility()`; agregar
   `hasAny(...)` / `hasAll(...)`.
3. **Route guard** — `abilityGuard('bookings.manage')` bloquea navegación a rutas no
   autorizadas (frontera dura) y redirige a dashboard / "sin acceso".
4. **Directiva estructural** — `*bwIfAbility="ABILITIES.locationsManage"` remueve del DOM el
   botón/acción sin permiso; variante `bwDisableAbility` deshabilita con tooltip.
5. **Menú config-driven** — cada ítem declara `ability`; un filtro renderiza solo lo autorizado
   ("opciones de menú que no corresponden al perfil").
6. **Backend como autoridad final** — el 403 `permission_required` sigue siendo el fallback;
   el front solo oculta/deshabilita por UX, nunca es la fuente de verdad de seguridad.

**Hide vs. disable:** ocultar en nav/secciones/páginas enteras; deshabilitar con tooltip en
acciones inline dentro de una página visible. Tooltip/toast: S2.

## Tasks (pendientes)

- **T1** — `AuthService`: `hasAny`/`hasAll` + catálogo `ABILITIES`.
- **T2** — Directiva `*bwIfAbility` (+ `bwDisableAbility`).
- **T3** — Guard `abilityGuard` + rutas.
- **T4** — Menú/sidebar config-driven (ítem → `ability`).
- **T5** — Migrar gates `is_admin_general`/`is_admin_local` a `hasAbility(...)`.
- **T6** — (backend, aditivo) exponer `business_roles[]` en `/auth/me` para fidelidad total de
  rol (ver hallazgo de S6 de Fase A).

## Log

- **L1** — Pedido (verbatim): "puedes hacer un analisis del caso... tu debes recomendar una
  opcion arquitectonica seria que resuelva esto, como implementarias de manera correcta estas
  features Role based en el front?"
- **L2** — Hallazgo de datos: `/auth/me` (UserResource) expone `role` (técnico) +
  `is_admin_general` + `is_admin_local`; **no** expone el slug completo del rol de negocio
  (recepcionista, staff, etc.). `accounts[].role` (AccountViewService) sí lleva el slug por
  cuenta. → para fidelidad total se requiere un campo aditivo en backend (T6).
