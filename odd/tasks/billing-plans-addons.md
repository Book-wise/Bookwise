# Billing · Planes · Add-ons (estado al 2026-10-17)

Documento de continuidad. Registra **qué se hizo**, **qué contratos del backend se usan** y
**qué queda pendiente**.

---

## 0. Estado al 2026-10-26 (commiteado y pusheado)

Rama `feat/contract-catchup`, ya publicada en `origin` (primer push 2026-10-26, con tracking).
Lo que sigue sin pushear es solo lo que se agregue de acá en adelante.

| Commit | Alcance |
|---|---|
| `09eff74` `docs(odd)` | feature docs ODD |
| `a0c6855` `fix(bookings)` | `appendTo='body'` en dropdowns de bookings |
| `ae1d44c` `feat(entitlement)` | Fase A: planes/billing/add-ons/perfil/diálogo 402 |
| `fac2012` `feat(authz)` | Fase B: RBAC por permission key |
| `ebed53e` `feat(plans)` | Split Pago/Plan: Mi plan (lectura), Administrar plan (edición), Historial (#17 #19 #22) |
| `c6dc097` `fix(calendar)` | Padding de la card del calendario admin (1.25rem→0.75rem) |
| `b71a8d2` `docs(openspec)` | Pedido FE→BE de serie histórica de consumo (#23) |

Verificación última (2026-10-26): `ng build` verde + `ng test` **692/698 pass**. Los 6 fallos son
PRE-EXISTENTES y ajenos: `booking-form-dialog` patient-card (`window.matchMedia`),
`historial-reserva` (`bookingsShowingCount`), `calendar-navigation`.

Sin commitear (decisión pendiente): `.atl/skill-registry.md` (tooling auto-gen),
`src/assets/images/landing_page/salon de belleza_dresden.jpg` y `odd/tasks/creation-limits.md`
(doc de #12, pausado).

---

## 1. Hecho y verificado

Verificación: `npx ng build` verde + **20/20 tests** (billing, negocios, planes).

### Modelos y servicios
- `core/models/index.ts`
  - `Plan` (6 cupos), `PlanLimits`, `PlanCatalogGroup` / `PlanCatalogEntry`, `PlansCatalogResponse`.
  - `Subscription` (+ `addons`, `addons_total_clp`, `total_price_clp`, `addon_catalog`), `SubscriptionAddon`, `AddonCatalogItem`, `SubscriptionResponse`.
  - `UsageData.account_reference`, `AuthMeData.is_admin_location`.
- `core/services/api/subscription-api.service.ts`
  - `getPlans()`, `getSubscription()`, `getUsage()`, `updateAddons(type, quantity)`.

### Store (caché, evita llamadas repetidas)
- `core/stores/subscription.store.ts` — signalStore root-scoped:
  - `plans` cacheado de por vida (catálogo público y estable).
  - `subscription` / `usage` cacheados con flags `loaded` (no-op si ya cargó) + `invalidate*()`.
  - `setAddon(type, quantity)` → `PUT` y parchea la suscripción desde la respuesta del server.
  - Exportado en `core/stores/index.ts`.

### Página de planes (`/admin/planes`) — rediseño estilo AgendaPro
- Toggle **Mensual / Anual** con badge "2 meses gratis" (el anual es ×10 del mensual).
- Lista de planes en radio-cards con beneficios reales del plan.
- Panel lateral: plan actual + add-ons + total.
- Sección de add-ons con **steppers por canal** (email / whatsapp), banner de créditos
  ("Tu plan ahora cuenta con N WhatsApp") y total recalculado desde el server.
- **Fix importante**: `isCurrent()` compara **slug + intervalo**. El mismo plan en anual es
  otra oferta (descuento), no el plan vigente.
- Archivos: `features/admin/plans/plans.component.{ts,html,scss,spec.ts}`.

### Facturación (`/admin/facturacion`)
- Plan/período/días restantes/renovación (`next_billing_at`) **reales** desde `GET /subscription`.
- Intervalo de facturación (mensual/anual) real.
- Número de cuenta: **`account_reference` (BW-XXXXXX)**, ya no el PK entero.
- Tarjeta mock **eliminada** (no mantenemos datos de pago todavía).
- Etiqueta "Actualizado hace 12 min" (mock) → **período real** de consumo
  (`usage.confirmations.email.period_start/period_end`).
- CTA **"Mejora tu plan"** dentro de las cards de uso cuando `used >= limit` (100%).
- Botones del plan actual **unificados** en uno solo ("Mejora tu plan" → `/admin/planes`).

### Negocios (`/admin/negocios`)
- El plan es de la **cuenta**, no del tenant → se muestra **una vez arriba** de la lista con su
  nombre real, enlazado a `/admin/planes`. Se quitó el chip por fila.

### Perfil
- Rol de negocio en lenguaje humano: "Administrador general / local / sucursal" (3 flags).
- Card de `admin_location` con color (`#8b5cf6`) e icono (`map-pin`) + descripciones corregidas
  (`admin_local` = empresa/tenant; `admin_location` = sucursal).

### Fase B / RBAC (parcial)
- `core/services/auth.service.ts`: captura `permissions` en login / me / switch-tenant;
  `hasPermission`, `hasAllPermissions`, `hasAnyPermissions`.
- `shared/config/abilities.config.ts` — catálogo `ABILITIES` (dot-notated, espeja el backend).
- `shared/directives/bw-if-ability.directive.ts` — directiva estructural.
- `core/guards/ability.guard.ts` — guard de navegación.
- `layouts/admin-layout` — menú **config-driven** (cada ítem declara `ability`, se filtra).
- Warning "la aplicación de esta matriz está pendiente" **reemplazado**: el backend ya enforcea.

---

## 2. Contratos del backend usados (Bookwise-API, `develop`)

| Endpoint | Uso |
|---|---|
| `GET /v1/plans` | Catálogo por slug; `plans[]` con `billing_interval`, `price_clp` y los 6 cupos |
| `GET /v1/subscription` | Plan completo, `addons[]`, `addon_catalog[]`, `addons_total_clp`, `total_price_clp`, `next_billing_at` |
| `PUT /v1/subscription/addons` | `{ type, quantity 0..100 }` → subscription completa recalculada |
| `GET /v1/subscription/usage` | `account_id`, `account_reference`, tenants/users/businesses, `confirmations` con `pack_credit` |
| `GET /v1/auth/me` · `login` · `switch-*` | `abilities` (scopes token) + `permissions` (keys efectivos, fail-closed) + `accounts[].uuid`/`.reference` + `is_admin_location` |

---

## 3. Pendiente

### Pendientes de frontend
- ~~**#11 Fase B**: migrar los gates `is_admin_*` a `hasPermission(...)` + verificación final.~~ ✅ cerrada (`fac2012`).
- **#12 Límites de creación**: bloquear "Nuevo profesional" / "Nueva sucursal" al llegar al tope
  del plan, con diálogo y CTA de upgrade (hoy solo se avisa en las cards de facturación).
  → **EN CURSO (pausado 2026-10-26)**: doc `odd/tasks/creation-limits.md` (diseño cerrado, **nada
  implementado, sin commitear**). Descubrimiento: **no existe botón "Nuevo profesional"** (el
  `provider-dialog` en modo create quedó sin punto de entrada) → se bloquean solo las altas
  alcanzables: "Nueva sucursal" (`max_locations`) y "Nuevo negocio" (`max_tenants`).
  → **Corrección 2026-10-27**: el botón "Nuevo profesional" **ya existe** (lo agregó `8021fb9`) y
  el CTA **reactivo** de cuota ya cubre profesionales y sucursales; lo que sigue faltando de #12
  es sólo el bloqueo **proactivo** (antes de abrir el formulario). Ver
  `odd/tasks/creation-limits.md` y `odd/tasks/pendientes.md`.
- ~~**#17 Popover de desglose** en "Mi plan"~~ ✅ cerrada (`ebed53e`, `MyPlanComponent`).
- **#18 Draft + barra flotante** "Tienes cambios en tu plan" con **Cancelar** y
  **Confirmar cambio** (sin prorrateo: el backend es D.8). — pendiente.
- ~~**#19 Caja azul informativa**: total + `next_billing_at` + aviso de cobro~~ ✅ cerrada (`ebed53e`, `MyPlanComponent`).
- ~~**#22 Reestructurar pantallas (separar Pago de Plan)**~~ ✅ cerrada (`ebed53e`):
  `/admin/facturacion` (+ `/historial`) · `/admin/planes` = Mi plan (lectura) ·
  `/admin/planes/administrar` = edición. `/datos` sigue bloqueado por #21.
- **#21 Datos de facturación**: `billing_profiles` (`taxpayer_type: company|person`,
  `legal_name`, `tax_id`, `giro`, dirección, `billing_email`). Requiere backend.

### Bloqueadas (esperando al backend o material externo)
- **#16 Impuestos (neto + IVA)**: pedido enviado para exponer `net_clp` / `tax_clp` / `tax_rate`
  en `PlanResource` y `addons_total_net_clp` / `addons_total_tax_clp` / `total_net_clp` /
  `total_tax_clp` en `SubscriptionResource`. **No se omiten del desglose.**
- **#20 Reacción post pre-check**: falta la imagen `confirmacion de cambio luego del
  pre-checkeo` (no estaba en la carpeta al cerrar la sesión).
- **#23 Consumo mensual real**: pedir al backend (a) **seed** de `confirmation_usage` de
  mensajes/recordatorios en varios meses y (b) **endpoint de serie histórica mensual**
  (hoy `/subscription/usage` devuelve solo el período actual). Con solo el seed el gráfico
  de `/admin/facturacion` seguiría mock.
  → **Pedido escrito (2026-10-21):** `openspec/changes/2026-10-21-confirmation-usage-series/proposal.md`
  (contrato `GET /v1/subscription/usage/history?months=6` + seed de 6 meses). Pendiente respuesta BE.

---

## 4. Referencias visuales (inspiración AgendaPro)

En `/home/seba/codingProjects/`:
- `agendaProPlanes.png` — "Mi plan" con desglose tipo recibo.
- `agendaProPlanes1.png` — administrar plan: modalidad de pago + lista + panel lateral.
- `agendaProplanes2.png` — card de add-on con stepper y banner.
- `tooltip.png` — popover de desglose (Plan / extras / Impuestos / Total + "Ver más detalles").
- `cambios en plan.png` — barra flotante "¡Tienes cambios en tu plan! [Cancelar] [Pagar]" +
  caja azul con total y próxima fecha de facturación.
