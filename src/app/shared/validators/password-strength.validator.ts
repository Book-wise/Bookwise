/**
 * Password strength checkpoints.
 *
 * Rules deliberately follow the auth contract (min 8) plus a light strength
 * policy so the new password is not trivially weak. A special character is NOT
 * required (avoids over-constraining clinic staff); length + case + digit is
 * enough to reject obvious weak passwords.
 */
export interface PasswordStrengthCheck {
  key: 'length' | 'uppercase' | 'lowercase' | 'number';
  met: boolean;
}

export function checkPasswordStrength(password: string): PasswordStrengthCheck[] {
  return [
    { key: 'length', met: password.length >= 8 },
    { key: 'uppercase', met: /[A-ZÁÉÍÓÚÜÑ]/.test(password) },
    { key: 'lowercase', met: /[a-záéíóúüñ]/.test(password) },
    { key: 'number', met: /\d/.test(password) },
  ];
}

/** True when every strength checkpoint is met. */
export function isPasswordStrong(password: string): boolean {
  return checkPasswordStrength(password).every((c) => c.met);
}
