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
| 1.1 | **Clientes**: lo que no depende del contrato — i18n es/en, columna RUT, acciones reales, detalle con `bw-patient-detail-content`, alta/edición (`clients.create/update` ya existen) | `clientes-base-de-pacientes.md` T4, T5, T7 | implementar |
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
- `ng test` actual: **756 pass / 8 fail**. De los 8, **6 son los ya conocidos**
  (calendar-navigation 1, historial-reserva 3, booking-form-dialog 2) y **2 son nuevos de observar**
  pero preexistentes: `booking-detail-dialog` agota el timeout de 5s en el área de detalle de
  paciente (`keeps Reserva mounted…`, `shows the patient detail content…`), ajenos a esta tanda
  (tocan `ClientDetailStore` / paciente, no la paginación).
