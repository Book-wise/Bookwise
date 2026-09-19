/**
 * Single source-of-truth for business role metadata (color + icon).
 *
 * Keyed by role `slug` (see `Role.slug`: admin_general | admin_local |
 * recepcionista | recepcionista_readonly | staff | staff_readonly). Used by:
 *  - the Roles screen cards (/admin/roles), and
 *  - the Professionals list badges + role filter (/admin/providers)
 * so both stay visually consistent.
 *
 * Icons are Lucide identifiers (https://lucide.dev/icons), registered through
 * `ROLE_ICON_PROVIDERS`. They are deliberately distinct from the PrimeIcons
 * used elsewhere in the app (pi-building, pi-user, pi-users, pi-eye,
 * pi-id-card) so a role is never confused with a section of the product.
 */
export type RoleIcon =
  | 'crown'
  | 'store'
  | 'concierge-bell'
  | 'clipboard-list'
  | 'scissors'
  | 'scissors-line-dashed'
  | 'circle-question-mark';

export interface RoleMeta {
  color: string;
  icon: RoleIcon;
}

export const ROLE_META: Record<string, RoleMeta> = {
  admin_general: { color: '#0b3d95', icon: 'crown' },
  admin_local: { color: '#3b82f6', icon: 'store' },
  recepcionista: { color: '#22c55e', icon: 'concierge-bell' },
  recepcionista_readonly: { color: '#14b8a6', icon: 'clipboard-list' },
  staff: { color: '#f97316', icon: 'scissors' },
  staff_readonly: { color: '#eab308', icon: 'scissors-line-dashed' },
};

const FALLBACK: RoleMeta = { color: '#6b7280', icon: 'circle-question-mark' };

/** Resolve metadata for a role slug, falling back to gray + question mark. */
export function roleMeta(slug: string): RoleMeta {
  return ROLE_META[slug] ?? FALLBACK;
}

/**
 * Roles with direct attention duties ("rol de atención"). Only providers
 * holding one of these roles are selectable as providers in the admin
 * calendar. Shared so calendar and analogous consumers never duplicate the
 * definition.
 */
export const ATTENTION_ROLES: readonly string[] = ['staff', 'staff_readonly'];

/** True when at least one of `roles` is an attention role (staff / staff_readonly), matched by slug. */
export function hasAttentionRole(roles?: { slug: string }[] | null): boolean {
  return !!roles && roles.some((role) => ATTENTION_ROLES.includes(role.slug));
}
