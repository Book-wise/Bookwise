import { ATTENTION_ROLES, hasAttentionRole, roleMeta } from './role-meta';

describe('role-meta', () => {
  describe('roleMeta', () => {
    it('resolves color/icon metadata by slug', () => {
      expect(roleMeta('staff').icon).toBe('users');
      expect(roleMeta('staff_readonly').icon).toBe('user-round');
      expect(roleMeta('admin_general').icon).toBe('crown');
    });

    it('falls back to gray + question mark for an unknown slug', () => {
      expect(roleMeta('unknown_slug')).toEqual({
        color: '#6b7280',
        icon: 'circle-question-mark',
      });
    });
  });

  describe('hasAttentionRole', () => {
    it('exposes the attention slugs as staff / staff_readonly', () => {
      expect([...ATTENTION_ROLES]).toEqual(['staff', 'staff_readonly']);
    });

    it('matches a provider holding staff by slug', () => {
      expect(hasAttentionRole([{ slug: 'staff' }])).toBe(true);
    });

    it('matches a provider holding staff_readonly by slug', () => {
      expect(hasAttentionRole([{ slug: 'staff_readonly' }])).toBe(true);
    });

    it('rejects a provider whose only role is recepcionista', () => {
      expect(hasAttentionRole([{ slug: 'recepcionista' }])).toBe(false);
    });

    it('is false for empty, null or undefined role lists', () => {
      expect(hasAttentionRole([])).toBe(false);
      expect(hasAttentionRole(null)).toBe(false);
      expect(hasAttentionRole(undefined)).toBe(false);
    });
  });
});
