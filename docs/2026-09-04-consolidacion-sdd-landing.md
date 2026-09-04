# Consolidación — Bookwise · 2026-09-04 (cierre de día)

> Resumen ejecutivo de todo el trabajo del 03–04 de septiembre y hoja de ruta para
> mañana con **work units** en orden. Incluye: landing page, definición de planes y
> precios, gate por plan (multi-tenant), revisión de salud del proyecto y SDD.

---

## 1) Landing page (producto al mercado)

### Objetivo
Una página **visual, animada y con identidad de marca fuerte** que **ofrezca el
producto al mercado**, muestre los **planes y precios** y **linkee al registro
de cuenta** (y login) ya existentes.

### Decisión de ubicación
**Dentro del proyecto** como otra página (ruta `/` o `/landing`), no un HTML
sueltos fuera. Aun así, se deja el contenido en un archivo HTML/markdown editable
dentro del repo (`src/app/features/landing/`) para poder iterar el copy.

### Requisitos
- **Hero + propuesta de valor** con animaciones suaves (CSS/IntersectionObserver).
- **Banda de precios/planes** (ver §2) con cards y CTA por plan → registro.
- **Secciones**: características, cómo funciona, testimonios/uso, FAQ.
- **CTA principal**: "Crear mi negocio" → `/register`; "Ya tengo cuenta" → `/login`.
- **Identidad**: logo `logo_side_transparente.png`, paleta Bookwise, iconografía.
- **Responsive + accesible** (con contraste, alt, navegación por teclado).
- Ruta pública (sin `data-privada`); si está logueado → redirigir según rol.

### Archivos
- `src/app/features/landing/landing.component.ts|html|scss`
- Ruta `/` (o `/landing`) en `app.routes.ts` (pública).

---

## 2) Planes y precios (descripción a documentar)

### Referencia mercado (AgendaPro)
Individual $9-19 · Básico $29 · Premium $59 · Pro $199 (USD/mes, ~20% desc. anual).
Add-ons: WhatsApp $7, telemedicina $11, agendas extra.

### Planes Bookwise (CLP, mercado chileno)
| Plan | CLP/mes (≈USD) | Incluye | Multi-empresa |
|---|---|---|---|
| **Starter** | 14.990 (≈$15) | 1 profesional, agenda, clientes, recordatorios | ❌ 1 empresa |
| **Professional** | 34.990 (≈$35) | hasta 4 profesionales, 1-3 sucursales, caja/pagos | ❌ 1 empresa |
| **Enterprise** | 79.990 (≈$85) | **2+ empresas**, multi-sucursal, **API**, consolidado, admin_general/local | ✅ **2+ empresas** |

- **Add-ons**: recordatorios WhatsApp ~CLP 7.000, telemedicina ~CLP 11.000, agendas extra.
- **Regla clave**: **"aceptar 2 empresas = Enterprise"** — el multi-tenant es una feature de plan.

---

## 3) Gate por plan (pre-descripción de cableo)

- **Selector/switch** del AppHeader y la tarjeta **"Nuevo negocio"**:
  - Sólo aparecen si el **account** es **enterprise** (`business === 'enterprise'`).
  - Planes **starter / professional** → **1 empresa** → **sin switch** ni "nuevo negocio".
- Implementar un `canManageMultiTenant` (front: `me().business?.plan === 'enterprise'`) y usarlo para mostrar/ocultar el selector + "Nuevo negocio".
- El backend ya tiene `business_plan` por tenant; el gate es de presentación (front) + validación de permisos (back: solo admin_general switch).

---

## 4) Revisión de salud del proyecto (03–04 sep)

### Implementado (mucho)
- **Layout**: AppHeader (business + actions + user) **sticky + full-width**; sidebar liviano (solo nav); menú de cuenta compartido (role-aware); logo `logo_side_transparente.png`.
- **Multi-tenant**: seeder (`MultiTenantSeeder`), `tenant_id` en `locations` (pertenencia dura), **scoping por tenant** (providers/locations/bookings), `switch-tenant` + `businesses` en `me`, selector de negocios.
- **Disponibilidad** (provider): editor semanal, preview Semanas/Meses/Rango, secuencia disponible/reserva/bloqueo, marcador de hoy, i18n.
- **Mi perfil y empresas**: tarjetas de negocios con avatares + detalle del activo + página `/admin/negocios/{id}` (edición, RUT inmutable).
- **Dashboard**: modo Suma/Por sucursal, colores de sucursal unificados (`locationColor`), i18n.
- **Widget calendario** (`bw-agenda-navigator`): salto a fecha por `?date=` en admin y provider, selección visual, altura fija.
- **i18n masivo** (`ui.*`, `settings.*`, `avail.*`, `dashboard.chart.*`, `biz.*`).
- **Hardening**: `/locations`/`/services`/`/packs` → auth-required; 401 sin token; endpoints del agente dedicados.
- **PDF/correo**: avatar del negocio (base64), `LogoService::dataUri`, ReceiptMail con tenant.

### Deuda técnica / pendientes
- **`/locations`**: raw curl sin `Accept: application/json` da 500 (Sanctum → ruta `login`). Forzar 401 para todo.
- **Availability i18n**: aún quedan strings hardcodeados (Semana estándar, Desde, Hasta, etc.) — no todo traducido.
- **Scoping**: locations con `tenant_id` (pertenencia dura); providers/bookings por relación. Falta scoping de **services/packs/available_slots** y `GET /bookings/{id}` (show no escopa por tenant).
- **Reactivación del switch**: el dashboard no recarga `dashboardStats` al cambiar tenant (solo ReferenceStore).
- **Multi-tenant**: falta `tenant_id` en `user_role` para admin_local con pivot; el `switch` de provider no (bloqueado OK); falta limpiar providers "junk" (P A / P B / royce/maggio).
- **Notificaciones/miembros/invitaciones** (de la imagen) → a futuro.
- **Testing**: no se corrieron tests de Karma (sin Chrome) — falta suite.

---

## 5) SDD consolidado + Work Units (para mañana, en orden)

1. **Landing page** (ver §1): componente + ruta + copy + animaciones + precios + CTA login/register.
2. **Gate por plan** (ver §3): `canManageMultiTenant` + ocultar selector/"Nuevo negocio" para starter/professional.
3. **Hardening de auth**: 401 para todo (`unauthenticated`), escopar `services/packs/available_slots/bookings/{id}` por tenant.
4. **i18n restante** (availability + strings sueltos).
5. **Dashboard reactivo** al switch de tenant (recargar `dashboardStats`).
6. **Limpieza de datos** (providers junk) + ajustes de `user_role.tenant_id`.
7. **Suite de tests** de las features nuevas (store, scoping, account-menu, landing).
8. **Deliverable opcional**: notificaciones, miembros admin, invitaciones.

> Cada item se puede partir en work units chicas y commitables. Empezar por Landing (WU-1) y Gate por plan (WU-2).
