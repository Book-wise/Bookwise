# Propuesta — Disponibilidad por profesional, permisos por rol y multi-tenant

> Consolidación de hallazgos y decisiones de la sesión 2026-09-04. Cambio **diferido**; se anota el alcance completo para correr un SDD después.

## Contexto / por qué

La "disponibilidad horaria de un profesional" hoy es una plantilla **mock** en el frontend; el backend no la persiste, no considera bloqueos al reservar, y no hay control por rol. Además el sistema escaló a multi-tenant (usuario tiene `tenant_id` y `business`), y el usuario tipo admin tiene el foco: falta definir roles operativos (recepcionista/staff) y unificar la identidad/branding (avatar del negocio en PDF/correo/menú).

## Alcance (lo que se hizo / debe consolidarse)

### 1) Frontend — ya implementado en esta sesión
- **Layout profesional (provider)** "dado de vida": sidebar (estilos del admin), dark-mode, tema, idioma, **menú de cuenta** reutilizable (`bw-account-menu`), logout asegurado, ruta `/provider/profile` (reutiliza `bw-profile` con negocio oculto).
- **Menú de cuenta** role-aware: provider → Mi perfil + Cerrar; admin → Mi perfil + **Negocio principal** (con nombre + RUT) + Roles + Cerrar. Cableado en el sidebar del **admin** (chip `AA Admin admin@kines`).
- **Mi Disponibilidad** (provider): editor semanal por día (alta rápida + copiar día), vista previa **Semanas | Meses | Rango** en una sola vista, navegación por semanas, marcador de hoy, bloqueos pintados con el **rayado del calendario**, reservas en secuencia, `AvailabilityStore` (fuente de verdad de la plantilla).
- **Colores de sucursal** unificados en `shared/utils/location-palette.util.ts` (`locationColor(id)`), consumido por lista de profesionales + dashboard.
- **PDF comprobante de venta** + **correo**: avatar del negocio (logo base64) + nombre + RUT; resolución del logo centralizada en `LogoService::dataUri`. ReceiptMail recibe tenant.

### 2) Backend — contrato propuesto (falta implementar)
- **Modelo**:
  - `provider_availability` (id, provider_id, location_id, day_of_week 0-6, start_time, end_time, is_active).
  - `provider_availability_overrides` (id, provider_id, location_id, date, start_time, end_time, is_active).
  - Regla overrides: si hay filas para una fecha → esa es la disponibilidad del día (ninguna activa = no disponible); si no → plantilla semanal del día de la semana.
- **Resolución** (cadena): plantilla ∩ overrides − reservas activas − bloqueos = **ventanas efectivas**.
- **Endpoints**:
  - `GET/PUT /api/v1/providers/{provider}/availability` (plantilla + overrides; PUT idempotente, transaccional).
  - `GET /api/v1/availability/{provider}?from&to` → ventanas efectivas por día (consolidado).
  - **Upgrade** `GET /api/v1/available_slots` y `GET /api/v1/agent/check-availability` para usar la plantilla/overrides + bloqueos.
  - **Precondición** en `POST /api/v1/bookings` (flujo humano): rechaza fuera de ventanas efectivas → `409 { conflict: { type: "out_of_availability" } }`. Mantener `booking` y `blocked_slot`.
- **Regla de pasado (por rol)**:
  - Agente (rol `agent`): disponibilidad **desde hoy** (clamp `from` a hoy; no revela pasado). SÍ lee **historial de reservas** (`GET /bookings/{id}`) para responder sobre reservas previas del cliente.
  - Usuarios de app (provider/admin/recepcionista/staff): pueden consultar pasado para revisión; **agendar en el pasado** siempre rechazado para todos.
- **Permisos / activo**:
  - Providers y locations se pueden **desactivar**. Antes de modificar info (incluido perfil) se valida activo.
  - Provider inactivo / location inactiva → no se agenda, no aparece para el agente ni staff; **el propio provider no modifica su info**. Admin/admin_local sí lo ven en su perfil.
  - Quién **cambia** disponibilidad: el propio provider, admin_local, admin_general. Quién **ve** (lectura): recepcionista, staff, y todos.
  - **Staff con permisos de escritura**: agenda **solo para sí mismo**.
- **Auditoría + notificación**:
  - Tabla `provider_availability_changes` (id, provider_id, location_id, user_id, change_type, field, old_value, new_value, created_at) + `GET /providers/{id}/availability/changes`.
  - Cuando un admin sobreescribe → **notificación/correo** al profesional (reutiliza canal de notificaciones/mailer).

### 3) Enfoque de resolución de disponibilidad
```
horario ubicación ∩ plantilla del provider ∩ overrides − reservas − bloqueos = ventanas efectivas
```

### 4) Agente conversacional ("Carlitox")
- Ojo con el **mailer Carlitox** (Mailgun, `PushNotificationToCarlitox`/`NotifyCarlitoxListener`) — es distinto del agente.
- Endpoints del agente ya existen: `GET /agent/check-availability`, clientes (search/rut), bookings/{id}, PATCH clients. Token rol `agent` con scopes `bookings:read|clients:read|clients:write|providers:read` (**no `bookings:write`** → reserva la confirma cliente/humano).
- El agente: consulta disponibilidad (desde hoy), presenta, y la reserva la confirma alguien. Puede responder por reservas previas (historial).
- Doc existente: `docs/carlitox-agent-endpoints.md`.

### 5) Multi-tenant / negocio
- `Business` con `logo_url`, `name`, `rut`... Se muestra el **negocio principal** en menú de cuenta (admin) + sección "Información del negocio" de **Mi perfil**.
- **Seeds** para todos los perfiles: `admin_general`, `admin_local`, `recepcionista`, `recepcionista_readonly`, `staff`, `staff_readonly`, `provider`. Un **segundo tenant** para visualizar multi-tenant.

## Alcance del SDD diferido (cuando corra)
Modelo `provider_availability` + overrides + `provider_availability_changes`; endpoints + perfiles; upgrade `available_slots`/`check-availability`/`POST /bookings`; guardas/políticas por rol (quién cambia vs ve, activo, staff self-only); evento de notificación + vista de historial por rol; seeds multi-perfil + segundo tenant; front conecta `AvailabilityStore` al endpoint real, filtro "desde hoy" (agente) vs revisión (roles), y vista de historial.

## Fuera de alcance (ahora)
- Backend aún no implementa todo lo anterior (es la parte que se le pide al backend con el prompt v2).

## Criterios de éxito (para el futuro SDD)
- Crear reserva solo si el slot está dentro de las ventanas efectivas del provider; rechazo `out_of_availability`.
- Agente nunca ve disponibilidad pasada; sí responde por reservas previas.
- Un provider inactivo no es agendable ni aparece (salvo admin); el propio provider no modifica su info si está inactivo.
- Cambios de disponibilidad quedan auditados y notifican al profesional.
- Todos los perfiles tienen seed y se visualiza un segundo tenant.
