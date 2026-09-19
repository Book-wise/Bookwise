import { HttpErrorResponse } from '@angular/common/http';
import { isOnboardingRequired } from './http-error.service';

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
