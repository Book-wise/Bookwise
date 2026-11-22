import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '@services/auth.service';
import { PaymentsApiService } from '@services/api/payments-api.service';
import { LanguageService } from '@services/language.service';

/**
 * Estado final de la página. `decode` es lo que la query `?status=`
 * reclama; la reconciliación (verify) decide el estado mostrado contra
 * la verdad del backend — la URL por sí sola no puede mentir.
 */
type EnrollmentKind = 'success' | 'error' | 'processing' | 'unconfirmed' | 'neutral';

interface EnrollmentResultVm {
  kind: EnrollmentKind;
  reason: string | null;
}

/** i18n key del mensaje por cada `reason` documentado (S5); fallback genérico. */
const KEY_BY_REASON: Record<string, string> = {
  payment_enrollment_cancelled: 'payment.enrollment.reason.cancelled',
  payment_enrollment_missing_token: 'payment.enrollment.reason.missing_token',
  payment_enrollment_failed: 'payment.enrollment.reason.failed',
  payment_enrollment_rejected: 'payment.enrollment.reason.rejected',
  payment_enrollment_expired: 'payment.enrollment.reason.expired',
};

/**
 * Resultado de la inscripción del medio de pago (P1 Transbank Oneclick Mall).
 *
 * Visual spec: design/pago-resultado-inscripcion/04-split-con-contexto.html
 * (desktop: panel lateral de marca; ≤900px: franja, según 05-mobile.html).
 *
 * Protecciones (evaluación de seguridad del usuario, L9):
 * - Página pública y terminal: nunca consulta ni procesa tokens; no muta estado.
 * - NO confía en la query: con sesión activa verifica la verdad contra
 *   `GET /v1/payment-methods`; `status=ok` solo se muestra con tarjeta activa.
 *   Sin sesión, `ok` queda "por confirmar" (nunca éxito afirmado).
 * - `reason` se mapea a claves i18n cerradas (nunca se interpola cruda).
 * - `noindex`: página de pago pública sin indexación en buscadores.
 */
@Component({
  selector: 'bw-enrollment-result',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, ButtonModule],
  templateUrl: './enrollment-result.component.html',
  styleUrls: ['./enrollment-result.component.scss'],
})
export class EnrollmentResultComponent {
  readonly lang = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly api = inject(PaymentsApiService);
  private readonly meta = inject(Meta);

  private readonly state = signal<EnrollmentResultVm>(this.claimedState());

  /** Estado final para el template. */
  readonly vm = (): EnrollmentResultVm => this.state();

  constructor() {
    // Página de pago pública: no indexar.
    this.meta.addTag({ name: 'robots', content: 'noindex, nofollow' });
    this.reconcile();
  }

  /** Lo que la query reclama, ANTES de verificar (solo lectura de la URL). */
  private claimedState(): EnrollmentResultVm {
    const params = this.route.snapshot.queryParamMap;
    const status = params.get('status');
    const reason = params.get('reason');

    if (status === 'ok') return { kind: 'processing', reason: null }; // hasta verificar
    if (status === 'processing') return { kind: 'processing', reason: null };
    if (status === 'error') return { kind: 'error', reason };
    return { kind: 'neutral', reason: null }; // URL directa sin flujo
  }

  /**
   * Decide el estado mostrado contra la verdad:
   * - ok + tarjeta activa → éxito real.
   * - ok sin poder verificar → "por confirmar" (nunca éxito afirmado).
   * - error → informativo tal cual (nunca miente: describe un fallo).
   * - sin status (poking de URL) → neutral con CTA.
   */
  private reconcile(): void {
    const claimed = this.state();

    // Solo `ok` necesita verificación: error/neutral son informativos y
    // `processing` lo declara el backend (confirmación realmente en curso).
    if (claimed.kind !== 'processing' || this.route.snapshot.queryParamMap.get('status') !== 'ok') return;

    if (!this.auth.isAuthenticated()) {
      this.state.set({ kind: 'unconfirmed', reason: null });
      return;
    }

    this.api.getMethods().subscribe({
      next: ({ data }) => {
        this.state.set(
          data.some((m) => m.status === 'active')
            ? { kind: 'success', reason: null }
            : { kind: 'unconfirmed', reason: null },
        );
      },
      error: () => this.state.set({ kind: 'unconfirmed', reason: null }),
    });
  }

  /** i18n key del mensaje del motivo (o fallback genérico) cuando kind=error. */
  readonly errorMessageKey = (): string =>
    (this.state().reason && KEY_BY_REASON[this.state().reason as string]) || 'payment.enrollment.reason.failed';
}
