# Emails automáticos — inventario del front

Espejo del documento del API (`Bookwise-API/odd/tasks/email-automation.md`). Acá se registra
**qué dispara el front y qué muestra**, no lo que envía: el envío es exclusivo del API (Mailgun).
Levantado el 2026-11-13 sobre `develop`.

## Specs

- **S1 (sesión del API, verbatim):** «hacer lo mismo del lado del front: inventario propio en memoria +
  documento, con el mismo alcance (login, onboarding, notificaciones, recordatorios)».
- **S2 (sesión del API, verbatim):** «El único que manda correo es el API. El front no manda ni SMTP ni
  nada: solo dispara y lee estado.» — sin cliente SMTP, sin plantillas de correo, sin cola en el front.
- **S3 (sesión del API, verbatim):** «Preferencias del cliente: hoy son 5 flags (`email_new_booking`,
  `email_booking_confirmation`, `email_booking_cancellation`, `whatsapp_reminder`,
  `whatsapp_cancellation_confirmation`)» y los recordatorios por email «se mandan **sin** preferencia
  propia (solo miran `notifications_enabled`)». Decisión abierta que toca la UI: agregar
  `email_reminder`, o renombrar `whatsapp_reminder` a «recordatorios» y que aplique a los dos canales.
- **S4 (sesión del API, verbatim):** magic link con `POST /api/v1/auth/magic-link` (siempre 202, sin
  revelar si el correo existe) y `POST /api/v1/auth/magic-link/consume`; la pantalla «revisa tu correo»
  ya está diseñada **en el repo del API** (`design/login/02-magic-link-first.html`) junto a las otras
  dos direcciones de login (Google/Apple/Facebook + correo).
- **S5 (sesión del API, verbatim):** «una cuenta nueva tiene que completar onboarding antes de operar, y
  los datos se capturan en la cuenta/tenant»; si el front ya lo tiene, no duplicar contrato.
- **S6 (sesión del API, verbatim):** el recordatorio de sesión de pack «debería decir cuántas sesiones
  quedan, dato que ya exponés con `remaining_sessions`».

## Inventario verificado

### (a) Sección de notificaciones y recordatorios — dónde vive hoy

- Vive **dentro de la ficha del cliente**, no en una pantalla propia: `bw-patient-card`
  (`src/app/shared/components/patient-card/patient-card.component.html:56`) con acordeón colapsable
  (`:58-72`) y dos grupos por canal: **Email** (`:79`) y **WhatsApp** (`:95`).
- Se muestra: en el diálogo de detalle de cliente (`client-detail-dialog.component.html:17`) y en el tab
  Reserva del detalle de reserva (`reserva-tab.component.html:40`). En el form de reserva va apagada
  (`booking-form-dialog.component.html:160`); es `input<boolean>` con default `false`
  (`patient-card.component.ts:34`).
- Origen de datos: `ClientDetailStore.initialize()` copia `{...emptyNotifications(), ...notification_prefs}`
  (`src/app/core/stores/client-detail.store.ts:144-148`). Modelo: `NotificationPrefs` =
  5 booleanos (`src/app/core/models/index.ts:137-145`).
- **No existe** pantalla de «recordatorios» con estado/whatsapp/email programado: la UI sólo expone
  preferencias por cliente. La campanita del header no existe (`app-header.component.html:78` es un
  comentario «A futuro»).
- Trampa a resolver: `/admin/profile` tiene una card «Canales de notificación» con 3 toggles
  (`profile.component.html:146-175`, copy en `es.ts:628-633`) que **no persisten nada** —
  `profile.component.ts:102-105` dice «UI local por ahora; persistencia a futuro con notification_prefs».
  Dos lugares que dicen lo mismo y sólo uno guarda.
- `notifications_enabled` está en el modelo (`models/index.ts:160`) y **ningún componente lo lee ni lo
  escribe** — el switch maestro del que dependen los recordatorios por email no tiene UI.

### (b) Mapeo real de toggles

| Campo API | ES | EN | Grupo UI |
|---|---|---|---|
| `email_new_booking` | «Nueva reserva» (`es.ts:1111`) | New booking (`en.ts:1055`) | Email |
| `email_booking_confirmation` | «Confirmación de reserva» (`es.ts:1112`) | Booking confirmation (`en.ts:1056`) | Email |
| `email_booking_cancellation` | «Cancelación de reserva» (`es.ts:1113`) | Booking cancellation (`en.ts:1057`) | Email |
| `whatsapp_reminder` | «Recordatorio de reserva» (`es.ts:1114`) | Booking reminder (`en.ts:1058`) | WhatsApp |
| `whatsapp_cancellation_confirmation` | «Cancelación exitosa» (`es.ts:1115`) | Cancellation confirmation (`en.ts:1059`) | WhatsApp |

- Título del bloque: «Notificaciones automáticas de cita y recordatorios» / subtítulo «Vía Email y
  WhatsApp» (`es.ts:1107-1110`). Tooltips en `es.ts:1116-1120` — el de recordatorio dice literalmente
  «WhatsApp programado 24 h y 30 min antes de la reserva.» (`es.ts:1119`).
- Guardado: optimista con rollback (`client-detail.store.ts:163-183`) → payload **parcial**
  `{ notification_prefs: { [flag]: value } }` (`:174`) → **PATCH `/api/v1/clients/{id}`**
  (`clients-api.service.ts:114-118`).
- Contrato de referencia en el repo: `openspec/specs/client-notifications/spec.md` y
  `openspec/changes/archive/2026-08-31-booking-dialog-tabs-state/notifications-backend-contract.md`
  (prefs **por cliente**, no por reserva).

### (c) Pantallas de auth y estados de «correo enviado»

| Ruta | Componente | Qué hace |
|---|---|---|
| `/login` | `features/auth/login/*` | POST `/auth/login`; 403 `email_not_verified` → aviso (`es.ts:168`) |
| `/register` | `register/*` | POST `/auth/register`; éxito inline «Revisa tu correo para verificar tu email» (`es.ts:166`) |
| `/verify-email` | `verify-email/*` | PATCH `/auth/verify-email` con token de query; estados loading/success/error |
| `/forgot-password` | `forgot-password/*` | POST `/auth/forgot-password`; **sí tiene** estado «Revisa tu correo» (`es.ts:176-177`) |
| `/reset-password` | `reset-password/*` | POST `/auth/reset-password`; éxito «Contraseña restablecida» |
| `/onboarding` | `features/admin/onboarding/*` | POST `/businesses` (ver (e)) |

- **No existen**: magic link / passwordless, botones Google/Apple/Facebook, botón «reenviar
  verificación», cambio de email (el email es read-only: `profile.personal.email_note` en `es.ts:1199`).
- `design/` del front **no tiene** artboards de login: los de S4 viven sólo en el repo del API.

### (d) Emails que el front dispara (indirectamente)

Auth: registro (`POST /auth/register`), verificación (`PATCH /auth/verify-email`), olvido
(`POST /auth/forgot-password`), reset (`POST /auth/reset-password`), cambio de contraseña autenticado
(`POST /auth/password`), guardar teléfono (`PATCH /auth/me`).

Reservas: crear (`POST /bookings`, con `service_pack_id` para packs), editar
(`PATCH /bookings/{id}` desde form, drag&drop del calendario admin y provider, reprogramar desde el tab
Reserva), cambiar estado —confirmar/cancelar— (`PATCH /bookings/{id}` con `status_id`), cancelar con
confirmación (`PATCH /bookings/{id}/cancel`).

Clientes y cuenta: alta/edición de paciente (`POST`/`PATCH /clients`, incluida el alta rápida desde el
form de reserva), toggle de preferencias (`PATCH /clients/{id}`), onboarding y negocio adicional
(`POST /businesses`), asignación de admin local (`POST /businesses/{id}/assign-admin-local`).

**No existe** flujo público de reserva/confirmación para el cliente final: no hay página de booking
público, así que ningún email al cliente se origina en una sesión de cliente.

### (e) Onboarding — ya existe, no duplicar contrato

- Ruta `/onboarding` con `roleGuard(['admin'])` (`app.routes.ts:31-35`); guard
  `onboarding.guard.ts:21-33` redirige desde `/admin` cuando `needsOnboarding()` y falla cerrado si
  `/auth/me` rompe.
- Captura (signals, `onboarding.component.ts:95-105`): `name`, `rut`, `email`, `address`, `phone`,
  `plan` (`starter|professional|enterprise`), `professional_count`, `business_type` (16 valores) y
  `business_type_other`; valida RUT/email en `:158-177` y hace `POST /businesses` (`:119`), después
  `auth.loadMe(true)` y navega `/admin`.
- No hay store de onboarding: el tenant vive en `AuthService` vía `/auth/me`.

## Tasks

| # | Tarea | Specs | Estado |
|---|---|---|---|
| T1 | Inventario verificado de disparadores, pantallas y preferencias (este documento) | S1, S2 | ✅ hecho |
| T2 | `email_reminder` como 6º flag, default `true` (**contrato cerrado por el mantenedor**) | S3 | ✅ cerrado |
| T3 | Switch maestro **visible** en la tarjeta del cliente: `notifications_enabled` viaja también dentro de `notification_prefs` (aditivo, el GET sigue con el top-level) | S3 | ✅ contrato cerrado · ⏳ UI |
| T4 | **Eliminar** la card «Canales de notificación» de `/admin/profile`: una sola superficie, la tarjeta del cliente | S3 | ⏳ pendiente (decisión tomada) |
| T5 | Diseñar e implementar magic link (pantalla + estado «revisa tu correo» + consumo de token) | S4 | ⏳ pendiente (no existe) |
| T6 | Diseñar e implementar login social Google/Apple/Facebook | S4 | ⏳ pendiente (no existe) |
| T7 | Botón «reenviar verificación»: el endpoint lo hace el API (`POST /auth/verify-email/resend`, S9/T20, rate limit por usuario); el front espera que exista | S1 | ⏳ bloqueado por el API (no diseñar a ciegas) |
| T8 | ~~Recordatorio de sesión de pack con `remaining_sessions`~~ — **descartada**: el correo lo renderiza el API (Blade) leyendo el `client_pack`; el front no participa ni recibe ese payload. Sólo aplica si algún día hay estado de recordatorio en pantalla | S6 | ⛔ descartada |
| T9 | Cruzar este inventario con el del API y cerrar diferencias | S1 | ✅ cerrado (L3) |
| T11 | Diseñar la tarjeta de preferencias: maestro + 6 flags por canal | S3 | ✅ `design/preferencias-cliente/` (3 direcciones) |
| T12 | Implementar el maestro y el 6º flag en `bw-patient-card` + PATCH parcial con `notifications_enabled` | S3 | ⏳ pendiente (tras elegir dirección) |
| T13 | Quitar la card de `/admin/profile` | S3 | ⏳ pendiente |
| T10 | Mapear el onboarding existente contra lo que el API espera de «cuenta completa» | S5 | ✅ inventariado acá |

## Log

- **L1 (2026-11-13, sesión del API, verbatim):** «Del lado del API arrancamos el mapa de emails
  automáticos (proveedor: **Mailgun**). Documento maestro: `odd/tasks/email-automation.md` … Te pido
  hacer lo mismo del lado del front: inventario propio en memoria + documento, con el mismo alcance
  (login, onboarding, notificaciones, recordatorios).» Datos que cambian el plan: sólo el API manda
  correo (`MAIL_MAILER=log` hoy, o sea que nada sale hasta configurar Mailgun); magic link
  `POST /auth/magic-link` (siempre 202) + `POST /auth/magic-link/consume` con pantalla ya diseñada en el
  repo del API; prefs de cliente con 5 flags y recordatorios por email sin preferencia propia; el API ya
  manda 24 h y 30 min antes por email (cron cada 5 min, con dedupe); onboarding obligatorio antes deoperar.
- **L2 (2026-11-13, front):** inventario levantado sobre `develop` (post merge de #47-#53). Cuatro
  hallazgos que el API necesita: (1) `notifications_enabled` no tiene UI ni escritor en el front, y es el
  único gate de los recordatorios por email; (2) la card «Canales de notificación» de `/admin/profile`
  son señales locales sin persistencia, así que hoy hay dos superficies de preferencias que dicen cosas
  distintas; (3) no hay botón de reenvío de verificación, así que un usuario con el mail perdido queda
  sin recuperación desde la UI; (4) no existe magic link ni login social en el front, y `design/` del
  front no tiene artboards de login (los de S4 viven sólo en el repo del API).

- **L3 (2026-11-13, sesión del API — decisiones y correcciones):** el hilo de contrato se abrió y el
  mantenedor decide. Posición técnica del API aceptada acá: (1) **`email_reminder`** como 6º flag con
  **default `true`**, así el comportamiento actual no cambia y el PATCH parcial valida igual que los otros
  cinco; (2) **`notifications_enabled`** pasa a `notification_prefs` como **switch maestro visible** —
  apagado no sale nada al cliente salvo alertas de seguridad de su cuenta; que hoy sea invisible es un
  agujero de consentimiento; (3) la card «Canales de notificación» de `/admin/profile` **se elimina**
  (las preferencias por usuario son S23 del documento del API, todavía sin contrato). Corrección del API:
  **`remaining_sessions` no requiere trabajo del front** (el correo lo renderiza el API en Blade desde el
  `client_pack`); el reenvío de verificación está agendado allá (`S9/T20`,
  `POST /auth/verify-email/resend` con rate limit) y el front no lo diseña a ciegas. Magic link: fuente
  visual = `design/login/02-magic-link-first.html` del repo del API (commit `b56db72`), con estado
  «revisa tu correo» y contador de reenvío de 30 s.

- **L4 (2026-11-13, diseño de la tarjeta de preferencias):** con el contrato cerrado se diseñaron tres
  direcciones en `design/preferencias-cliente/`: `01-maestro-y-canales.html` (maestro arriba y un grupo
  por canal: Email con los 4 flags, WhatsApp con los 2), `02-lista-plana-con-chips.html` (lista única de
  seis filas con el canal como chip) y `03-acordeon-por-canal.html` (acordeones con contador por canal,
  para diálogo angosto). Las tres implementan la semántica del maestro: apagado deshabilita los seis
  flags sin borrar su estado y la nota dice que los avisos de seguridad de la cuenta se envían igual.
  Copy nuevo propuesto para el 6º flag: «Recordatorio de reserva» / «Email 24 h y 30 min antes de la
  reserva.» (el de WhatsApp ya existía y su tooltip ya decía «WhatsApp programado 24 h y 30 min»).
  Ninguna toca la card de `/admin/profile`: su eliminación es T13.
