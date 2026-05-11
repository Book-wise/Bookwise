import { DestroyRef, inject, Injectable, NgZone } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';

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
      summary:  'Sin conexión',
      detail:   'No hay conexión con el servidor. Se cerrará automáticamente al reconectar.',
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
      summary:  'Conexión restaurada',
      detail:   'Podés volver a trabajar con normalidad.',
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
    const titles: Record<number, string> = {
      400: 'Solicitud inválida',
      401: 'Sesión expirada',
      402: 'Pago requerido',
      403: 'Sin permisos',
      404: 'No encontrado',
      409: 'Conflicto de horario',
      422: 'Error de validación',
      429: 'Demasiadas solicitudes',
      500: 'Error del servidor',
      502: 'Servicio no disponible',
      503: 'Servicio no disponible',
      504: 'Tiempo de espera agotado',
    };
    const title = titles[status] ?? `Error ${status}`;
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
    const defaults: Record<number, string> = {
      400: 'Los datos enviados no son válidos.',
      401: 'Tu sesión expiró. Iniciá sesión de nuevo.',
      402: 'Se requiere pago para continuar.',
      403: 'No tenés permisos para realizar esta acción.',
      404: 'El recurso ya no existe. Recargá la página.',
      409: 'Ese horario ya está ocupado. Revisá el calendario antes de confirmar.',
      422: 'Hay campos con errores. Revisá el formulario.',
      429: 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.',
      500: 'Error interno del servidor. Si persiste, contactá soporte.',
      502: 'El servidor no responde. Intentá en unos minutos.',
      503: 'El servicio está temporalmente no disponible.',
      504: 'El servidor tardó demasiado en responder. Intentá de nuevo.',
    };
    return defaults[status] ?? 'Ocurrió un error inesperado. Intentá de nuevo.';
  }
}
