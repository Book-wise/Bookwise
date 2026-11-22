import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PaymentMethodCardComponent } from './payment-method-card.component';
import { PaymentsApiService } from '@services/api/payments-api.service';
import { PaymentMethodInfo } from '@models';

const activeMethod: PaymentMethodInfo = {
  id: 7,
  provider: 'transbank_oneclick_mall',
  is_default: true,
  status: 'active',
  created_at: '2026-02-12T10:00:00.000000Z',
};

describe('PaymentMethodCardComponent — medio de pago (P1 Transbank)', () => {
  let paymentsApi: {
    getMethods: ReturnType<typeof vi.fn>;
    startEnrollment: ReturnType<typeof vi.fn>;
    removeMethod: ReturnType<typeof vi.fn>;
  };
  let confirmationService: { confirm: ReturnType<typeof vi.fn> };
  let messageService: { add: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<ReturnType<typeof TestBed.createComponent<PaymentMethodCardComponent>>> {
    TestBed.overrideProvider(ConfirmationService, { useValue: confirmationService });
    TestBed.overrideProvider(MessageService, { useValue: messageService });
    await TestBed.configureTestingModule({
      imports: [PaymentMethodCardComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: PaymentsApiService, useValue: paymentsApi },
      ],
    }).compileComponents();
    return TestBed.createComponent(PaymentMethodCardComponent);
  }

  /** Avanza la carga inicial del componente y devuelve la instancia. */
  function load(fixture: { componentInstance: PaymentMethodCardComponent; detectChanges(): void }): PaymentMethodCardComponent {
    const component = fixture.componentInstance;
    fixture.detectChanges();
    return component;
  }

  beforeEach(() => {
    paymentsApi = {
      getMethods: vi.fn(() => of({ data: [] })),
      startEnrollment: vi.fn(),
      removeMethod: vi.fn(),
    };
    confirmationService = { confirm: vi.fn() };
    messageService = { add: vi.fn() };
  });

  it('shows the "Add card" CTA when the account has no active method', async () => {
    paymentsApi.getMethods.mockReturnValue(of({ data: [] }));
    const fixture = await createComponent();
    const component = load(fixture);

    expect(component.vm().loading).toBe(false);
    expect(component.vm().method).toBeNull();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="enroll-cta"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="payment-method-row"]')).toBeNull();
  });

  it('shows the enrolled method (provider/default/created) without any card data', async () => {
    paymentsApi.getMethods.mockReturnValue(of({ data: [activeMethod] }));
    const fixture = await createComponent();
    const component = load(fixture);

    expect(component.vm().method).toEqual(activeMethod);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="payment-method-row"]')).toBeTruthy();
    // El proveedor se muestra traducido a label humano, no crudo.
    expect(el.textContent).toContain('Webpay OneClick');
    // S6: el recurso no expone datos de tarjeta (sin card_number ni tipo).
    expect(el.textContent).not.toMatch(/\*{4}|6623|Visa/i);
    expect(el.querySelector('[data-testid="enroll-cta"]')).toBeNull();
  });

  it('ignores disabled methods when picking the displayed card', async () => {
    const disabled: PaymentMethodInfo = { ...activeMethod, id: 8, status: 'disabled' };
    paymentsApi.getMethods.mockReturnValue(of({ data: [disabled] }));
    const fixture = await createComponent();
    const component = load(fixture);

    expect(component.vm().method).toBeNull();
  });

  it('redirects the browser to the backend redirect_url on enrollment start', async () => {
    paymentsApi.startEnrollment.mockReturnValue(
      of({ message: 'Redirigí…', data: { redirect_url: 'https://webpay3gint.transbank.cl/webpayserver/bp_multicode_inscription.cgi?TBK_TOKEN=abc' } }),
    );
    const fixture = await createComponent();
    const component = load(fixture);

    const redirectTo = vi.spyOn(component, 'redirectTo').mockImplementation(() => undefined);
    component.enroll();

    expect(paymentsApi.startEnrollment).toHaveBeenCalledTimes(1);
    expect(redirectTo).toHaveBeenCalledWith('https://webpay3gint.transbank.cl/webpayserver/bp_multicode_inscription.cgi?TBK_TOKEN=abc');
  });

  it('maps the 409 already-enrolled conflict to a hint instead of a crash', async () => {
    paymentsApi.startEnrollment.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 409,
        error: { error: 'payment_method_already_enrolled', detail: 'La cuenta ya tiene una tarjeta inscripta.' },
      })),
    );
    const fixture = await createComponent();
    const component = load(fixture);

    component.enroll();

    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn' }),
    );
    // Refresca: si el conflicto dice "ya hay tarjeta", la lista puede haber cambiado.
    await fixture.whenStable();
    expect(paymentsApi.getMethods).toHaveBeenCalledTimes(2); // carga inicial + retry tras el conflicto
  });

  it('surfaces provider unavailability (503) as an error toast and stays on the page', async () => {
    paymentsApi.startEnrollment.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 503,
        error: { error: 'payment_provider_unavailable', detail: 'El medio de pago no está disponible en este momento.' },
      })),
    );
    const fixture = await createComponent();
    const component = load(fixture);

    const redirectTo = vi.spyOn(component, 'redirectTo').mockImplementation(() => undefined);
    component.enroll();

    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' }),
    );
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('removes the method after an explicit confirmation dialog', async () => {
    paymentsApi.getMethods.mockReturnValue(of({ data: [activeMethod] }));
    paymentsApi.removeMethod.mockReturnValue(of({ message: 'Tu medio de pago fue eliminado.' }));
    const fixture = await createComponent();
    const component = load(fixture);

    component.confirmRemove();

    expect(confirmationService.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ header: expect.any(String) }),
    );
    const accept = confirmationService.confirm.mock.calls[0][0].accept as () => void;
    accept();

    expect(paymentsApi.removeMethod).toHaveBeenCalledWith(7);
    // Refresca la lista tras la baja (S7: vuelve al estado "sin tarjeta").
    await fixture.whenStable();
    expect(paymentsApi.getMethods).toHaveBeenCalledTimes(2);
  });

  it('does not call the API when the user cancels removal', async () => {
    paymentsApi.getMethods.mockReturnValue(of({ data: [activeMethod] }));
    const fixture = await createComponent();
    const component = load(fixture);

    component.confirmRemove();

    const rejects = confirmationService.confirm.mock.calls[0][0].reject as (() => void) | undefined;
    rejects?.();

    expect(paymentsApi.removeMethod).not.toHaveBeenCalled();
  });
});
