# Exploration: booking-notifications

> Date: 2026-09-01
> Project: Bookwise
> Stack: Angular 21 standalone, zoneless, signals + @ngrx/signals, PrimeNG 21, Vitest
> Change: `booking-notifications`
> Contract: `openspec/changes/archive/2026-08-31-booking-dialog-tabs-state/notifications-backend-contract.md` (ACORDADO — design final del backend)

---

## Current State

La sección "Notificaciones automáticas de cita y recordatorios" de la patient-card vive **100% en memoria del cliente**: 4 toggles locales que se inicializan en `false` y no persisten. El contrato final del backend (per-client, GET/PATCH `/api/v1/clients/{id}`, 5 flags, estructura 1:1 sin mapeo) ya está acordado y documentado; el frontend solo debe **leer/escribir** — el envío lo hace carlitox + cron backend.

### Verificación por punto (evidencia contra código real)

**P1 — `ClientDetailStore.notifications`** (`src/app/core/stores/client-detail.store.ts`)
- `NotificationValues` (L33-38): 4 keys booleanas — `citaEmail`, `citaWa`, `reminderEmail`, `reminderWa`. **`citaWa` NO tiene flag backend (descartado)**.
- `emptyNotifications()` (L49-54): devuelve las 4 keys en `false`. Usado en `initialState` (L63), `initialize` (L153), `reset` (L179), `resetData` (L191).
- `initialize(client)` (L147-159): solo resetea `notifications` cuando el cliente es distinto (`sameClient` guard L148-151); con el mismo cliente las conserva. **No lee prefs del cliente** — es el punto exacto donde hay que inicializar desde `client.notification_prefs`.
- `setNotification(key, value)` (L169-173): `patchState` puro en memoria. **Sin llamada HTTP**.
- `reset()` (L175-184) / `resetData()` (L187-196, deprecated): vuelven a `emptyNotifications()`.
- Store: `signalStore({ providedIn: 'root' })` (L73-74), comparte `withMethods` con inyección de `ClientsApiService` (L78) — **el store ya tiene acceso a la API**, natural para el PATCH.

**P2 — UI actual** (`src/app/shared/components/patient-card/patient-card.component.{ts,html}`)
- HTML L55-131: collapsible `bw-pc__notif` con header `notifOpen()` (L58-70), subtítulo (L72-74).
- Tabla L77-122: **2 filas × 2 columnas de canal** (header `type_col`/`email_col`/`wa_col` L78-82):
  - Fila "cita" (L83-105): tag `immediate` + botón info `citaInfoPop` + checkboxes `citaEmail`/`citaWa` (L95-104).
  - Fila "recordatorio" (L106-121): tag `scheduled` + checkboxes `reminderEmail`/`reminderWa` (L111-120).
- Popover `#citaInfoPop` (L126-130) con `notif.popover_text` único.
- Checkboxes `p-checkbox` con patrón `[ngModel]` + `(ngModelChange)` (binary).
- **El layout 2×2 NO matchea el modelo real (3 Email + 2 WhatsApp agrupados, cada flag con label + tooltip propio)** — hay que reestructurarlo.
- TS: signals locales L74-78 (`notifOpen`, `notifCitaEmail`, `notifCitaWa`, `reminderEmail`, `reminderWa`) — los 4 valores en memoria local para modo no-diálogo.
- `notificationValue(key)` (L200-205) y `setNotification(key, value)` (L207-213): bifurcan dialogMode → store / local.
- `localNotificationValue` (L215-222) / `localNotificationValueSet` (L224-231): mapas de las 4 keys → signals locales.
- **Ojo**: `booking-form-dialog` usa la card con `[showNotifications]="false"` (booking-form-dialog.component.html L157-159) → la sección nunca renderiza ahí; las signals locales quedan "muertas" en la práctica pero deben compilar con el nuevo shape.

**P3 — ClientsApiService** (`src/app/core/services/api/clients-api.service.ts`)
- `getClient(id)` (L24-26): `GET /clients/{id}` con unwrap `{data}` → `Observable<Client>`. ✅ listo para leer prefs.
- `updateClient(id, data: Partial<Client>)` (L32-34): `PATCH /clients/{id}` → `Observable<Client>` **sin unwrap**.
  - ⚠️ **Riesgo de shape**: el spec actual (`clients-api.service.spec.ts` L76-88) mockea la respuesta PATCH como objeto plano (`req.flush(response)` con `Client` directo). Pero `getClient` unwrapea y el PATCH de bookings en `booking-detail-dialog.component.ts` L201-204 hace `response.data as Booking` (respuesta envuelta en `{data}`). **Hay que verificar contra el backend real si el PATCH de clientes devuelve `{data}` o plano**; si es `{data}`, `updateClient` necesita `.pipe(map(r => r.data))` + ajuste del spec.
- `getClients` (L13-22) y `createClient` (L28-30): sin unwrap (listas/creación planas).

**P4 — Modelo `Client`** (`src/app/core/models/index.ts` L84-97)
- Campos actuales: `id, first_name, last_name, email, phone?, rut?, gender?, wc_customer_id?, active, custom_attributes?, created_at?, updated_at?`.
- **NO tiene `notifications_enabled` ni `notification_prefs`** → hay que tiparlos: `NotificationPrefs` (5 keys booleanas, 1:1 con el backend) + `notifications_enabled?: boolean` + `notification_prefs?: NotificationPrefs` en `Client`.
- Estructura A = cero mapeo: la interface de 5 keys ES el shape del backend.

**P5 — Punto de cableado** (`src/app/features/admin/bookings/booking-detail-dialog/booking-detail-dialog.component.ts`)
- `open()` (L113-143): `clientsApi.getClient(booking.client.id)` (L119) → `next` (L120-126): enriquece booking con `fullClient`, `detailStore.initialize(fullClient)` (L123), `mergeBooking`, `loadDetailData`.
- **El GET ya trae el `fullClient` con prefs** (una vez que el backend las exponga) → el cableado es: `initialize(fullClient)` debe extraer `client.notification_prefs` → estado `notifications`.
- Error path (L127-130): `detailStore.initialize(booking.client!)` con el cliente parcial del listado (sin prefs) → los toggles caen a defaults.
- `close()` (L259-268) resetea el store — sin cambio.
- La card se monta con `[dialogMode]="true"` + `[showNotifications]="true"` en `reserva-tab.component.html` L37-44.

**P6 — i18n** (`src/app/core/i18n/es.ts` L318-327, `en.ts` L318-327)
- Keys actuales `patient_card.notif.*`: `title, subtitle, type_col, email_col, wa_col, booking_notif, reminder, immediate, scheduled, popover_text`.
- `popover_text` está **desactualizado**: dice "Por email se notifica creación/edición/cancelación. Por WhatsApp solo la creación." — el modelo real es WhatsApp = recordatorio (24h/30m) + cancelación exitosa; no hay WhatsApp de creación (`citaWa` descartado).
- Faltan: 5 labels por flag + 5 tooltips + (posiblemente) headers de grupo Email/WhatsApp. Los diccionarios son `Record<string, string>` (keys sin tipar) → agregar keys es seguro, pero **ambos archivos** (es + en) deben actualizarse en paralelo.

**P7 — Tests impactados**
- `client-detail.store.spec.ts`: L52 (shape inicial 4 keys), L98-107 (retiene notificaciones por navegación), L109-126 (reset/nueva reserva), L128-140 (aislamiento) — todos usan `setNotification('citaEmail'...)` y el shape de 4 keys → migrar a 5 keys + inicialización desde prefs.
- `patient-card.component.spec.ts`: L434-448 (`toggleNotif`, intacto); L452-489 collapsible: L469-480 escribe `citaEmail` en store dialogMode; **L482-488 "does not issue a notification backend request before the contract is confirmed" → este test se INVIERTE**: ahora el toggle SÍ dispara PATCH (parcial). Hay que reemplazarlo por tests de: PATCH con payload parcial en toggle, rollback en error, init desde prefs.
- `booking-detail-dialog.component.spec.ts` L121-132: usa `setNotification('citaEmail', true)` + assert `notifications().citaEmail` → key renombrada.
- `booking-dialog.store.spec.ts` L26-32: assert que `BookingDialogStore` NO tiene `notifications` → intacto (el dueño sigue siendo `ClientDetailStore`).
- `clients-api.service.spec.ts` L76-88: `updateClient` — puede requerir ajuste de shape `{data}` (ver riesgo P3).

**P8 — Specs OpenSpec a actualizar**
- `openspec/specs/patient-dialog-navigation/spec.md` L102-109: requirement "Maintain the pending notification persistence contract" — dice "MUST NOT assume an endpoint, payload, or save behavior before that contract is confirmed". **El contrato YA está confirmado** → la requirement debe cambiar a comportamiento real (leer prefs del GET, escribir PATCH parcial al toggle).
- `openspec/specs/booking-dialog-navigation/spec.md` L37-44: scenario "Complete client data and notifications visible" → se mantiene, probablemente sin cambio.

---

## Affected Areas

| Archivo | Rol en el change |
|---------|------------------|
| `src/app/core/models/index.ts` | Tipar `NotificationPrefs` (5 keys) + `notifications_enabled`/`notification_prefs` en `Client` |
| `src/app/core/stores/client-detail.store.ts` | `NotificationValues` 4→5 keys; `emptyNotifications()`; `initialize()` desde prefs; `setNotification` → método async que hace PATCH parcial (optimista + rollback) |
| `src/app/core/services/api/clients-api.service.ts` | `updateClient` (verificar shape `{data}` — posible unwrap) |
| `src/app/shared/components/patient-card/patient-card.component.html` | Reestructurar tabla 2×2 → grupo Email (3) + grupo WhatsApp (2), labels por flag + tooltip info por flag |
| `src/app/shared/components/patient-card/patient-card.component.ts` | Mapas locales 4→5 keys; delegar toggle al store (PATCH); quitar `citaWa` |
| `src/app/core/i18n/es.ts` + `en.ts` | 5 labels + 5 tooltips + headers de grupo; corregir `popover_text` |
| `src/app/features/admin/bookings/booking-detail-dialog/booking-detail-dialog.component.ts` | `open()` — cablear lectura de prefs (vía `initialize(fullClient)`, sin cambios de forma) |
| `src/app/core/stores/client-detail.store.spec.ts` | Migrar asserts 4→5 keys; nuevos tests de init-desde-prefs y PATCH |
| `src/app/shared/components/patient-card/patient-card.component.spec.ts` | Invertir test "no backend request"; tests de PATCH parcial + rollback + init |
| `src/app/features/admin/bookings/booking-detail-dialog/booking-detail-dialog.component.spec.ts` | Renombrar key `citaEmail` → flag backend |
| `src/app/core/services/api/clients-api.service.spec.ts` | Shape del PATCH si el backend envuelve `{data}` |
| `openspec/specs/patient-dialog-navigation/spec.md` | Requirement de contrato pendiente → contrato activo (leer/escribir) |
| `openspec/changes/booking-notifications/` | Delta spec/design/tasks nuevos (dominio sugerido: `client-notifications`) |

---

## Approaches

1. **Store-backed full wiring (recomendado)** — `NotificationValues` pasa a ser la interface de 5 keys del backend (1:1, sin mapeo). `initialize(client)` inicializa `notifications` desde `client.notification_prefs` (defaults seguros si faltan). `setNotification` se vuelve async: patch optimista en store + `clientsApi.updateClient(id, { notification_prefs: { [key]: value } })` (payload parcial) + rollback con `httpError.handle` en error (patrón ya existente en `onStatusChange` L193-223 del booking-detail-dialog). La card en modo diálogo escribe al store; las signals locales del modo no-diálogo se migran al mismo shape de 5 keys (o se eliminan si `showNotifications` queda solo para diálogo). UI reagrupada: 3 Email + 2 WhatsApp, cada flag con label + icono info/tooltip.
   - Pros: cumple el contrato acordado literalmente (estructura A, cero mapeo, PATCH parcial); reusa el patrón optimista+rollback ya probado en el repo; un solo lugar de verdad (store) para los toggles.
   - Cons: PATCH por toggle (1 request por click — aceptable para UI de configuración); requiere migrar tests existentes.
   - Effort: **Medium**

2. **Re-key mínimo sin PATCH** — Solo renombrar las 4 keys a las 5 del backend en memoria, sin cablear GET/PATCH.
   - Pros: trivial.
   - Cons: **viola el contrato acordado** (punto 3 y 5 del contrato exigen leer del GET y escribir PATCH parcial). Descartado.
   - Effort: Low

---

## Recommendation

**Approach 1.** El contrato ya está acordado y es inequívoco (per-client, GET/PATCH, 5 flags 1:1, PATCH parcial, init desde GET, frontend solo lee/escribe). La implementación es mecánica: tipar el modelo, migrar el store a 5 keys, inicializar desde prefs en `initialize()`, escribir PATCH parcial desde `setNotification` con rollback, y reestructurar la UI + i18n. Puntos de decisión que debe resolver `sdd-design`:
- **Shape del PATCH response**: ¿`{data}` envuelto o plano? (verificar contra backend real antes de aplicar; afecta `updateClient`).
- **`notifications_enabled`** (master flag del contrato): tiparlo en `Client`; decidir si se expone como toggle maestro en UI o se deja solo en el payload.
- **Signals locales no-diálogo** (`booking-form-dialog`): migrar a 5 keys o eliminar (la sección está oculta allí).
- **Defaults ante cliente parcial** (error path de `open()` L127-130): prefs ausentes → ¿todo `false` o no inicializar?

---

## Risks

- **Shape del PATCH /clients/{id} no verificado** contra el backend real (unwrap `{data}` inconsistente con el spec actual de `updateClient` y con el patrón de bookings). Verificar ANTES de aplicar.
- **Tests existentes que asumen "no backend request"** (`patient-card.component.spec.ts` L482-488) y el shape de 4 keys: si no se migran junto con la implementación, la suite rompe.
- **`citaWa` descartado**: la UI actual lo muestra; hay que removerlo de la UI, no dejarlo como toggle huérfano sin flag.
- **Mensajes i18n desactualizados** (`popover_text` describe el modelo viejo) — riesgo de UI engañosa si no se actualizan es+en en el mismo change.
- **`initialize()` con cliente distinto resetea notificaciones a vacío** — con prefs del GET debe POBLAR, no vaciar; el guard `sameClient` actual conserva estado local que ya no aplica igual.

---

## Ready for Proposal

**Yes** — el contrato está acordado, el alcance está acotado a ~8 archivos frontend + 1 spec OpenSpec, y no hay decisiones de backend pendientes. El orchestrator debe llevar a `sdd-propose` los puntos de decisión del design (shape del PATCH, `notifications_enabled`, defaults) como cuestiones a fijar en design, no como bloqueantes de proposal.
