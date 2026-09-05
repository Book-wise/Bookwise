# Modelos de Suscripción — Análisis y Concordancia con la Oferta

> **Kickstart** para alinear el **modelo de suscripción** (lo que se cobra y cómo se
> limita) con las **ofertas publicadas** en la landing (planes y precios).
> Repos: **Bookwise** (frontend, Angular) + **Bookwise-API** (backend, Laravel).
> Fecha: 2026-09-05.

---

## 1. Estado actual (qué hay hoy)

| Área | Realidad verificada |
|---|---|
| **Landing** | Planes **Starter / Professional / Enterprise** como copy de marketing (`landing.pricing.*` + array `plans` en `landing.component.ts`). Hero destaca el **Agente Conversacional AI**. |
| **Backend** | **NO existe modelo de suscripción/facturación** (sin tablas `plans`, `subscriptions`, `billing`; sin procesador de pagos). Los planes **no se cobran** hoy. |
| **Gate por plan** | Existe `business_plan` por tenant (string) + gate de presentación en front (`canManageMultiTenant`, `me().business.plan === 'enterprise'`) y de permisos en back (solo `admin_general` puede hacer `switch-tenant`). |
| **Agente conversacional** | **Carlitox** existe. Rol `agent` + token Sanctum dedicado con scopes (`bookings:read`, `clients:read`, `clients:write`, `providers:read`; **sin** `bookings:write`) y endpoints propios (`/v1/agent/check-availability`, búsqueda de cliente por teléfono/RUT, `PATCH /v1/clients/{id}` para RUT). Ver `docs/carlitox-agent-endpoints.md`. |
| **Multi-tenant** | Modelo `Tenant`, `tenant_id` duro en `locations`, scoping por tenant, `switch-tenant`, selector de negocios. |

**Conclusión:** hoy la oferta de la landing es una **promesa comercial sin cablear a monetización**.
El único vínculo real entre oferta y producto es el **gate por plan** (proyectado para el multi-tenant,
aún no para límites de profesionales/sucursales ni para el agente).

---

## 2. Inventario de capacidades reales (para mapear a planes)

Funcionalidad verificada en Bookwise (front) y Bookwise-API (back):

- **Agenda inteligente** sin doble-booking (`SlotAvailabilityService`, colisiones + bloqueos). FullCalendar en front.
- **Disponibilidad por profesional** (editor semanal, previews, secuencia disponible/reserva/bloqueo).
- **Clientes** con fichas, RUT (Módulo 11) y búsqueda por nombre/email/teléfono.
- **Profesionales y roles de negocio** (`BusinessRole`): `admin_general`, `admin_local`, `recepcionista`,
  `recepcionista_readonly`, `staff`, `staff_readonly`.
- **Sucursales / locations** (multi-sucursal), scoping por tenant.
- **Servicios y packs de sesiones** (`ServicePack`, descuento por volumen, pack vinculado a un servicio).
- **Ventas y pagos** (registro de venta, recibo básico; facturación electrónica DTE a futuro) + WooCommerce opcional (canal de venta; token con scopes `bookings:rw`, `clients:rw`).
- **Recordatorios / notificaciones** por **email** (inmediato, 24h, 30min, pago) con CRON; **WhatsApp** vía Carlitox.
- **Agente conversacional (Carlitox)**: atiende consultas, propone sesión individual o pack, agrega RUT,
  y coordina reservas (requiere **confirmación explícita del cliente** — no crea reservas solo).
- **Multi-tenant** (2+ empresas) — feature gateada por plan (Enterprise).
- **API** (endpoints REST + tokens con scopes) y **dashboard consolidado** multi-sucursal.

---

## 3. Oferta publicada hoy (planes y precios)

Benchmark de mercado (**AgendaPro**): Individual $9–19 · Básico $29 · Premium $59 · Pro $199 (USD/mes, ≈20% desc. anual).
Add-ons: WhatsApp $7, telemedicina $11, agendas extra.

| Plan | CLP/mes (≈USD) | Incluye | Multi-empresa |
|---|---|---|---|
| **Starter** | 14.990 (≈$15) | 1 profesional, agenda, clientes, recordatorios (email) | ❌ 1 empresa |
| **Professional** | 34.990 (≈$35) | hasta 4 profesionales, 1–3 sucursales, caja/pagos | ❌ 1 empresa |
| **Enterprise** | 79.990 (≈$85) | **2+ empresas**, multi-sucursal, **API**, consolidado, roles admin | ✅ **2+ empresas** |

- **Regla de negocio:** *aceptar 2+ empresas ⇒ Enterprise* (el multi-tenant es feature de plan).

---

## 4. Modelo de suscripción propuesto

**Tipo: tiered (escalones) + límites de asientos + feature gating.** Un solo feature se vende como
**add-on** (WhatsApp), porque tiene costo variable por mensaje.

| Plan | Profesionales | Sucursales | Empresas (tenants) | Feature distintivo |
|---|---|---|---|---|
| **Starter** | 1 | 1 | 1 | Agenda + clientes + recordatorios email |
| **Professional** | hasta 4 | 1–3 | 1 | + ventas/pagos + notificaciones + **agente conversacional (Carlitox)** |
| **Enterprise** | ilimitado* | multi-sucursal | **2+** | + API + panel consolidado + roles admin_general/local |

\* límite técnico por definir (ver §7).

**Add-ons (recomendados, concordantes con AgendaPro):**
- **WhatsApp** (recordatorios + canal del agente): ~CLP 7.000/mes — costo por mensaje.
- **Telemedicina**: ~CLP 11.000/mes (a futuro, requiere feature).
- **Agendas/profesionales extra**: se resuelven subiendo de plan (no add-on por asiento suelto).

**Regla de concordancia (la más importante):** el **límite de empresas (tenants)** es el eje del plan.
1 empresa ⇒ Starter/Professional; **2+ empresas ⇒ Enterprise**. Esto es lo que ya está cableado
(`business_plan`, `canManageMultiTenant`).

---

## 5. Por qué esos precios (racional)

1. **Benchmark + mercado chileno.** Los valores CLP se alinean con la referencia USD (AgendaPro),
   ajustados a poder de compra local. Starter ≈ $15 (puerta de entrada), Pro ≈ $35 (crecimiento),
   Enterprise ≈ $85 (grupos/cadenas).
2. **Valor percibido del agente + recordatorios.** El ausentismo se reduce con recordatorios
   (email/WhatsApp) y el agente automatiza captación (WhatsApp + RUT + propuesta de pack).
   Esa eficiencia justifica pagar por el plan, no solo por "una agenda".
3. **Costo variable real.** WhatsApp y el agente tienen costo por mensaje/interacción → se cobran
   como add-on o se incluyen desde Professional para no quemar margen en Starter.
4. **Fricción de onboarding.** Precio bajo en Starter capta el primer cliente; el upgrade a
   Professional ocurre cuando necesita + profesionales o + sucursales (natural).
5. **Ancla del multi-tenant.** Enterprise es el plan "de agencia/cadena": un solo panel para
   varios negocios. El precio alto refleja que es una operación distinta (y concentrada).

---

## 6. Concordancia oferta ↔ suscripción (matriz)

| Capacidad real | ¿En qué plan? | Estado de cableo |
|---|---|---|
| Agenda + clientes + disponibilidad | Todos | Implementado |
| Recordatorios email (24h/30min/pago) | Todos (+ Professional con notif. extra) | Implementado (CRON) |
| **Agente conversacional (Carlitox)** | **Professional+** (recomendado) | Feature real; **sin gate por plan hoy** |
| Ventas / pagos (caja) | Professional+ | Parcial (recibo básico; DTE fut.) |
| Multi-sucursal (1–3 en Pro) | Professional+ | Implementado (locations multi-tenant) |
| **Multi-empresa (2+ tenants)** | **Enterprise** | Implementado (**gate por plan ok**) |
| API + panel consolidado | Enterprise | Parcial (endpoints API; consolidado dashboard) |
| Roles admin_general / admin_local | Enterprise (multi-tenant) | Implementado |

**Brechas detectadas (falta cablear el gate):**
- El **agente** no está gateado por plan → hoy cualquier negocio podría usarlo.
- **Límite de profesionales / sucursales** no está forzado por plan (solo es copy de marketing).
- Los **recordatorios WhatsApp** y la **telemedicina** no están como add-on.

---

## 7. Decisiones abiertas (para cerrar antes de implementar)

1. **¿Implementar billing real?** (procesador CLP: Webpay/Flow/Transbank). Sin esto los planes son solo promesa.
2. **¿Cómo se cuentan los "profesionales"** (asientos)? ¿Profesionales activos? ¿El límite se valida al crear?
3. **¿1 cuenta = 1 empresa**, salvo Enterprise? ¿El `admin_general` existe solo en Enterprise?
4. **Agente:** ¿feature de plan (Professional+) o add-on? ¿Cómo se cobra el costo por mensaje
   de WhatsApp/LLM (incluido vs add-on)? ¿Se activa por negocio?
5. **Sucursales:** ¿límite duro por plan (1–3 en Pro)? Hoy no hay límite real en backend.
6. **Prueba gratis / trial:** ¿duración (14/30 días)? ¿Qué plan es el default del trial?
7. **Descuento anual** (≈20%, como AgendaPro). ¿Mensual o anual como default?
8. **Upgrade path:** ¿qué pasa al superar un límite (soft-block + sugerir upgrade, o hard-block)?
9. **Facturación:** los valores ya incluyen IVA? Los planes publicados (14.990/34.990/79.990)
   se muestran sin IVA en la landing (decisión comercial a confirmar).

---

## 8. Plan de implementación (kickstart, por fases)

1. **Fase 0 — Definir el modelo** (este doc): escalones, límites, features y add-ons. Cerrar §7.
2. **Fase 1 — Backend:** esquema de suscripción (tabla `subscriptions`/`business_plan` extendida con
   límites), endpoint de estado de cuenta, y validación de límites (profesionales/sucursales/empresas).
3. **Fase 2 — Gate por feature en front:** mapear `plan` → capabilities (agente, WhatsApp, API, multi-tenant)
   y ocultar/avisar features no incluidas. Reutilizar `canManageMultiTenant`.
4. **Fase 3 — Monetización:** integración de pago (Webpay/Flow), estados de factura/pago, y bloqueo/rebaja.
5. **Fase 4 — Telemetría y ajuste:** medir conversión por plan, uso del agente, no-shows; ajustar precios
   y límites con datos reales.

**Prioridad inmediata:** lo ya cableado (`business_plan` + gate multi-tenant) es la base; lo más urgente
es gatear el **agente** y el **límite de profesionales/sucursales**, porque son promesas de la landing.

---

## 9. Fuentes

- `docs/2026-09-04-consolidacion-sdd-landing.md` — planes, benchmark AgendaPro, gate por plan.
- `docs/carlitox-agent-endpoints.md` — el agente conversacional (rol `agent`, endpoints, scopes).
- `Bookwise-API/README.md` — capacidades (agenda sin colisiones, ventas, WooCommerce, roles, multi-tenant).
- `src/app/core/models/index.ts` — `BusinessRole` (admin_general, admin_local, recepcionista, staff…).
- `src/app/features/landing/landing.component.ts` — planes publicados (Starter/Professional/Enterprise).
