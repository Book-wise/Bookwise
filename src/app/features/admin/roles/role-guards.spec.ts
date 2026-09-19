import {
  ADMIN_GENERAL_ROLE,
  applyAdminGeneralInvariant,
  applyAdminGeneralSingleInvariant,
  isAdminGeneralLocked,
  isSingleSelectRoleLocked,
} from './role-guards';

describe('role-guards', () => {
  describe('ADMIN_GENERAL_ROLE', () => {
    it('is the unique admin role name', () => {
      expect(ADMIN_GENERAL_ROLE).toBe('admin_general');
    });
  });

  describe('isAdminGeneralLocked', () => {
    it('locks admin_general for the provider that holds it (cannot be removed)', () => {
      expect(isAdminGeneralLocked(['admin_general', 'staff'], 'admin_general')).toBe(true);
    });

    it('locks admin_general for a non-holder (cannot be assigned)', () => {
      expect(isAdminGeneralLocked(['staff'], 'admin_general')).toBe(true);
      expect(isAdminGeneralLocked([], 'admin_general')).toBe(true);
    });

    it('does not lock any other role', () => {
      expect(isAdminGeneralLocked(['admin_general'], 'staff')).toBe(false);
      expect(isAdminGeneralLocked(['staff'], 'staff_readonly')).toBe(false);
    });
  });

  describe('applyAdminGeneralInvariant', () => {
    it('keeps admin_general untouched when the holder keeps it selected', () => {
      const current = ['admin_general', 'staff'];
      const next = ['staff', 'admin_general'];
      expect(applyAdminGeneralInvariant(current, next)).toEqual(['staff', 'admin_general']);
    });

    it('re-adds admin_general when the holder attempts to remove it', () => {
      const current = ['admin_general', 'staff'];
      const next = ['staff'];
      expect(applyAdminGeneralInvariant(current, next)).toEqual(['staff', 'admin_general']);
    });

    it('drops admin_general when a non-holder attempts to take it', () => {
      const current = ['staff'];
      const next = ['staff', 'admin_general'];
      expect(applyAdminGeneralInvariant(current, next)).toEqual(['staff']);
    });

    it('leaves the set unchanged for a non-holder that never touches admin_general', () => {
      const current = ['staff'];
      const next = ['staff', 'staff_readonly'];
      expect(applyAdminGeneralInvariant(current, next)).toEqual(['staff', 'staff_readonly']);
    });

    it('returns a new array and never mutates its inputs', () => {
      const current = ['admin_general', 'staff'];
      const next = ['staff'];
      const result = applyAdminGeneralInvariant(current, next);

      expect(result).not.toBe(next);
      expect(next).toEqual(['staff']);
      expect(current).toEqual(['admin_general', 'staff']);
    });

    it('collapses duplicates when re-adding', () => {
      const current = ['admin_general'];
      const next = ['staff', 'staff'];
      expect(applyAdminGeneralInvariant(current, next)).toEqual(['staff', 'admin_general']);
    });
  });

  describe('isSingleSelectRoleLocked', () => {
    it('locks every other role for a holder of admin_general, but not admin_general itself', () => {
      expect(isSingleSelectRoleLocked(['admin_general'], 'admin_general')).toBe(false);
      expect(isSingleSelectRoleLocked(['admin_general'], 'staff')).toBe(true);
      expect(isSingleSelectRoleLocked(['admin_general', 'staff'], 'staff')).toBe(true);
    });

    it('locks only admin_general for a non-holder', () => {
      expect(isSingleSelectRoleLocked(['staff'], 'admin_general')).toBe(true);
      expect(isSingleSelectRoleLocked([], 'admin_general')).toBe(true);
      expect(isSingleSelectRoleLocked(['staff'], 'staff')).toBe(false);
      expect(isSingleSelectRoleLocked([], 'staff')).toBe(false);
    });
  });

  describe('applyAdminGeneralSingleInvariant', () => {
    it('forces a holder back to admin_general when it attempts to move away', () => {
      expect(applyAdminGeneralSingleInvariant(['admin_general'], 'staff')).toBe('admin_general');
    });

    it('keeps admin_general for a holder that keeps it', () => {
      expect(applyAdminGeneralSingleInvariant(['admin_general'], 'admin_general')).toBe(
        'admin_general',
      );
    });

    it('normalizes admin_general to null when a non-holder attempts to take it', () => {
      expect(applyAdminGeneralSingleInvariant(['staff'], 'admin_general')).toBeNull();
      expect(applyAdminGeneralSingleInvariant([], 'admin_general')).toBeNull();
    });

    it('keeps another role for a non-holder', () => {
      expect(applyAdminGeneralSingleInvariant(['staff'], 'staff_readonly')).toBe('staff_readonly');
    });

    it('keeps null for a provider with no roles', () => {
      expect(applyAdminGeneralSingleInvariant([], null)).toBeNull();
      expect(applyAdminGeneralSingleInvariant(['staff'], null)).toBeNull();
    });

    it('forces a holder with a null selection back to admin_general', () => {
      expect(applyAdminGeneralSingleInvariant(['admin_general'], null)).toBe('admin_general');
    });
  });
});
