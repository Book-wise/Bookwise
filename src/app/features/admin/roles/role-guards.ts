/**
 * Shared business rules for the `admin_general` role.
 *
 * `admin_general` is unique: it cannot be removed from the provider that holds
 * it, and it cannot be assigned to any other provider. These pure helpers keep
 * that rule in one place so the Roles screen and the provider dialog cannot
 * drift apart. No Angular dependencies.
 */

/** The unique admin role name (see `Role.name`). */
export const ADMIN_GENERAL_ROLE = 'admin_general';

/**
 * True when the role `name` cannot be toggled by the UI for a provider whose
 * current roles are `current`.
 *
 * The `admin_general` option is always locked: the holder cannot remove it and
 * non-holders cannot be assigned it. `current` is part of the API so callers
 * express the holder/non-holder state explicitly — the lock reason (and its
 * tooltip copy) differs, and {@link applyAdminGeneralInvariant} enforces each
 * branch.
 */
export function isAdminGeneralLocked(current: string[], name: string): boolean {
  return name === ADMIN_GENERAL_ROLE;
}

/**
 * Enforce the `admin_general` uniqueness invariant on a proposed role set.
 *
 * - If the provider currently holds `admin_general` and `next` attempts to
 *   remove it, the role is re-added (removal is never allowed).
 * - If the provider does not hold it and `next` attempts to add it, the role
 *   is dropped (assignment to a non-holder is never allowed).
 *
 * Returns a new array; `next` is never mutated. Duplicates are collapsed.
 */
export function applyAdminGeneralInvariant(current: string[], next: string[]): string[] {
  const holdsGeneral = current.includes(ADMIN_GENERAL_ROLE);
  const wantsGeneral = next.includes(ADMIN_GENERAL_ROLE);

  let result: string[];
  if (holdsGeneral && !wantsGeneral) {
    result = [...next, ADMIN_GENERAL_ROLE];
  } else if (!holdsGeneral && wantsGeneral) {
    result = next.filter((name) => name !== ADMIN_GENERAL_ROLE);
  } else {
    result = [...next];
  }
  return [...new Set(result)];
}
