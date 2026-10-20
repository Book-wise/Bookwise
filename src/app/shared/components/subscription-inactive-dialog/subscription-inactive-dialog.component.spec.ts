import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SubscriptionInactiveDialogComponent } from './subscription-inactive-dialog.component';
import { SubscriptionStatusService } from '@services/subscription-status.service';
import { AuthService } from '@services/auth.service';

describe('SubscriptionInactiveDialogComponent', () => {
  let status: {
    inactive: ReturnType<typeof signal<boolean>>;
    clear: ReturnType<typeof vi.fn>;
    markInactive: ReturnType<typeof vi.fn>;
  };
  let auth: { isAdminGeneral: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let component: SubscriptionInactiveDialogComponent;

  beforeEach(async () => {
    status = { inactive: signal(false), clear: vi.fn(), markInactive: vi.fn() };
    auth = { isAdminGeneral: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SubscriptionInactiveDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SubscriptionStatusService, useValue: status },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    component = TestBed.createComponent(SubscriptionInactiveDialogComponent).componentInstance;
  });

  it('isOwner is true when the account has the admin_general business role', () => {
    auth.isAdminGeneral.mockReturnValue(true);
    expect(component.isOwner()).toBe(true);
  });

  it('isOwner is false for a non-owner', () => {
    auth.isAdminGeneral.mockReturnValue(false);
    expect(component.isOwner()).toBe(false);
  });

  it('reactivate() clears the status and navigates to billing', () => {
    component.reactivate();

    expect(status.clear).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/facturacion']);
  });

  it('dismiss() clears the status without navigating', () => {
    component.dismiss();

    expect(status.clear).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
