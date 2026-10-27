/**
 * Catálogo de abilities — permission keys del backend (matriz editable).
 *
 * Única fuente de verdad de los strings consumidos por `AuthService` para
 * gatear la UI por capacidad, NO por rol técnico. Los valores coinciden
 * EXACTOS con el catálogo `RolePermissionService::CATALOG` del backend
 * (dot-notated: `bookings.view`, `locations.manage`, ...). Cero magic strings:
 * los componentes y el menú referencian `ABILITIES.x`, nunca el literal.
 *
 * NOTA: `permissions` (la lista efectiva del tenant activo que expone
 * `/auth/me`) es el SOURCE OF TRUTH para ocultar/deshabilitar UI; `abilities`
 * (scopes del token, con `:`) es otra cosa y no debe usarse para RBAC fino.
 */
export const ABILITIES = {
  bookingsView: 'bookings.view',
  bookingsCreate: 'bookings.create',
  bookingsConfirm: 'bookings.confirm',
  bookingsCancel: 'bookings.cancel',
  bookingsUpdate: 'bookings.update',

  clientsView: 'clients.view',
  clientsCreate: 'clients.create',
  clientsUpdate: 'clients.update',

  providersView: 'providers.view',
  providersManage: 'providers.manage',
  /**
   * Reasignar roles de un profesional. Key propia del backend (`min_level` 80):
   * `admin_location` la tiene por baseline y PUEDE reasignar en su sucursal,
   * pero NO puede delegarla. No confundir con `providers.manage` (crear/editar).
   */
  providersRoles: 'providers.roles',

  settingsView: 'settings.view',
  settingsUpdate: 'settings.update',

  rolesView: 'roles.view',
  rolesManage: 'roles.manage',

  salesView: 'sales.view',
  salesManage: 'sales.manage',

  notificationsView: 'notifications.view',
  notificationsAck: 'notifications.ack',

  blockedSlotsView: 'blocked_slots.view',
  blockedSlotsManage: 'blocked_slots.manage',

  packSessionsManage: 'pack_sessions.manage',

  clientPacksView: 'client_packs.view',
  clientPacksManage: 'client_packs.manage',

  locationsView: 'locations.view',
  locationsManage: 'locations.manage',
} as const;

/** Todos los permission keys del catálogo (para diagnósticos o defaults). */
export const ALL_ABILITIES: readonly string[] = Object.values(ABILITIES);
