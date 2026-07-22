import { Injectable, signal, computed, WritableSignal } from '@angular/core';
import { DateTime } from 'luxon';

export interface TimezoneMetadata {
  id: string;
  label: string;
  offset: string;
  hasDST: boolean;
}

@Injectable({ providedIn: 'root' })
export class TimezoneService {
  readonly activeTimezone: WritableSignal<string> = signal<string>('America/Santiago');

  readonly timezoneMetadata = computed<TimezoneMetadata>(() => {
    const tz = this.activeTimezone();
    const now = DateTime.now().setZone(tz);
    const isDST = now.isInDST;
    const offset = now.toFormat('ZZ'); // e.g. "-04:00" or "-03:00"
    const label = now.offsetNameLong ?? tz;
    return {
      id: tz,
      label,
      offset: `UTC${offset}`,
      hasDST: isDST,
    };
  });

  /** Set the active timezone. Future: called from config endpoint. */
  setTimezone(tz: string): void {
    this.activeTimezone.set(tz);
  }

  /** Parse an ISO 8601 string in the active timezone → JS Date */
  parseDate(isoStr: string): Date {
    return DateTime.fromISO(isoStr, { zone: this.activeTimezone() }).toJSDate();
  }

  /** Format a Date (or ISO string) as 'YYYY-MM-DD HH:mm:ss' in the active timezone (display only) */
  formatDateTime(date: Date | string): string {
    const dt =
      typeof date === 'string'
        ? DateTime.fromISO(date, { zone: this.activeTimezone() })
        : DateTime.fromJSDate(date).setZone(this.activeTimezone());
    return dt.toFormat('yyyy-MM-dd HH:mm:ss');
  }

  /** Format an ISO string as 'HH:mm' in the active timezone */
  formatTime(iso: string): string {
    return DateTime.fromISO(iso, { zone: this.activeTimezone() }).toFormat('HH:mm');
  }

  /** Format an ISO string as 'Dom 14:30' (abbreviated day + time) in the active timezone */
  formatDT(iso: string): string {
    if (!iso) return '—';
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dt = DateTime.fromISO(iso, { zone: this.activeTimezone() });
    const dayIdx = dt.weekday === 7 ? 0 : dt.weekday; // ISO weekday: 1=Mon → 0=Dom
    return `${days[dayIdx]} ${dt.toFormat('HH:mm')}`;
  }

  /** Get the hour in the active timezone */
  getHourInZone(date: Date): number {
    return DateTime.fromJSDate(date).setZone(this.activeTimezone()).hour;
  }

  /** Get the minute in the active timezone */
  getMinuteInZone(date: Date): number {
    return DateTime.fromJSDate(date).setZone(this.activeTimezone()).minute;
  }

  /** Get hour + minute as an object in the active timezone */
  getTimeParts(date: Date): { hour: number; minute: number } {
    const dt = DateTime.fromJSDate(date).setZone(this.activeTimezone());
    return { hour: dt.hour, minute: dt.minute };
  }

  /** Format an ISO string as 'dd/MM/yyyy - HH:mm' in the active timezone (for historial cards) */
  formatCardDate(iso: string): string {
    if (!iso) return '—';
    return DateTime.fromISO(iso, { zone: this.activeTimezone() }).toFormat('dd/MM/yyyy - HH:mm');
  }

  /** Apply time (HH:mm) to a base Date, preserving the active timezone interpretation */
  applyTime(base: Date, eventOrValue: Event | string): Date {
    const val = typeof eventOrValue === 'string' ? eventOrValue : (eventOrValue.target as HTMLInputElement).value;
    if (!val) return base;
    const [h, m] = val.split(':').map(Number);

    const baseDt = DateTime.fromJSDate(base).setZone(this.activeTimezone());
    const result = baseDt.set({ hour: h, minute: m, second: 0, millisecond: 0 });
    return result.toJSDate();
  }
}
