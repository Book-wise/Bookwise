import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { PaymentTabComponent } from './payment-tab.component';
import { SalesApiService } from '@services/api/sales-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { MessageService } from 'primeng/api';
import type { Booking, Sale } from '@models';

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 42,
    total: 15000,
    paid_amount: 15000,
    remaining_amount: 0,
    payment_status: 'paid',
    transactions: [],
    client: { id: 1, first_name: 'Ana', last_name: 'González', email: 'ana@test.com' },
    ...overrides,
  } as Sale;
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 1,
    start_time: '2026-08-24T10:00:00',
    end_time: '2026-08-24T11:00:00',
    status_id: 2,
    price: 15000,
    payment: { id: 42, total_amount: 15000, paid_amount: 15000, remaining_amount: 0, status: 'paid' },
    ...overrides,
  } as Booking;
}

describe('PaymentTabComponent', () => {
  let component: PaymentTabComponent;
  let fixture: ComponentFixture<PaymentTabComponent>;
  let salesApi: {
    getSale: ReturnType<typeof vi.fn>;
    sendReceipt: ReturnType<typeof vi.fn>;
    createSale: ReturnType<typeof vi.fn>;
    createTransaction: ReturnType<typeof vi.fn>;
  };
  let messageService: { add: ReturnType<typeof vi.fn> };
  let httpError: { handle: ReturnType<typeof vi.fn> };
  let popover: { show: ReturnType<typeof vi.fn>; hide: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    salesApi = {
      getSale: vi.fn().mockReturnValue(of({ data: makeSale() })),
      sendReceipt: vi.fn().mockReturnValue(of({ message: 'Comprobante enviado' })),
      createSale: vi.fn(),
      createTransaction: vi.fn(),
    };
    messageService = { add: vi.fn() };
    httpError = { handle: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PaymentTabComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SalesApiService, useValue: salesApi },
        { provide: HttpErrorService, useValue: httpError },
        { provide: MessageService, useValue: messageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentTabComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('booking', makeBooking());
    fixture.detectChanges();

    // PrimeNG Popover is not rendered in a unit test, so stub the @ViewChild
    // targets after the first change detection (which resolves the queries).
    popover = { show: vi.fn(), hide: vi.fn() };
    component.sendReceiptPopover = popover as any;
    component.saleMenuBtn = { nativeElement: document.createElement('button') } as any;
  });

  describe('openSendReceipt', () => {
    it('pre-fills receiptEmail with the sale client_email and shows the popover', () => {
      component.openSendReceipt();

      expect(component.receiptEmail()).toBe('ana@test.com');
      expect(popover.show).toHaveBeenCalled();
    });
  });

  describe('submitSendReceipt', () => {
    it('sends a trimmed email, hides the popover and shows a success toast', () => {
      component.receiptEmail.set('  ana@test.com  ');

      component.submitSendReceipt(42);

      expect(salesApi.sendReceipt).toHaveBeenCalledWith(42, { email: 'ana@test.com' });
      expect(popover.hide).toHaveBeenCalled();
      expect(messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', key: 'global' }),
      );
    });

    it('does not send the receipt when the email is whitespace-only', () => {
      component.receiptEmail.set('   ');

      component.submitSendReceipt(42);

      expect(salesApi.sendReceipt).not.toHaveBeenCalled();
    });
  });
});
