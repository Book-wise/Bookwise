# Plan / Facturación — Reestructurar pantallas (#22) + Mi plan (#17 #19)

Separa Pago de Plan: `Plan` se vuelve "Mi plan" (lectura) con desglose completo, la
edición pasa a `/administrar`, y Pago gana la sub-ruta `/historial`. Sidebar con Plan + Facturación.

## Specs

- S1 (#22, del doc `billing-plans-addons.md`): "Pago: `/admin/facturacion` (+ `/historial`, `/datos`)" · "Plan: `/admin/planes` = Mi plan (lectura) · `/admin/planes/administrar` = edición".
- S2 (decisión usuario): "Desglose completo (#17+#19)" — caja azul con total y próxima fecha de facturación (`next_billing_at`) + aviso de cobro, y popover de desglose Plan/Add-ons/Impuestos/Total con "Ver más detalles".
- S3 (decisión usuario): "Muevo la tabla de facturas a `/admin/facturacion/historial`. `/datos` queda bloqueado hasta que exista `billing_profiles` (#21)."
- S4 (decisión usuario, corregida): Plan y Facturación NO van en el sidebar — van en el popover del perfil (menú de cuenta). El sidebar queda solo con los enlaces funcionales.

## Tasks

- T1 [S1] Rutas: `/admin/planes`→MyPlan, `/admin/planes/administrar`→Plans (edición), `/admin/facturacion/historial`→BillingHistory. ✅
- T2 [S2] MyPlanComponent "Mi plan": plan+extras+total, caja azul (#19), popover desglose (#17), CTA "Administrar plan". ✅
- T3 [S3] BillingHistoryComponent: extraer tabla de facturas; billing enlaza a `/historial`. ✅
- T4 [S4] Menú de cuenta: "Plan" → `/admin/planes` (Facturación ya estaba); CTAs "Mejora tu plan" → `/admin/planes/administrar`. ✅
- T5 [S1-S4] i18n es/en + specs + build/tests verdes. ✅

## Log

- L1 (2026-10-21): usuario retoma con "continuamos?" y elige la opción "#22 Reestructurar pantallas".
- L2 (2026-10-21): decisiones vía pregunta: "Desglose completo (#17+#19)", "/historial ahora, /datos después", "Sí, ambos".
- L3 (2026-10-21): implementación completa. Verificación: `ng build` verde; 31/31 tests de los 4 specs tocados; suite completa 690 pass / 8 fallos PRE-EXISTENTES ajenos (bookings `window.matchMedia`, `bookingsShowingCount`, calendar-navigation). Sin commit aún (decisión del usuario).
- L4 (2026-10-21): corrección del usuario — "no queremos que queden mas enlaces en el side-menu que los funcionales osea facturacion y planes puedes moverlos al popover que se abre desde la imagen del perfil". Se revierte el sidebar (Plan/Facturación) y se agrega "Plan" al menú de cuenta.
- L5 (2026-10-21): facturación — "Plan actual" y "Detalles del plan" comparten fila en pantallas grandes (`.plan-details-grid` 3fr/2fr, stack ≤992px). Gráfico de consumo full-width con altura responsive (`clamp(16rem,30vw,26rem)`, 14rem en mobile) y opciones más legibles (leyenda compacta, `maxTicksLimit`).
- L6 (2026-10-21): calendario admin — se recorta el padding interno de la card (`p-card-body` 1.25rem→0.75rem, scoped al componente) para ganar espacio por el menú lateral.
- L7 (2026-10-21): "Uso del plan" — 2 tarjetas por fila de tablet a laptop (`max-width: 1366px`), 1 por fila en mobile (≤768px). Base 3 por fila.
- PENDIENTE: el gráfico de consumo sigue con datos MOCK. La serie histórica mensual está bloqueada por backend (#23: `/subscription/usage` solo trae el período actual). Falta decisión del usuario sobre qué mostrar.
- L8 (2026-10-21): decisión del usuario — "Pedir el endpoint al backend". Se escribió el pedido FE→BE con contrato + seed en `openspec/changes/2026-10-21-confirmation-usage-series/proposal.md`. El gráfico queda mock hasta que el BE exponga la serie.
