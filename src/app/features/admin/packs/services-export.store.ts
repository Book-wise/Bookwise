import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '@services/auth.service';
import { serviceFingerprint } from './services-export.util';
import type { ServiceExportInput } from './services-export.util';

export type WooSyncState = 'new' | 'changed' | 'synced';

interface StoredExport {
  lastExportAt: string | null;
  fingerprints: Record<string, string>;
}

/**
 * Historial local de la exportación a WooCommerce.
 *
 * No hay backend para esto: se guarda en `localStorage` con la clave
 * `bw:services:export:{userId}:{tenantId}` (el mismo patrón que la preferencia
 * de vista). Si el storage no está disponible o está roto, el estado vive solo
 * en memoria y la pantalla sigue funcionando.
 */
@Injectable({ providedIn: 'root' })
export class ServicesExportStore {
  private readonly EXPORT_PREFIX = 'bw:services:export';
  private readonly auth = inject(AuthService);

  readonly lastExportAt = signal<string | null>(null);
  readonly fingerprints = signal<Record<string, string>>({});

  constructor() {
    this.load();
  }

  private exportKey(): string {
    const user = this.auth.user();
    return `${this.EXPORT_PREFIX}:${user?.id ?? 0}:${user?.tenant_id ?? 0}`;
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.exportKey());
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<StoredExport> | null;
      if (!parsed || typeof parsed !== 'object') return;

      if (typeof parsed.lastExportAt === 'string') {
        this.lastExportAt.set(parsed.lastExportAt);
      }
      if (parsed.fingerprints && typeof parsed.fingerprints === 'object') {
        this.fingerprints.set(parsed.fingerprints as Record<string, string>);
      }
    } catch {
      // Storage roto o no disponible: se arranca vacío, solo en memoria.
    }
  }

  private persist(): void {
    try {
      const payload: StoredExport = {
        lastExportAt: this.lastExportAt(),
        fingerprints: this.fingerprints(),
      };
      localStorage.setItem(this.exportKey(), JSON.stringify(payload));
    } catch {
      // Storage no disponible: el estado vive solo en memoria.
    }
  }

  /**
   * Registra una exportación: actualiza el timestamp y la huella de los
   * servicios exportados, conservando la huella de los que no se incluyeron.
   */
  recordExport(inputs: ServiceExportInput[]): void {
    const next = { ...this.fingerprints() };
    for (const { service, terms } of inputs) {
      next[String(service.id)] = serviceFingerprint(service, terms);
    }

    this.lastExportAt.set(new Date().toISOString());
    this.fingerprints.set(next);
    this.persist();
  }

  stateFor(serviceId: number, fingerprint: string): WooSyncState {
    const stored = this.fingerprints()[String(serviceId)];
    if (stored === undefined) return 'new';
    return stored === fingerprint ? 'synced' : 'changed';
  }

  /** Cuenta servicios con cambios pendientes y servicios nunca exportados. */
  counts(inputs: ServiceExportInput[]): { changed: number; never: number } {
    let changed = 0;
    let never = 0;

    for (const { service, terms } of inputs) {
      const state = this.stateFor(service.id, serviceFingerprint(service, terms));
      if (state === 'changed') changed += 1;
      else if (state === 'new') never += 1;
    }

    return { changed, never };
  }
}
