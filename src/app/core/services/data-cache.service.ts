import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, take } from 'rxjs/operators';

interface CacheEntry<T> {
  data: T;
  loadedAt: number;
  refreshing: boolean;
}

export const CACHE_TTL = {
  LOCATIONS: 5 * 60_000,
  PROVIDERS: 2 * 60_000,
  SERVICES:  2 * 60_000,
  PACKS:     2 * 60_000,
  CLIENTS:   30_000,
} as const;

export const CACHE_KEYS = {
  CLIENTS:   'resource/clients',
  SERVICES:  'resource/services',
  PACKS:     'resource/packs',
  PROVIDERS: 'resource/providers',
  LOCATIONS: 'resource/locations',
} as const;

@Injectable({ providedIn: 'root' })
export class DataCacheService {
  private store = new Map<string, CacheEntry<unknown>>();

  /**
   * Devuelve el recurso desde caché si está vigente.
   * Si la entrada está vencida: la devuelve inmediatamente y lanza revalidación en background.
   * Si no hay caché: fetcha, guarda y devuelve.
   */
  getOrFetchResource<T>(
    key: string,
    fetcher: () => Observable<T>,
    ttlMs: number,
  ): Observable<T> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return fetcher().pipe(
        take(1),
        tap(data => this.saveCacheEntry(key, data)),
      );
    }

    const isStale = Date.now() - entry.loadedAt > ttlMs;

    if (!isStale) {
      return of(entry.data);
    }

    // Stale-while-revalidate: retorna el valor viejo y refresca en background
    if (!entry.refreshing) {
      entry.refreshing = true;
      fetcher().pipe(take(1)).subscribe({
        next:  data => this.saveCacheEntry(key, data),
        error: ()   => { entry.refreshing = false; },
      });
    }

    return of(entry.data);
  }

  /** Elimina entradas específicas de la caché (usar tras mutaciones) */
  invalidateCacheEntries(...keys: string[]): void {
    keys.forEach(k => this.store.delete(k));
  }

  /** Vacía la caché completa */
  invalidateEntireCache(): void {
    this.store.clear();
  }

  private saveCacheEntry<T>(key: string, data: T): void {
    this.store.set(key, { data, loadedAt: Date.now(), refreshing: false });
  }
}
