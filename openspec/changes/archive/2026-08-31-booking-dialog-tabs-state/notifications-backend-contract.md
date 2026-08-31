# Contrato de integración — Notificaciones de cita y recordatorios (backend → frontend)

> Estado: ACORDADO (design final del backend). Este documento reemplaza la propuesta inicial
> del frontend. El frontend ya está en `develop` (change `booking-dialog-tabs-state`, archivado
> 2026-08-31). La UI de toggles existe; falta cablearla a estos endpoints.

## 1. Dónde viven las preferencias

Las preferencias de notificación viven **por cliente**, no por reserva. El backend las expone y
las persiste. El frontend **solo las lee y las escribe** — no envía nada; el envío lo ejecuta el
proveedor **carlitox** (WhatsApp + Email vía Mailgun).

## 2. Modelo de datos (en el cliente)

```json
{
  "data": {
    "id": 1,
    "first_name": "Juan",
    "email": "juan@mail.com",
    "notifications_enabled": true,
    "notification_prefs": {
      "email_new_booking": true,
      "email_booking_confirmation": true,
      "email_booking_cancellation": true,
      "whatsapp_reminder": true,
      "whatsapp_cancellation_confirmation": true
    }
  }
}
```

## 3. Endpoints

| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/api/v1/clients/{id}` | Leer prefs al abrir el detalle del cliente |
| PATCH | `/api/v1/clients/{id}` | Escribir prefs al cambiar un toggle |

PATCH acepta un objeto parcial — solo se envían los campos cambiados:

```json
{
  "notification_prefs": {
    "whatsapp_reminder": false
  }
}
```

## 4. Matriz de eventos → canal → timing

| Flag (backend) | Evento | Canal | Cuándo se envía |
|----------------|--------|-------|-----------------|
| `email_new_booking` | Nueva reserva | Email | Inmediato (al crear la reserva) |
| `email_booking_confirmation` | Confirmación de reserva | Email | Inmediato (al confirmar) |
| `email_booking_cancellation` | Cancelación de reserva | Email | Inmediato (al cancelar) |
| `whatsapp_reminder` | Recordatorio de reserva | WhatsApp | Programado (24h y 30m antes) |
| `whatsapp_cancellation_confirmation` | Cancelación exitosa | WhatsApp | Automático (apenas se cancela) |

## 5. Qué cambia respecto al contrato que propuso el front

1. **NO es por reserva**: los toggles son por cliente → se leen/escriben en `/clients/{id}`, no en `/bookings/{id}`.
2. Los `reminder_24h_sent_at` / `reminder_30m_sent_at` siguen siendo timestamps de "ya se envió" — **no se usan como toggles**. Los flags de habilitación son los `notification_prefs`.
3. **No existe el toggle "citaWa"** (WhatsApp inmediato al crear): en el modelo actual, WhatsApp cubre recordatorio (programado) y cancelación exitosa (automático). Si la UI quería un aviso WhatsApp al crear, eso no está contemplado — **confirmar con backend si hace falta**.
4. Los toggles se **inicializan desde el GET**, no en `false` por defecto en memoria (hoy `ClientDetailStore.notifications` arranca en `false` cada vez que se abre).

## 6. Lo que el frontend NO tiene que implementar

- No disparar mails ni WhatsApp.
- No calcular timing de recordatorios (lo hace el cron de backend + carlitox).
- No re-disparar notificaciones.

## 7. Implicancias para el frontend (trabajo pendiente de cablear)

El `ClientDetailStore` / `patient-card` hoy exponen 4 toggles locales (`citaEmail`/`citaWa`/`reminderEmail`/`reminderWa`)
que se inicializan en `false` y no persisten. Para cumplir este contrato:

1. **Mapear los 5 flags del backend** a la UI de toggles del cliente:
   - `email_new_booking` → Email · Nueva reserva
   - `email_booking_confirmation` → Email · Confirmación
   - `email_booking_cancellation` → Email · Cancelación
   - `whatsapp_reminder` → WhatsApp · Recordatorio (24h/30m)
   - `whatsapp_cancellation_confirmation` → WhatsApp · Cancelación exitosa
   - (Nota: `citaWa`/inmediato al crear NO tiene flag — confirmar con backend si se agrega.)
2. **Leer** `notification_prefs` en `GET /clients/{id}` al abrir el detalle del cliente (en `open()` / `ClientDetailStore.initialize()`) e inicializar los toggles desde ahí (no `false`).
3. **Escribir** vía `PATCH /clients/{id}` con objeto parcial solo al cambiar un toggle.
4. **Alinear la UI** con los 5 flags (la sección "Notificaciones automáticas de cita y recordatorios" actualmente muestra 2 filas: cita Email/WhatsApp + recordatorio Email/WhatsApp; debe reflejar el modelo real).

---

*Contrato de integración backend→frontend. Actualizado con el design final del backend (2026-08-31).*
