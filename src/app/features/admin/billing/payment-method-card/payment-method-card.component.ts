import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { concat, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, switchMap } from 'rxjs/operators';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PaymentsApiService } from '@services/api/payments-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { PaymentMethodInfo } from '@models';

interface PaymentMethodVm {
  loading: boolean;
  /** Tarjeta activa de la cuenta (S6: sin datos de tarjeta en el recurso). */
  method: PaymentMethodInfo | null;
}

/**
 * Medio de pago de la cuenta (P1 Transbank Oneclick Mall, S6/S7/S9 de
 * odd/tasks/transbank-integration.md).
 *
 * Sin tarjeta: CTA que arranca la inscripción; con tarjeta: estado + baja con
 * confirmación. El recurso del backend no expone datos de tarjeta
 * ("No full card data stored"), así que la UI nunca los muestra.
 */
@Component({
  selector: 'bw-payment-method-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CardModule, ButtonModule, SkeletonModule],
  templateUrl: './payment-method-card.component.html',
  styleUrls: ['./payment-method-card.component.scss'],
  providers: [ConfirmationService],
})
export class PaymentMethodCardComponent {
  private readonly api = inject(PaymentsApiService);
  private readonly httpError = inject(HttpErrorService);
  private readonly confirmationService = inject(ConfirmationService);
  readonly lang = inject(LanguageService);
  private readonly messages = inject(MessageService);

  private readonly refresh = signal(0);

  readonly vm = toSignal(
    toObservable(this.refresh).pipe(
      switchMap(() =>
        concat(
          of<PaymentMethodVm>({ loading: true, method: null }),
          this.api.getMethods().pipe(
            map(({ data }): PaymentMethodVm => ({
              loading: false,
              method: data.find((m) => m.status === 'active') ?? null,
            })),
            catchError((err) => {
              this.httpError.handle(err, this.lang.t('billing.payment_method.title'));
              return of<PaymentMethodVm>({ loading: false, method: null });
            }),
          ),
        ),
      ),
    ),
    { initialValue: { loading: true, method: null } as PaymentMethodVm },
  );

  readonly enrolling = signal(false);

  /** Post-condition de S12: navegación directa — el BE entrega la URL con TBK_TOKEN embebido. */
  redirectTo(url: string): void {
    window.location.href = url;
  }

  /** POST /payment-methods/enroll y navegación al formulario Webpay. */
  enroll(): void {
    if (this.enrolling()) return;
    this.enrolling.set(true);

    this.api.startEnrollment().subscribe({
      next: ({ data }) => {
        this.enrolling.set(false);
        this.redirectTo(data.redirect_url);
      },
      error: (err: HttpErrorResponse) => {
        this.enrolling.set(false);
        const code = (err.error?.error ?? '') as string;

        // S9: conflictos de inscripción.
        if (code === 'payment_enrollment_in_progress' || code === 'payment_method_already_enrolled') {
          this.messages.add({
            severity: 'warn',
            summary: this.lang.t('billing.payment_method.conflict_title'),
            detail: this.lang.t('billing.payment_method.conflict_detail'),
            key: 'global',
            life: 5000,
          });
          // El estado puede haber cambiado (p. ej. tarjeta ya inscripta en otra pestaña).
          this.refresh.update((n) => n + 1);
          return;
        }

        if (code === 'payment_provider_unavailable' || code === 'payment_provider_error') {
          this.messages.add({
            severity: 'error',
            summary: this.lang.t('billing.payment_method.provider_title'),
            detail: this.lang.t('billing.payment_method.provider_detail'),
            key: 'global',
            life: 5000,
          });
          return;
        }

        this.httpError.handle(err, this.lang.t('billing.payment_method.title'));
      },
    });
  }

  /** Eliminar tarjeta: siempre con confirmación explícita (acción con efecto en el proveedor). */
  confirmRemove(): void {
    this.confirmationService.confirm({
      header: this.lang.t('billing.payment_method.remove_title'),
      message: this.lang.t('billing.payment_method.remove_message'),
      icon: 'pi pi-credit-card',
      acceptLabel: this.lang.t('billing.payment_method.remove_accept'),
      rejectLabel: this.lang.t('billing.payment_method.remove_reject'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-outlined',
      accept: () => this.remove(),
    });
  }

  private remove(): void {
    const method = this.vm().method;
    if (!method) return;

    this.api.removeMethod(method.id).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary: this.lang.t('billing.payment_method.removed_title'),
          detail: this.lang.t('billing.payment_method.removed_detail'),
          key: 'global',
          life: 4000,
        });
        this.refresh.update((n) => n + 1);
      },
      error: (err: HttpErrorResponse) => {
        this.httpError.handle(err, this.lang.t('billing.payment_method.title'));
      },
    });
  }

  /** Label humano del proveedor (hoy: transbank OneClick Mall). */
  providerLabel(provider: string): string {
    if (provider === 'transbank_oneclick_mall') return 'Webpay OneClick';
    return provider;
  }

  /** Fecha de registro formateada según el idioma (sin pipes en el template). */
  sinceLabel(isoDate: string): string {
    const locale = this.lang.lang() === 'en' ? 'en-US' : 'es-CL';
    const formatted = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
      .format(new Date(isoDate));
    return this.lang.t('billing.payment_method.since', { date: formatted });
  }
}
