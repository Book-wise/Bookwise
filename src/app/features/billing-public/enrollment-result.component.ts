import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '@services/auth.service';
import { PaymentsApiService } from '@services/api/payments-api.service';
import { LanguageService } from '@services/language.service';
import { EnrollmentResultResponse } from '@models';

/**
 * Estado final de la página. La única verdad es `GET /payment-methods/enrollment-result?n=`
 * (P2): el `?status=ok|failure` de la query es solo hint de UX y nunca se usa para afirmar nada.
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

/** Polling corto ante `processing` (S14): reintenta hasta asentarse o agotar los reintentos. */
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 10;

/**
 * Resultado de la inscripción del medio de pago (P1/P2 Transbank Oneclick Mall).
 *
 * Visual spec: design/pago-resultado-inscripcion/04-split-con-contexto.html
 * (desktop: panel lateral de marca; ≤900px: franja, según 05-mobile.html).
 *
 * Protecciones (evaluación de seguridad del usuario, L9 + S14):
 * - Página pública y terminal: nunca consulta ni procesa tokens; no muta estado.
 * - La URL NO miente: el `?status=ok|failure` de la query es solo hint. La verdad
 *   única es `GET /v1/payment-methods/enrollment-result?n=<nonce>` (Sanctum).
 * - Nonce de un solo uso: 410 Gone (gastado/expirado/inexistente/otra cuenta) se
 *   muestra como estado NEUTRAL con CTA, nunca como error de la app.
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
export class EnrollmentResultComponent implements OnDestroy {
  readonly lang = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly api = inject(PaymentsApiService);
  private readonly meta = inject(Meta);

  private readonly state = signal<EnrollmentResultVm>({ kind: 'processing', reason: null });
  private nonce: string | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private polls = 0;

  /** Estado final para el template. */
  readonly vm = (): EnrollmentResultVm => this.state();

  constructor() {
    // Página de pago pública: no indexar.
    this.meta.addTag({ name: 'robots', content: 'noindex, nofollow' });

    this.nonce = this.route.snapshot.queryParamMap.get('n');
    const statusHint = this.route.snapshot.queryParamMap.get('status');
    if (!this.nonce) {
      // El BE conserva el PRIMER nonce en retornos concurrentes: un retorno duplicado
      // puede llegar sin `n`. Si la URL trae un status, el flujo existió → por confirmar
      // (nunca afirmamos nada sin la verdad del endpoint); sin status, es un poke de URL.
      this.state.set(
        statusHint ? { kind: 'unconfirmed', reason: null } : { kind: 'neutral', reason: null },
      );
    } else if (!this.auth.isAuthenticated()) {
      // Sin sesión no podemos consultar el endpoint (Sanctum): por confirmar.
      this.state.set({ kind: 'unconfirmed', reason: null });
    } else {
      this.reconcile();
    }
  }

  ngOnDestroy(): void {
    if (this.pollTimer !== null) clearTimeout(this.pollTimer);
  }

  /** Consulta la verdad única del resultado de inscripción. */
  private reconcile(): void {
    if (!this.nonce) return;
    this.api.getEnrollmentResult(this.nonce).subscribe({
      next: (res) => this.settle(res),
      error: (err: unknown) => this.onError(err),
    });
  }

  private settle(res: EnrollmentResultResponse): void {
    if (res.status === 'processing') {
      // Inscripción aún en vuelo: polling corto y acotado.
      this.state.set({ kind: 'processing', reason: null });
      if (this.polls < MAX_POLLS) {
        this.polls += 1;
        this.pollTimer = setTimeout(() => this.reconcile(), POLL_INTERVAL_MS);
      }
      return;
    }
    if (res.status === 'ok') {
      this.state.set({ kind: 'success', reason: null });
      return;
    }
    // `failure`: informativo tal cual (describe un fallo, nunca miente).
    this.state.set({ kind: 'error', reason: res.reason ?? null });
  }

  private onError(err: unknown): void {
    // 410 Gone = nonce gastado/expirado/inexistente/otra cuenta → neutral, nunca error app.
    if ((err as { status?: number })?.status === 410) {
      this.state.set({ kind: 'neutral', reason: null });
      return;
    }
    // Sin sesión / red / servidor → no podemos confirmar; nunca afirmamos éxito.
    this.state.set({ kind: 'unconfirmed', reason: null });
  }

  /** i18n key del mensaje del motivo (o fallback genérico) cuando kind=error. */
  readonly errorMessageKey = (): string =>
    (this.state().reason && KEY_BY_REASON[this.state().reason as string]) || 'payment.enrollment.reason.failed';
}
