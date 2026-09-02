/**
 * Single source-of-truth for business role metadata (color + icon).
 *
 * Keyed by role `name` (see `Role.name`: admin_general | admin_local |
 * recepcionista | recepcionista_readonly | staff | staff_readonly). Used by:
 *  - the Roles screen cards (/admin/roles), and
 *  - the Professionals list badges + role filter (/admin/providers)
 * so both stay visually consistent.
 */
export interface RoleMeta {
  color: string;
  icon: string;
}

export const ROLE_META: Record<string, RoleMeta> = {
  admin_general: { color: '#0b3d95', icon: 'pi-shield' },
  admin_local: { color: '#3b82f6', icon: 'pi-building' },
  recepcionista: { color: '#22c55e', icon: 'pi-user' },
  recepcionista_readonly: { color: '#14b8a6', icon: 'pi-eye' },
  staff: { color: '#f97316', icon: 'pi-users' },
  staff_readonly: { color: '#eab308', icon: 'pi-id-card' },
};

const FALLBACK: RoleMeta = { color: '#6b7280', icon: 'pi-user' };

/** Resolve metadata for a role name, falling back to gray + pi-user. */
export function roleMeta(name: string): RoleMeta {
  return ROLE_META[name] ?? FALLBACK;
}

/**
 * Roles with direct attention duties ("rol de atención"). Only providers
 * holding one of these roles are selectable as providers in the admin
 * calendar. Shared so calendar and analogous consumers never duplicate the
 * definition.
 */
export const ATTENTION_ROLES: readonly string[] = ['staff', 'staff_readonly'];

/** True when at least one of `roles` is an attention role (staff / staff_readonly). */
export function hasAttentionRole(roles?: { name: string }[] | null): boolean {
  return !!roles && roles.some((role) => ATTENTION_ROLES.includes(role.name));
}
