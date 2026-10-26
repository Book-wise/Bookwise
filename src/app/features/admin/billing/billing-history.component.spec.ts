import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { BillingHistoryComponent } from './billing-history.component';

describe('BillingHistoryComponent — invoice history', () => {
  let router: { navigate: ReturnType<typeof vi.fn> };
  let component: BillingHistoryComponent;

  beforeEach(() => {
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      imports: [BillingHistoryComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: router },
      ],
    });

    component = TestBed.createComponent(BillingHistoryComponent).componentInstance;
  });

  it('exposes the mock invoice list', () => {
    expect(component.invoices.length).toBeGreaterThan(0);
    expect(component.invoices[0].id).toContain('INV-');
  });

  it('maps invoice status to i18n keys and chip classes', () => {
    expect(component.statusKey('paid')).toBe('billing.paid');
    expect(component.statusKey('pending')).toBe('billing.pending');
    expect(component.statusKey('failed')).toBe('billing.failed');

    expect(component.statusChipClass('paid')).toBe('bw-chip--success');
    expect(component.statusChipClass('pending')).toBe('bw-chip--warning');
    expect(component.statusChipClass('failed')).toBe('bw-chip--danger');
  });

  it('formats CLP amounts with the repo formatter', () => {
    expect(component.price(34990)).toContain('34.990');
  });

  it('navigates back to billing', () => {
    component.goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/admin/facturacion']);
  });
});
