import { DestroyRef, inject, Injectable, NgZone } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { LanguageService } from './language.service';

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

  /**
   * Muestra el toast correcto según el error.
   * Corre dentro de NgZone para garantizar que el change detection actualice el DOM.
   */
  handle(err: HttpErrorResponse, action?: string): void {
    // status 0 = error de red; también chequeamos navigator.onLine como fallback
    const isOffline = err.status === 0 || !navigator.onLine;

    this.zone.run(() => {
      if (isOffline) {
        this.showOfflineToast();
      } else {
        this.messageService.add(this.toToastConfig(err, action));
      }
    });
  }

  /** Utilidad: devuelve la config del toast sin side effects. */
  toToastConfig(err: HttpErrorResponse, action?: string): ToastConfig {
    return {
      severity: this.severity(err.status),
      summary:  this.summary(err.status, action),
      detail:   this.detail(err),
      life:     7000,
    };
  }

  // ── Offline ─────────────────────────────────────────────────────────────────

  private showOfflineToast(): void {
    if (this.offlineActive) return;
    this.offlineActive = true;

    // Sin key — usa el toast por defecto que siempre está suscrito.
    // sticky + life largo como doble garantía de persistencia.
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
    // clear() sin key limpia todos los mensajes activos (incluyendo el sticky offline)
    this.messageService.clear();
    this.messageService.add({
      severity: 'success',
      summary:  this.lang.t('toast.reconnected.summary'),
      detail:   this.lang.t('toast.reconnected.detail'),
      life:     4000,
    });
  }

  // ── Lógica interna ──────────────────────────────────────────────────────────

  private severity(status: number): 'error' | 'warn' | 'info' {
    if (status >= 500)                              return 'error';
    if ([409, 429].includes(status))               return 'warn';
    if ([400, 402, 403, 404, 422].includes(status)) return 'warn';
    return 'error';
  }

  private summary(status: number, action?: string): string {
    const knownStatuses = [400, 401, 402, 403, 404, 409, 422, 429, 500, 502, 503, 504];
    const title = knownStatuses.includes(status)
      ? this.lang.t(`error.${status}`)
      : this.lang.t('error.unknown', { status: String(status) });
    return action ? `${title} — ${action}` : title;
  }

  private detail(err: HttpErrorResponse): string {
    const body = err.error;
    if (body) {
      if (body.errors && typeof body.errors === 'object') {
        const msgs = (Object.values(body.errors) as string[][])
          .flat().slice(0, 2).join(' · ');
        if (msgs) return msgs;
      }
      if (body.message && body.message !== 'Server Error') return body.message;
      if (body.detail) return body.detail;
    }
    return this.defaultDetail(err.status);
  }

  private defaultDetail(status: number): string {
    const knownStatuses = [400, 401, 402, 403, 404, 409, 422, 429, 500, 502, 503, 504];
    return knownStatuses.includes(status)
      ? this.lang.t(`error.${status}.detail`)
      : this.lang.t('error.default.detail');
  }
}
