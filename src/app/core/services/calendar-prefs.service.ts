import { Injectable } from '@angular/core';

/**
 * Preferencias de la agenda por usuario persistidas en localStorage bajo una
 * clave con prefijo `bw:lastLocationId:<userId>` — no se comparten entre
 * usuarios del mismo navegador y sobreviven refresco / logout-login.
 */
@Injectable({ providedIn: 'root' })
export class CalendarPrefsService {
  private readonly STORAGE_PREFIX = 'bw:lastLocationId';

  /** Última sucursal elegida por el usuario, o null si no hay ninguna guardada. */
  getLastLocationId(userId: number | null): number | null {
    if (typeof window === 'undefined' || userId == null) return null;
    const raw = localStorage.getItem(this.storageKey(userId));
    if (raw == null) return null;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }

  /** Guarda la última sucursal del usuario; con locationId null elimina la clave. */
  setLastLocationId(userId: number | null, locationId: number | null): void {
    if (typeof window === 'undefined' || userId == null) return;
    const key = this.storageKey(userId);
    if (locationId == null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, String(locationId));
    }
  }

  private storageKey(userId: number): string {
    return `${this.STORAGE_PREFIX}:${userId}`;
  }
}
