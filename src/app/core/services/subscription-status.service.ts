import { Injectable, computed, signal } from '@angular/core';

/**
 * Session-level "account inactive" state.
 *
 * A 402 `subscription_inactive` on any request marks the account inactive
 * (see `auth.interceptor`); the global dialog reacts to `inactive`. The flag is
 * cleared when the user dismisses the dialog or navigates to reactivate.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionStatusService {
  private readonly _inactive = signal(false);

  readonly inactive = computed(() => this._inactive());

  markInactive(): void {
    this._inactive.set(true);
  }

  clear(): void {
    this._inactive.set(false);
  }
}
