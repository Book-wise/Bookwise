import { HttpErrorResponse } from '@angular/common/http';
import { isOnboardingRequired, isCapacityLimitError } from './http-error.service';

/** Builds an HttpErrorResponse with the given status and body. */
function apiError(status: number, error: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('isOnboardingRequired', () => {
  it('is true for 409 with an onboarding_required body', () => {
    expect(isOnboardingRequired(apiError(409, { error: 'onboarding_required' }))).toBe(true);
  });

  it('is false for 409 with a different business error', () => {
    expect(isOnboardingRequired(apiError(409, { error: 'conflict' }))).toBe(false);
  });

  it('is false for 409 with an empty body', () => {
    expect(isOnboardingRequired(apiError(409, null))).toBe(false);
  });

  it('is false when the same body arrives with a non-409 status', () => {
    expect(isOnboardingRequired(apiError(422, { error: 'onboarding_required' }))).toBe(false);
  });

  it('is false for a network error (status 0)', () => {
    expect(isOnboardingRequired(apiError(0, { error: 'onboarding_required' }))).toBe(false);
  });

  it('is false for a 500 with no business error', () => {
    expect(isOnboardingRequired(apiError(500, { message: 'Server Error' }))).toBe(false);
  });
});

describe('isCapacityLimitError', () => {
  it('is true for 403 account_tenant_limit_reached', () => {
    expect(isCapacityLimitError(apiError(403, { error: 'account_tenant_limit_reached', limit: 3, current: 3 }))).toBe(true);
  });

  it('is true for 403 tenant_professional_limit_reached', () => {
    expect(isCapacityLimitError(apiError(403, { error: 'tenant_professional_limit_reached', limit: 5, current: 5 }))).toBe(true);
  });

  it('is true for 403 tenant_location_limit_reached', () => {
    // Crear sucursal devuelve este código; sin cubrirlo, el CTA de upgrade de
    // `location-dialog` era código muerto y el 403 caía como toast genérico.
    expect(isCapacityLimitError(apiError(403, { error: 'tenant_location_limit_reached', limit: 2, current: 2 }))).toBe(true);
  });

  it('is false for 403 with a different business error', () => {
    expect(isCapacityLimitError(apiError(403, { error: 'forbidden' }))).toBe(false);
  });

  it('is false when the same body arrives with a non-403 status', () => {
    expect(isCapacityLimitError(apiError(422, { error: 'account_tenant_limit_reached' }))).toBe(false);
  });
});
