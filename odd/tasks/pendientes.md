# Pendientes consolidados (2026-10-27)

Vista única y ordenada de todo lo abierto en el repo, con su fuente y su bloqueo. Si algo no
está acá, no está pendiente. Cada ítem apunta al doc donde vive el detalle.

## Estado base al cerrar la sesión

- Rama `feat/contract-catchup` **sincronizada con `origin`** en `e84fcc8`, árbol limpio.
- `ng build` verde · `ng test` **755 pass / 6 fail** (los 6 preexistentes y atribuidos:
  calendar-navigation 1, historial-reserva 3, booking-form-dialog 2).
- Reviews nativos: 4 porciones **aprobadas y quemadas** (`review-77c0ef1d` fiscal,
  `review-ae52cee6` mantenedores, `review-ba667a5f` segunda tanda, `review-9f1c39c6` P0 + docs).
  Disposición explícita del usuario: el candidato de **rama completa** (114 archivos) queda sin
  revisar; en este repo **se revisa por porción**.

## 1. Listo para arrancar ya (sin dependencias externas)

| # | Ítem | Fuente | Qué falta |
|---|---|---|---|
| 1.1 | **Clientes** ("Base de Pacientes"): listado server-side, detalle, alta/edición, desactivar (409+force), filtros avanzados, i18n | `clientes-base-de-pacientes.md` | ✅ implementado (contrato cerrado y mergeado en BE `79ed586`) |
| 1.2 | **#12 Límites de creación** (bloqueo **proactivo** al tope del plan) | `creation-limits.md` T1–T5 | implementar (diseño cerrado). Ojo: el botón "Nuevo profesional" **ya existe** (lo agregó `8021fb9`), así que #12 lo cubre también |
| 1.3 | **Clamp de página** en las dos listas: si el total baja, la página actual queda vacía | hallazgos `R3-PAGE-CLAMP` y `R3-PAGE-NO-UPPER-BOUND` | ✅ cerrado (clamp vía `effect` en ambas listas) |
| 1.4 | **Timeout/cancelación** del agregador `collect-paginated.ts` | hallazgo `R3-COLLECT-TIMEOUT` | ✅ cerrado (`timeout` por página) |
| 1.5 | **#18 Borrador + barra flotante** "Tienes cambios en tu plan" (Cancelar / Confirmar, sin prorrateo) | `billing-plans-addons.md` §3 | implementar; hay referencia visual `cambios en plan.png` |
| 1.6 | **#20 Reacción post pre-check** | `billing-plans-addons.md` §3 | **DESBLOQUEADA**: la imagen `confirmacion de cambio luego del pre-checkeo.png` ya está en `D:\documentos\trabajo\bookwise\` |

## 2. Bloqueadas por el backend

| # | Ítem | Estado |
|---|---|---|
| 2.1 | **Contrato de clientes** (10 puntos: forma del listado + totales, `birth_date`, query params de filtros, semántica de desactivar) | Pedido **enviado**; prioridad pedida sobre 1, 2, 3 y 6. Doc: `openspec/changes/2026-10-27-clients-management/proposal.md` |
| 2.2 | **Envelope `{data, links, meta}`** en `providers`/`locations` | Elevado al mantenedor del backend (no lo mergea por pedido de otro agente). El cliente ya lo consume sin cambios |
| 2.3 | **#16 Impuestos** (neto + IVA en `PlanResource` / `SubscriptionResource`) | Pedido enviado |
| 2.4 | **#23 Serie histórica de consumo mensual** + seed de `confirmation_usage` | Pedido escrito: `openspec/changes/2026-10-21-confirmation-usage-series/proposal.md`. El gráfico sigue mock |
| 2.5 | **#21 Datos de facturación** (`billing_profiles`) | **Reconciliar**: `billing-plans-addons.md` dice "requiere backend" pero `billing-datos-facturacion.md` dice backend listo y frontend en curso |
| 2.6 | **T6 RBAC**: exponer `business_roles[]` en `/auth/me` para fidelidad total del rol | `rbac-frontend.md` T6 |
| 2.7 | **Atomicidad del guardado de edición** de profesional (datos + roles son dos PATCH) | `providers-locations-maintainers.md`; hoy se avisa la escritura parcial |
| 2.8 | **Reasignación masiva de profesionales** (no existe endpoint) | `providers-locations-maintainers.md` |

## 3. Requiere decisión del usuario (no es código)

- **`billing-history` es MOCK**: falta `GET /v1/invoices`. Esperar el endpoint o rediseñar la vista.
- **"Preguntas frecuentes"** del sidebar de facturación: la sección no existe; se excluyó a propósito.
- **Aviso de RUT duplicado**: el backend no tiene unique; el front no puede saber si otro RUT existe.
- **Importar pacientes** y **Crear una audiencia con este listado**: declarados fuera de alcance.
- **Costo de arranque del store**: ahora hidrata todas las páginas (tope 40). Si molesta,
  el paso siguiente es paginar server-side por pantalla en vez de hidratar todo.

## 4. Deuda menor de documentación

- `frontend-contract-catchup.md:60` dice "pendiente verificación de suite completa": ya se verificó.
- `rbac-frontend.md` lista T1–T5 como pendientes; están hechas (`fase-b-rbac-cierre`). Solo T6 sigue abierto.
- `billing-plans-addons.md` §3 marca #21 como "requiere backend": ver 2.5.

## Orden sugerido

1. **1.3 + 1.4** ✅ cerrados (clamp de página + timeout del agregador).
2. **1.1** clientes sin contrato (avanza la pantalla grande mientras el backend responde 2.1).
3. **1.2** #12, que ya tiene diseño cerrado.
4. Al volver el contrato: **2.1** → T2/T3 de clientes (filtros + contadores).

## Actualización 2026-10-28

- **1.3 + 1.4 cerrados** en `feat/contract-catchup` (work-unit commit). `ng build` verde.
- `ng test` actual: **798 pass / 7 fail**, todos flaky preexistentes (calendar-navigation,
  booking-detail-dialog, booking-form-dialog ×2, historial-reserva ×3); ninguno en clientes,
  locations ni calendario.
- **Clientes COMPLETO**: listado **server-side** (`meta.total/from/to/last_page` + sort allowlist),
  detalle, alta/edición (RUT + `birth_date`), desactivar (409 `deactivation_conflict` + force),
  filtros avanzados, i18n. **`ClientsStore`** centraliza lista + mutaciones (parchea cache, sin
  re-fetch). Falta: merge a `develop` + deploy + verificar contra dev.
- **Calendario** (admin + profesional): grilla **00:00–24:00** (scroll a 08:00) para clínicas 24h;
  card **full-bleed** (sin padding/margen/esquinas); botón de duración de slots + guía de estados
  inline en desktop y en su propia línea en mobile S/M.
- **Locations**: la tabla muestra **apertura/cierre** (`opening_time`/`closing_time`).
- **Provider dialog**: roles `staff`/`staff_readonly` marcados **"Profesional"** + aviso si el set
  queda sin rol de atención (caso Ana en Providencia: tenía `recepcionista` → no aparecía).
- **Fix**: `getClients` desenvuelve el envelope (`{data}`) — rompía `ReferenceStore.clients` y el
  `clientOptions` del booking-form ("map is not a function").
- **Pendiente backend (sin mergear)**: `feat/location-hours` y `feat/business-days` (días laborables
  + feriados). Contratos capturados en `odd/tasks/location-hours.md` y `odd/tasks/business-days.md`.

## Próxima sesión (cierre 2026-10-28)

**Entregado y pusheado**: `feat/contract-catchup` mergeada a `develop` (fast-forward) y pusheada.
`origin/develop` (frontend) = **`cfd984d`**. Backend `origin/develop` = **`131c26c`**.

**Decisiones de seba (esta sesión)**:
1. **Grilla del calendario = 00:00–24:00** (día completo para clínicas 24h; scroll inicial 08:00). El
   horario por sucursal sólo acota los slots, NO redimensiona la grilla. (El backend dijo "fija
   08:00–22:00", pero seba eligió 00:00–24:00; ya está implementado así.)
2. **Sacar el filtro de rol del selector de la agenda**: mostrar todos los profesionales activos (un
   `Provider` ya es profesional). Así aparece Ana (Providencia, `recepcionista`) sin cambiar su rol.
   El guard de roles del backend se revirtió. **Pendiente**: quitar `hasAttentionRole` de
   `providerOptions` en admin+provider calendar y actualizar los specs.

**Nuevo del backend (`131c26c`), a implementar**:
- **Horarios por sucursal**: `opening_time`/`closing_time` (null = sin configurar) + `effective_*`
  default 08:00–22:00. El diálogo de sucursal ya tiene los campos; usar `effective_*` para mostrar.
- **Días laborables + feriados**: `working_days` (ISO 1–7, default lun–sáb) + `works_on_holidays`
  (default false). `GET /available_slots` agrega `meta.is_working_day` (false ⇒ "cerrado"). Reservar
  en día no laborable ⇒ 422 `non_working_day`. Tasks T1–T5 en `odd/tasks/business-days.md`.
- **Badges de cobro en la agenda**: `GET /bookings` trae `payment_status` (`paid`/`partial`/`unpaid`)
  + `payment`; un turno sin venta = `unpaid`. Dev ya tiene datos (paid 209 / partial 205 / unpaid 276).
  Pendiente: badges en los eventos.

**Deploy**: falta `tenants:migrate` + migración `holidays` en el backend (hasta eso, horarios/feriados
no responden en dev). Deploy del frontend desde `develop` (`cfd984d`) pendiente.

**Otros**: review nativo por porción (no corrido); ramas no mergeadas (`feat/business-management`,
`feature/ci-cd-deployment`, `master`) a decisión de seba; filtro de rango "Cumpleaños" (backend no lo
implementó).

## Actualización 2026-10-29 (feature de feriados completa)

**Contrato nuevo mergeado en backend `develop` `ed801fb`** (review nativa aprobada):
`GET /holidays` (`year` o `from`/`to`), `block_bookings_on_holidays` global (`/tenant/settings` +
`auth/me → user.business`), `available_slots.meta.is_holiday`/`holiday_name`, y **retiro** de
`locations.works_on_holidays`.

**Frontend — implementado y review aprobado** (rama `feat/contract-catchup`, 10 commits locales, sin push):
- `0ca1603` filtro de rol fuera del selector de la agenda.
- `2a1f667` business-days T1/T2/T4/T5 (`working_days`, 422 `non_working_day`).
- `80fd3f1` R3-002 (horas 'sin configurar' no se materializan al editar).
- `b96d0b2` retiro de `locations.works_on_holidays` (+ `3383844` cleanups del verificador).
- `3f591f9` `HolidaysApiService` + fix `available_slots` (`start_date`/shape/meta).
- `66028b7` `TenantSettingsApiService` + toggle "Feriados" en `/admin/configuraciones`.
- `e82e56e` sombreado admin (días cerrados + nombre de feriado).
- `e6e347a` sombreado profesional (vía `auth.me().business`).
- Badges de cobro: ya estaban implementados (`29b6c58`).
- Verificación: `ng build` verde · suite **821 pass / 7 fail** (los 7 flaky preexistentes) · review
  `review-984ef1f58c46b26b` aprobado y quemado (7 hallazgos informativos).

**Pendiente (bloqueado)**:
- **Deploy a dev**: ⛔ credenciales SSH del droplet (lo resuelve el encargado de DigitalOcean; no es
  código/contrato). Cuando corra: deploy frontend (merge/push, decisión de seba) + ejecutar
  `odd/tasks/deploy-feriados.md`.
- **Caveats a validar en dev**: (1) `calendar.render()` al cargar feriados puede resetear el scroll de
  la vista semana; (2) en el calendario del profesional, si `ReferenceStore` no hidrata locations, el
  sombreado degrada a solo-feriados.
- **Follow-ups del review** (informativos, sin corrección): R3-001/002/004 (sombreado/carga de feriados
  + render), R3-003 (effect de settings), R3-005 (snapshot de horas), R3-006/007 (util/service).
