# Backend Contract — Notificaciones de cita y recordatorios

> Estado: PROPUESTA para el equipo backend.
> Contexto: el diálogo de detalle de reserva (`bw-booking-detail-dialog`) muestra la sección
> "Notificaciones automáticas de cita y recordatorios" (ver `patient_card.notif.*` en `src/app/core/i18n/es.ts`).
> Hoy esos toggles viven SOLO en memoria del cliente (store local) — NO se persisten ni se leen del backend.

## 1. Qué muestra hoy la UI (requerimiento actual)

La sección tiene **4 toggles** (2 tipos de mensaje × 2 canales):

| Toggle | Label (i18n) | Tipo | Canal | Cuándo se dispara (según UI) |
|--------|--------------|------|-------|------------------------------|
| `citaEmail` | "Notificaciones de cita" · "Inmediato" · Email | cita | Email | creación/edición/cancelación de la cita |
| `citaWa` | "Notificaciones de cita" · "Inmediato" · WhatsApp | cita | WhatsApp | solo creación de la cita |
| `reminderEmail` | "Recordatorio" · "Programado" · Email | recordatorio | Email | aviso previo a la hora de la cita |
| `reminderWa` | "Recordatorio" · "Programado" · WhatsApp | recordatorio | WhatsApp | aviso previo a la hora de la cita |

Detalle del popover (i18n `patient_card.notif.popover_text`):
> "Por email se notifica creación/edición/cancelación. Por WhatsApp solo la creación."

## 2. Estado actual del modelo (hallazgos verificados)

- El modelo TypeScript `Booking` (`src/app/core/models/index.ts`) **NO** tipa ningún campo de
  notificación ni de recordatorio. Solo tiene `notes`, `internal_notes`, `created_via`, etc.
- El backend SÍ devuelve campos de recordatorio (observados en runtime en el payload de booking/sesiones):
  - `reminder_24h_sent_at` — timestamp del recordatorio de 24h (si se envió).
  - `reminder_30m_sent_at` — timestamp del recordatorio de 30 min (si se envió).
  - ⚠️ Estos son **timestamps de "ya se envió"**, NO flags de "habilitar/escribir". No sirven para prender/apagar la notificación desde la UI.
- El `UpdateBooking` (`src/app/core/models/requests/blocked-slots.ts`) solo expone:
  `start_time, end_time, status_id, price, custom_duration_minutes, notes, provider_id`. **No hay campo de notificación.**
- El estado de notificaciones vive en `ClientDetailStore.notifications` (`citaEmail/citaWa/reminderEmail/reminderWa`),
  inicializado en `false` en cada `initialize()`/`reset()`. Es 100% cliente, sin persistencia.

## 3. Contrato propuesto (lo que pedimos al backend)

### 3.1 Flags de preferencia en la Booking

Se necesita poder **leer y escribir** las preferencias por reserva (o por cliente). Propuesta de campos
en el payload de la booking (solo lectura desde el detalle, escritura vía `updateBooking`):

```ts
interface BookingNotificationPrefs {
  // Cita (inmediato)
  notify_cita_email: boolean;      // crear/editar/cancelar → email
  notify_cita_whatsapp: boolean;   // crear → whatsapp
  // Recordatorio (programado)
  notify_reminder_email: boolean;      // previo a la cita → email
  notify_reminder_whatsapp: boolean;   // previo a la cita → whatsapp
}
```

- **Lectura**: estos campos vienen embebidos en `GET /bookings` (listado) y `GET /bookings/:id`.
- **Escritura**: vía `PATCH /bookings/:id` (el `UpdateBooking` extendido).

### 3.2 Configuración del recordatorio (opcional — para "Programado")

Si el recordatorio es "Programado", el backend necesita saber **cuándo** enviarlo. Propuesta:

```ts
interface BookingReminderConfig {
  reminder_offset_minutes?: number | null; // ej. 1440 (24h) | 30 | 0/off
  reminder_lead_time?: '24h' | '30m' | 'off';
}
```

Esto permite que el front muestre un selector de "24h antes / 30 min antes / desactivado" en vez de solo on/off.

### 3.3 Endpoints de envío (para debugging / re-disparo)

Opcional, para pruebas manuales o reenvío:

```
POST /bookings/{id}/notify         → re-dispara las notificaciones de cita según sus prefs
POST /bookings/{id}/reminder       → re-dispara el recordatorio según su config
```

### 3.4 Modelo tipado mínimo que el frontend necesita

```ts
// Frontend — añadir al Booking
interface Booking {
  // ... campos actuales ...
  notification_prefs?: BookingNotificationPrefs;
  reminder_config?: BookingReminderConfig;
}
```

## 4. Preguntas abiertas para resolver con el backend

1. ¿Las preferencias son **por reserva** o **por cliente**? (Decide la cardinalidad; la UI hoy está en el detalle de una reserva, pero tiene sentido por cliente.)
2. ¿Los campos `reminder_24h_sent_at` / `reminder_30m_sent_at` se mantienen como timestamps (informativos) o se reemplazan por los flags de habilitar?
3. Para el recordatorio "Programado", ¿el backend envía automáticamente según `reminder_config`, o el front debe programarlo? (Recomendado: backend, con un job/tarea en Laravel.)
4. El valor por defecto de los flags si la booking no los trae (asumimos `false` en el cliente, pero conviene que el backend los devuelva explícitamente).
5. ¿Cómo se comporta la notificación de cita por WhatsApp en "solo creación" (el popover lo dice) — el flag `notify_cita_whatsapp` solo aplica a creación?

## 5. Contrato mínimo aceptable (MV para la feature de UI)

Para que la UI deje de ser solo memoria y funcione de verdad, el backend debe:

1. Exponer `notification_prefs` (4 booleans) en la booking (listado + detalle).
2. Aceptar `PATCH /bookings/:id` con esos 4 booleans.
3. Respetar los flags al momento de enviar las notificaciones (crear/editar/cancelar cita, y recordatorio programado).

Con eso el cliente puede leer/guardar los toggles y el envío real queda del lado del backend.

---

*Documento de contrato — creado como parte del change `booking-dialog-tabs-state`. No incluye implementación; es la base para coordinar con el equipo backend.*
