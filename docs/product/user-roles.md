# Roles De Usuario

## Admin

Confirmado por rutas:

- Acceso a `/admin`.
- Subrutas: dashboard, locations, providers, calendar, clients y packs.
- Layout con sidebar, dark mode, selector de tema, selector de idioma y logout.

Fuentes:

- `src/app/app.routes.ts`
- `src/app/layouts/admin-layout/admin-layout.component.ts`

## Provider

Confirmado por rutas:

- Acceso a `/provider`.
- Subrutas: agenda propia y availability.
- Layout con menubar, selector de idioma y logout.
- Calendario bloqueado al `provider_id` y primera `location_id` del usuario autenticado.

Fuentes:

- `src/app/app.routes.ts`
- `src/app/layouts/provider-layout/provider-layout.component.ts`
- `src/app/features/provider/calendar/provider-calendar.component.ts`

## Desconocido o no verificable

No hay roles de cliente final en las rutas actuales. El README menciona que clientes pueden crear reservas con perfil, pero el codigo revisado solo expone rutas de login, register, admin y provider.

