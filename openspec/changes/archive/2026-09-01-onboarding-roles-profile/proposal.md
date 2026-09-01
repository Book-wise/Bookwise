# Change: onboarding-roles-profile

> Estado: EN PROGRESO. Contrato BE CONFIRMADO (2026-09-01). Implementación del frontend.

## Intent

Completar el flujo de registro → verificación de email → onboarding de negocio → perfil → gestión de roles,
siguiendo el contrato confirmado por el BE. El usuario admin_general (el que crea el negocio) puede luego
crear y asignar profesionales/usuarios con roles de negocio.

## Contrato BE (fuente de verdad — confirmado)

### Registro y verificación
- `POST /auth/register` → 201 `{ data: { user }, message }` SIN token (ya implementado).
- `PATCH /auth/verify-email` (público) `{ token }` → `{ data: { email_verified_at } }`.
### Sesión y perfil
- `POST /auth/login` → `{ token, user }` (403/409 si email sin verificar).
- `GET /auth/me` (Bearer) → `{ id, name, email, phone, role, tenant_id, email_verified_at, onboarding_complete, business }`.
### Onboarding del negocio
- `GET /businesses` (Bearer, email verificado) → `{ data: Business | null }`.
- `POST /businesses` (Bearer) `{ name, rut, email, address, phone, plan }` → `{ data: { business }, user }`.
### Roles
- `GET /roles` (Bearer) → lista de roles de negocio.
- `PATCH /providers/{id}/roles` `{ roles: [...] }` → reemplaza roles.

### Reglas
- `business.rut` / `business.email` = INMUTABLES → read-only con warning.
- Roles de negocio NO reemplazan `users.role` (capa separada).
- "pending" se deriva de `email_verified_at = null` + `business = null` (usar `onboarding_complete`).
- Front SIEMPRE valida antes de mandar (RUT chileno, email, phone, required).

## Vista de perfil (a implementar)

```
┌─ Mi perfil ───────────────────────────────────────────────────┐
│  [avatar] Admin General · "Encargado de configurar la cuenta" │
├────────────────────────────┬─────────────────────────────────┤
│  INFORMACIÓN PERSONAL       │  FIRMA (opcional)               │
│   Nombres [____]            │  [subir/dibujar]                │
│   Apellidos [____]          │  [toggle] Usar PIN para firmar  │
│   Email [____] (editable)   │  RUT/DNI [xxx] ← readonly      │
│  CAMBIAR CONTRASEÑA         │  Código colegiatura [____]      │
│   [actual][nueva][repetir]  │                                 │
└────────────────────────────┴─────────────────────────────────┘
```

## Alcance (in)
1. **Vista de verificación de email** (`/verificar-email` o similar), callback del token.
2. **Onboarding de negocio** → formulario (nombre, RUT, email, dirección, teléfono, plan) → `POST /businesses`.
3. **Vista de perfil** → `GET /auth/me` (datos personales editables + business read-only con warning).
4. **Gestión de roles** → `GET /roles` + asignación vía `PATCH /providers/{id}/roles` (admin_general).
5. **Servicios API**: extend `AuthApiService` (verify-email, /auth/me) + nuevo `BusinessesApiService` + `RolesApiService` (o en un service).
6. **Modelos**: `Business`, `AuthMeResponse`, `Role`, types.
7. **Enrutamiento**: redirección post-login según `onboarding_complete`.

## Scope (out)
- NO tocar `users.role` / RBAC existente (`UserRole = 'admin'|'provider'`).
- NO implementar backend.
- NO implementar multi-negocio (fase 2).

## Archivos probables
- `src/app/features/auth/verify-email/` (nuevo)
- `src/app/features/admin/onboarding/` o una vista de onboarding
- `src/app/features/admin/profile/profile.component.{ts,html,scss}` (nuevo)
- `src/app/features/admin/roles/` (gestión)
- `src/app/core/services/api/auth-api.service.ts` (extender)
- `src/app/core/services/api/businesses-api.service.ts` (nuevo)
- `src/app/core/models/index.ts` (Business, AuthMe, Role)
- `src/app/app.routes.ts` (rutas nuevas + redirección)
- i18n es.ts/en.ts
