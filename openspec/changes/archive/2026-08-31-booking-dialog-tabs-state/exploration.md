# Exploration: booking-dialog-tabs-state

> Date: 2026-08-31
> Project: Bookwise
> Stack: Angular 21 standalone, zoneless, signals + @ngrx/signals, PrimeNG 21, FullCalendar 6.1, Vitest
> Change: `booking-dialog-tabs-state`

---

## Current State

El diálogo de detalle de reserva (`BookingDetailDialogComponent`) maneja sus tabs principales (`reserva`, `pago`, `recordatorios`, `paciente`, `ficha`, `historial`) con una `@switch (activeTab())` sobre el contenido del `p-dialog`, mientras que la barra de tabs vive en el `pTemplate="header"` usando `p-tabs`/`p-tablist` SIN `p-tabpanels`. El contenido activo se monta/desmonta en cada cambio de tab.

La patient-card (`bw-patient-card`) dentro del tab Reserva se renderiza SIN `dialogMode`, por lo que sus sub-tabs (`planes`, `sesiones`, `prepago`, `recientes`) abren el panel interno colapsado de la propia card en lugar de emitir `patientTabSelected`. El componente `bw-patient-detail-content` (que debería mostrar el detalle de paciente reemplazando solo el área de contenido) está importado pero nunca renderizado.

El comportamiento deseado ya está especificado en `openspec/specs/patient-dialog-navigation/spec.md`: header + tabs principales visibles durante el detalle de paciente; los sub-tabs de la card reemplazan SOLO el área de contenido manteniendo el tab `Reserva` seleccionado.

---

## Verificación de causas raíz

Cada causa raíz reportada fue verificada contra el código real. Resultado:

### RC1 — `@switch (activeTab())` destruye/recrea el componente del tab — **CONFIRMADA**

`booking-detail-dialog.component.html` L107-193 usa `@switch (activeTab())` con un `@case` por tab. Cada cambio de tab destruye el componente activo y crea el nuevo. Como `ReservaTabComponent` mantiene el estado del form en signals locales (`selectedDate`, `startHour`, …, L47-54 de `reserva-tab.component.ts`) y `PatientCardComponent` mantiene `notifOpen`/checkboxes locales, todo ese estado se pierde al alternar tabs.

### RC2 — Dos fuentes de verdad para el booking — **CONFIRMADA, con corrección en el mapeo**

Existen dos stores: `BookingStore` (root, `providedIn: 'root'`, dueño canónico de `bookings[]` + `selectedBooking` computed) y `BookingDialogStore` (`@Injectable()` por instancia del diálogo, snapshot `booking`).

El mapeo reportado es **parcialmente incorrecto** y se corrige así:

| Consumidor | Fuente real |
|---|---|
| Header del diálogo (HTML L16) | `store.selectedBooking()` (BookingStore root) — **NO** `dialogStore.booking` |
| `reserva-tab.component.ts` (L41, 76-84, 96, 121, 154-157, 184, 200, 212) | `store.selectedBooking()` (BookingStore root) |
| patient-card (vía `[client]="store.selectedBooking()!.client!"`, `reserva-tab.component.html` L38) | BookingStore root (input) — **NO** `dialogStore.booking` |
| Footer "Eliminar reserva" / `deleteBooking()` (HTML L199, TS L192) | `dialogStore.booking` (snapshot) |

La desincronización real: `dialogStore.booking` es un snapshot que solo se refresca en `replaceBooking()` (llamado únicamente en `onStatusChange`, L174). `saveBookingTime()` y `savePatientData()` (en `reserva-tab`) actualizan el store root vía `mergeBooking()` pero **NO** actualizan `dialogStore`. Consecuencia: el footer/`deleteBooking()` puede operar sobre un booking stale, mientras header/card/reserva-tab leen el canónico. El problema de doble fuente es real, pero no en el lugar exacto reportado.

### RC3 — patient-card NO en `dialogMode` dentro del tab Reserva — **CONFIRMADA**

`reserva-tab.component.html` L37-42:

```html
<bw-patient-card
  [client]="store.selectedBooking()!.client!"
  [showNotifications]="true"
  [showEdit]="true"
  (editRequested)="onEditRequested()"
/>
```

Faltan `[dialogMode]` y `(patientTabSelected)`. Con `dialogMode=false` (default), `openPanel()` (patient-card.component.ts L165-176) toma la rama interna (`panelTab.set` + `panelOpen.set(true)`) y **no** emite `patientTabSelected`.

### RC4 — `bw-patient-detail-content` huérfano — **CONFIRMADA**

`PatientDetailContentComponent` está importado en `booking-detail-dialog.component.ts` (L13, L40) pero `grep` confirma que NO se usa en ningún template (solo en sus propios `.html`/`.scss`/`.ts`/`.spec`). `onPatientTabSelected` existe en el TS (L124-127) pero no está bindeado en el HTML. `(patientTabSelected)` (output de la card) no se escucha en ningún template padre (solo en el `.spec` de la card).

### RC5 — Clase residual `bw-payment-dialog` — **CONFIRMADA**

Exactamente 4 ocurrencias: `booking-detail-dialog.component.html` L11 (`root: { class: 'bw-payment-dialog' }`), `booking-detail-dialog.component.scss` L5, L10, L174. No queda rastro de `payment-detail-dialog`/`PaymentDetailDialog` (nombre viejo ya eliminado).

---

## Hallazgo técnico clave — PrimeNG p-tabpanel (verificado en node_modules)

- **Versión instalada**: `package.json` → `21.1.6`. El prompt indicaba `v21.2.8`; los metadatos del bundle compilado (`fesm2022/primeng-tabs.mjs`) sellan `version: "21.2.8"` (desfase build-time). La conducta es idéntica en ambas.
- `lazy` input default `false` (`primeng-tabs.mjs` L114, L761).
- `isLazyEnabled = computed(() => this.pcTabs.lazy() || this.lazy())` (L776).
- `shouldRender()` (L778-787): con `lazy=false` devuelve `true` **siempre** (`if (!this.isLazyEnabled() || this.hasBeenRendered) return true`). El contenido queda montado.
- Host binding: `[hidden]='!active()'` (L790/L824). El panel se oculta con `hidden`, no se destruye.

**Conclusión**: `p-tabpanel` es "keep-alive" nativo. Migrar de `@switch` a `p-tablist` + `p-tabpanels` preserva el estado de los tabs sin recurrir a `@defer` (que solo aplica a lazy-loading de paneles pesados, no a este bug). Confirmado.

---

## Reporte de estructura del template (para planear el paso a p-tabpanels)

- `p-tabs` (HTML L52) contiene **únicamente** `p-tablist` (L53) + `p-tab` por cada tab de `visibleTabs()`, todo dentro de `<ng-template pTemplate="header">` (L15-75).
- **No existen** `p-tabpanels`/`p-tabpanel` en ningún punto.
- El contenido activo lo decide `@switch (activeTab())` en el cuerpo (L107), envuelto en `@if (visible())` (L78) y `@if (store.selectedBooking(); as booking)` (L79).

**Implicación estructural**: `p-tabpanel` inyecta `forwardRef(() => Tabs)`, por lo que DEBE ser descendiente del elemento `p-tabs`. Hoy `p-tabs` vive solo en el header; para usar `p-tabpanels` el `p-tabs` debe envolver TANTO el `p-tablist` del header COMO los `p-tabpanel` del cuerpo — un cambio estructural (el `p-tablist`/`p-tabs` sale del `pTemplate="header"` o se reestructura para abarcar header + body). El guard `@if (visible())` que hoy resetea el contenido al cerrar debe preservarse para mantener el reset-on-close.

---

## Hallazgo adicional: tensión entre el bug reportado y el spec vigente

`openspec/specs/patient-dialog-navigation/spec.md` ya especifica el comportamiento deseado, y contiene un escenario en potencial conflicto con el bug #1 reportado:

> **Scenario: Return after unsaved edits** — GIVEN staff edits reservation fields without saving WHEN staff visits a patient detail tab and returns THEN the unsaved edits are discarded and persisted values are shown.

El bug #1 ("el tab Reserva pierde la fecha/hora al volver de los sub-tabs del paciente") trata la pérdida como defecto, pero el spec vigente la define como comportamiento esperado (descartar ediciones sin guardar). La fase de **proposal** debe reconciliar: ¿se descartan las ediciones sin guardar al entrar/salir del detalle de paciente (spec vigente), o se preservan (keep-alive) también al alternar tabs principales? Esta decisión afecta el alcance de la migración a `p-tabpanels`.

---

## Hallazgo adicional: posible causa de "patient-card muestra solo el nombre" (bug #2)

`Client` (`src/app/core/models/index.ts` L84-97) exige `email: string` y `phone?: string | null`. La card renderiza email/phone bajo `@if (client().email)` / `@if (client().phone)` (patient-card.component.html L11-16). Como header y card leen el MISMO `booking.client`, que ambos muestren "solo el nombre" sugiere que el `client` embebido en la lista de bookings del calendario es un objeto parcial (sin `email`/`phone`), no un defecto del template. **Requiere verificación a nivel de datos/API** (payload de `getBookings`): si `booking.client.email` llega vacío, la card no lo muestra por diseño.

---

## Affected Areas

- `src/app/features/admin/bookings/booking-detail-dialog/booking-detail-dialog.component.{ts,html,scss}` — estructura de tabs (`@switch` → `p-tabpanels`), binding de `(patientTabSelected)`, render de `bw-patient-detail-content`, limpieza de clase `bw-payment-dialog`.
- `src/app/features/admin/bookings/booking-detail-dialog/tabs/reserva/reserva-tab.component.{ts,html}` — pasar `[dialogMode]` y `(patientTabSelected)` a `bw-patient-card`; resolver doble fuente de booking.
- `src/app/shared/components/patient-card/patient-card.component.{ts,html}` — ya soporta `dialogMode` y `patientTabSelected`; sin cambios (o mínimos).
- `src/app/shared/components/patient-card/patient-detail-content.component.{ts,html}` — componente listo, hoy huérfano; solo falta cablearlo.
- `src/app/core/stores/booking-dialog.store.ts` — snapshot desincronizado; decidir fuente única.
- `src/app/core/stores/client-detail.store.ts` — `activeView`/`selectTab`/`returnToReservation` ya existen; verificar sincronización con `dialogStore`.
- `src/app/core/stores/booking.store.ts` — dueño canónico (`selectedBooking`, `mergeBooking`); referencia de verdad.

---

## Approaches

1. **Migrar a `p-tablist` + `p-tabpanels` (keep-alive nativo)**
   - Reestructurar `p-tabs` para envolver header (tablist) + body (tabpanels), reemplazando `@switch`.
   - Pros: elimina RC1 de raíz; cero pérdida de estado local entre tabs principales; patrón nativo PrimeNG; conserva reset-on-close vía `@if (visible())`.
   - Cons: cambio estructural del layout header/body; los tabs móviles (`visibleTabs()`) y el `@switch` del contenido deben mapearse a `p-tabpanel [value]`; riesgo de regresión visual (estilos del tablist ya existentes en SCSS).
   - Esfuerzo: Medio.

2. **Extraer estado del form a un store (fuente única) y mantener `@switch`**
   - Mover `selectedDate`/horas/notas de `ReservaTabComponent` y los checkboxes de notificación a `BookingDialogStore`/`ClientDetailStore`, de modo que la recreación del componente rehidrate desde el store.
   - Pros: resuelve la pérdida de estado sin tocar la estructura de tabs; refuerza la fuente única (RC2).
   - Cons: más código de sincronización; no aprovecha el keep-alive nativo; el estado "efímero" (accordion abierto) seguiría perdiéndose (aceptable per spec).
   - Esfuerzo: Medio-Alto.

3. **Híbrido: `p-tabpanels` + fuente única de booking (recomendado)**
   - Combinar (1) con la consolidación de RC2: `dialogStore.booking` deja de ser snapshot divergente (o se elimina en favor de `store.selectedBooking()`), y se cablea `dialogMode` + `patientTabSelected` + `bw-patient-detail-content` para cerrar RC3/RC4.
   - Pros: resuelve las 5 causas raíz; alinea con `patient-dialog-navigation/spec.md`; menor superficie de estado duplicado.
   - Cons: mayor alcance; toca 3 stores + 2 componentes + template del diálogo.
   - Esfuerzo: Medio.

---

## Recommendation

**Approach 3 (híbrido)**, con una decisión previa obligatoria en proposal: definir si las ediciones sin guardar se **descartan** (spec vigente) o se **preservan** (keep-alive) al alternar tabs principales. La migración a `p-tabpanels` (keep-alive) tiende a PRESERVAR las ediciones sin guardar, lo que contradice el escenario "Return after unsaved edits" del spec — debe reconciliarse explícitamente.

Además: verificar el payload de `getBookings` para confirmar si el `client` embebido incluye `email`/`phone` (bug #2), antes de asumir un fix de template.

---

## Risks

- **Conflicto spec vs bug**: preservar ediciones sin guardar contradice `patient-dialog-navigation/spec.md` ("unsaved edits are discarded"). Sin decisión explícita, el fix puede "corregir" un bug que el spec define como comportamiento esperado.
- **Regresión visual del tablist**: el SCSS actual de `booking-dialog-tabs` (L14-49) está calibrado para `p-tablist` en el header; al mover `p-tabs` para envolver body, hay riesgo de romper el layout/estilos.
- **Regresión móvil**: `visibleTabs()` filtra tabs en mobile; el mapeo a `p-tabpanel` debe conservar ese filtro sin dejar paneles sin tab.
- **Doble fuente de booking**: consolidar a una sola fuente toca `deleteBooking()`/footer, que hoy leen snapshot stale; un cambio mal hecho puede romper el borrado.
- **Alcance ampliado**: tocar stores + template + componentes en un solo cambio roza el presupuesto de review; considerar slices si supera ~400 líneas.

---

## Ready for Proposal

**Yes.** Las 5 causas raíz están verificadas contra el código real (RC2 con corrección de mapeo). El hallazgo técnico de PrimeNG está confirmado (con corrección menor de versión). El siguiente paso es `sdd-propose`, con la advertencia explícita de reconciliar el escenario "unsaved edits" del spec vigente antes de fijar el comportamiento objetivo.
