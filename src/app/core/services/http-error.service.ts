import { DestroyRef, inject, Injectable, NgZone } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { LanguageService } from './language.service';

/** Shape of the error body returned by the Kinesilk API. */
interface ApiErrorBody {
  error?: string;
  detail?: string;
  errors?: Record<string, string[]>;
  message?: string;
  conflicts_with?: {
    id: number;
    start_time: string;
    end_time: string;
    type?: 'blocked_slot' | 'booking';
  };
  // amount_exceeds_remaining error — remaining balance
  remaining?: string;
}

export interface ToastConfig {
  severity: 'error' | 'warn' | 'info';
  summary: string;
  detail: string;
  life?: number;
  sticky?: boolean;
  key?: string;
}

@Injectable({ providedIn: 'root' })
export class HttpErrorService {
  private messageService = inject(MessageService);
  private zone           = inject(NgZone);
  private destroyRef     = inject(DestroyRef);
  private lang           = inject(LanguageService);
  private offlineActive  = false;

  constructor() {
    const offlineHandler = () => this.zone.run(() => this.showOfflineToast());
    window.addEventListener('offline', offlineHandler);

    const intervalId = setInterval(() => {
      if (!navigator.onLine && !this.offlineActive) {
        this.zone.run(() => this.showOfflineToast());
      } else if (navigator.onLine && this.offlineActive) {
        this.zone.run(() => this.onReconnect());
      }
    }, 3000);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('offline', offlineHandler);
      clearInterval(intervalId);
    });
  }

  handle(err: HttpErrorResponse, action?: string): void {
    const isOffline = err.status === 0 || !navigator.onLine;
    this.zone.run(() => {
      if (isOffline) {
        this.showOfflineToast();
      } else {
        this.messageService.add(this.toToastConfig(err, action));
      }
    });
  }

  /** Utility: returns the toast config without side effects. */
  toToastConfig(err: HttpErrorResponse, action?: string): ToastConfig {
    const body = err.error as ApiErrorBody | null;

    // ── 1. Business error — { error: 'conflict', detail: '...' }
    if (body?.error) {
      return this.bizConfig(body, err.status, action);
    }

    // ── 2. Laravel field validation — { errors: { campo: ['...'] } }
    if (body?.errors && typeof body.errors === 'object') {
      return this.validationConfig(body, err.status, action);
    }

    // ── 3. Framework / fallback — { message: '...' } or generic
    return this.frameworkConfig(body, err.status, action);
  }

  // ── Offline ──────────────────────────────────────────────────────────────────

  private showOfflineToast(): void {
    if (this.offlineActive) return;
    this.offlineActive = true;
    this.messageService.add({
      severity: 'error',
      summary:  this.lang.t('toast.offline.summary'),
      detail:   this.lang.t('toast.offline.detail'),
      sticky:   true,
      life:     86_400_000,
    });
    window.addEventListener('online', () => {
      this.zone.run(() => this.onReconnect());
    }, { once: true });
  }

  private onReconnect(): void {
    if (!this.offlineActive) return;
    this.offlineActive = false;
    this.messageService.clear();
    this.messageService.add({
      severity: 'success',
      summary:  this.lang.t('toast.reconnected.summary'),
      detail:   this.lang.t('toast.reconnected.detail'),
      life:     4000,
    });
  }

  // ── Branch 1: Business error ─────────────────────────────────────────────────

  private bizConfig(body: ApiErrorBody, status: number, action?: string): ToastConfig {
    const errorKey   = body.error as string;
    const summaryKey = `biz.${errorKey}`;
    const detailKey  = `biz.${errorKey}.detail`;

    const title   = this.lang.has(summaryKey) ? this.lang.t(summaryKey) : this.statusTitle(status);
    const summary = action ? `${title} — ${action}` : title;

    // Always use our own translated detail for known keys — never trust body.detail language
    let detail = this.lang.has(detailKey) ? this.lang.t(detailKey) : this.defaultDetail(status);

    // slot_collision: refine detail by conflict type (booking vs blocked slot)
    if (errorKey === 'slot_collision' && body.conflicts_with?.type) {
      const typedKey = `biz.slot_collision.detail.${body.conflicts_with.type}`;
      if (this.lang.has(typedKey)) detail = this.lang.t(typedKey);
    }

    // Append conflict time range (no ID — internal data not relevant to the user)
    if (body.conflicts_with) {
      const c = body.conflicts_with;
      detail += ` (${this.fmtTime(c.start_time)} – ${this.fmtTime(c.end_time)})`;
    }
    // Append remaining balance for amount_exceeds_remaining
    if (body.remaining) {
      detail += ` Saldo: $${Number(body.remaining).toLocaleString('es-CL')}`;
    }

    return { severity: this.severity(status), summary, detail, life: 8000 };
  }

  // ── Branch 2: Field validation ───────────────────────────────────────────────

  private validationConfig(body: ApiErrorBody, status: number, action?: string): ToastConfig {
    const msgs  = (Object.values(body.errors ?? {}) as string[][]).flat().slice(0, 2).join(' · ');
    const title = this.statusTitle(status);
    return {
      severity: 'warn',
      summary:  action ? `${title} — ${action}` : title,
      detail:   msgs || this.defaultDetail(status),
      life:     7000,
    };
  }

  // ── Branch 3: Framework / generic ───────────────────────────────────────────

  private frameworkConfig(body: ApiErrorBody | null, status: number, action?: string): ToastConfig {
    const detail = body?.message && body.message !== 'Server Error'
      ? body.message
      : this.defaultDetail(status);
    const title  = this.statusTitle(status);
    return {
      severity: this.severity(status),
      summary:  action ? `${title} — ${action}` : title,
      detail,
      life: 7000,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private severity(status: number): 'error' | 'warn' | 'info' {
    if (status >= 500)                               return 'error';
    if ([409, 429].includes(status))                return 'warn';
    if ([400, 402, 403, 404, 422].includes(status)) return 'warn';
    return 'error';
  }

  private statusTitle(status: number): string {
    const known = [400, 401, 402, 403, 404, 409, 422, 429, 500, 502, 503, 504];
    return known.includes(status)
      ? this.lang.t(`error.${status}`)
      : this.lang.t('error.unknown', { status: String(status) });
  }

  private defaultDetail(status: number): string {
    const known = [400, 401, 402, 403, 404, 409, 422, 429, 500, 502, 503, 504];
    return known.includes(status)
      ? this.lang.t(`error.${status}.detail`)
      : this.lang.t('error.default.detail');
  }

  private fmtTime(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
