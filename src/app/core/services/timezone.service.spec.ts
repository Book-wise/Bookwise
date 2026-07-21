import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TimezoneService } from './timezone.service';

describe('TimezoneService', () => {
  let service: TimezoneService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(TimezoneService);
  });

  // ── Defaults ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('defaults activeTimezone to America/Santiago', () => {
      expect(service.activeTimezone()).toBe('America/Santiago');
    });

    it('computes timezoneMetadata with the default offset', () => {
      const meta = service.timezoneMetadata();
      expect(meta.id).toBe('America/Santiago');
      expect(meta.offset).toMatch(/^UTC[+-]\d{2}:\d{2}$/);
    });
  });

  // ── setTimezone ───────────────────────────────────────────────────────

  describe('setTimezone', () => {
    it('updates activeTimezone signal', () => {
      service.setTimezone('America/New_York');
      expect(service.activeTimezone()).toBe('America/New_York');
    });

    it('timezoneMetadata reflects the new timezone', () => {
      service.setTimezone('Europe/Madrid');
      expect(service.timezoneMetadata().id).toBe('Europe/Madrid');
      expect(service.timezoneMetadata().offset).toMatch(/^UTC[+-]\d{2}:\d{2}$/);
    });
  });

  // ── formatDateTime ────────────────────────────────────────────────────

  describe('formatDateTime', () => {
    it('formats a JS Date in America/Santiago', () => {
      // 2026-07-21 15:30:00 CLT (UTC-04:00, no DST in Jul → -04:00)
      const date = new Date('2026-07-21T19:30:00Z'); // 19:30 UTC = 15:30 CLT
      const result = service.formatDateTime(date);
      expect(result).toBe('2026-07-21 15:30:00');
    });

    it('formats an ISO string in the active timezone', () => {
      // 2026-01-15 10:00:00 CLST (UTC-03:00, DST in Jan → -03:00)
      // 10:00 UTC-3 = 13:00 UTC
      const result = service.formatDateTime('2026-01-15T10:00:00-03:00');
      expect(result).toBe('2026-01-15 10:00:00');
    });

    it('formats correctly after switching timezone', () => {
      service.setTimezone('America/New_York');
      // 2026-07-21 15:30:00 EDT (UTC-04:00)
      const date = new Date('2026-07-21T19:30:00Z'); // 19:30 UTC = 15:30 EDT
      const result = service.formatDateTime(date);
      expect(result).toBe('2026-07-21 15:30:00');
    });
  });

  // ── formatTime ────────────────────────────────────────────────────────

  describe('formatTime', () => {
    it('extracts HH:mm from ISO string', () => {
      // 15:30 CLT
      const result = service.formatTime('2026-07-21T15:30:00-04:00');
      expect(result).toBe('15:30');
    });
  });

  // ── formatDT ──────────────────────────────────────────────────────────

  describe('formatDT', () => {
    it('returns abbreviated day + time', () => {
      // 2026-07-21 is a Tuesday → "Mar"
      const result = service.formatDT('2026-07-21T15:30:00-04:00');
      expect(result).toMatch(/^Mar \d{2}:\d{2}$/);
      expect(result).toContain('15:30');
    });

    it('returns em-dash for empty input', () => {
      expect(service.formatDT('')).toBe('—');
    });
  });

  // ── getHourInZone / getMinuteInZone ───────────────────────────────────

  describe('getHourInZone / getMinuteInZone', () => {
    it('returns CLT hour from a UTC Date', () => {
      // 2026-07-21 19:30 UTC = 15:30 CLT
      const date = new Date('2026-07-21T19:30:00Z');
      expect(service.getHourInZone(date)).toBe(15);
      expect(service.getMinuteInZone(date)).toBe(30);
    });

    it('reflects timezone change', () => {
      service.setTimezone('America/New_York');
      // 2026-07-21 19:30 UTC = 15:30 EDT
      const date = new Date('2026-07-21T19:30:00Z');
      expect(service.getHourInZone(date)).toBe(15);
      expect(service.getMinuteInZone(date)).toBe(30);
    });
  });

  // ── getTimeParts ──────────────────────────────────────────────────────

  describe('getTimeParts', () => {
    it('returns hour + minute object', () => {
      const date = new Date('2026-07-21T19:30:00Z');
      const parts = service.getTimeParts(date);
      expect(parts).toEqual({ hour: 15, minute: 30 });
    });
  });

  // ── applyTime ─────────────────────────────────────────────────────────

  describe('applyTime', () => {
    it('sets hour/minute on a Date preserving timezone interpretation', () => {
      const base = new Date('2026-07-21T10:00:00-04:00'); // 10:00 CLT
      const result = service.applyTime(base, '14:30');

      const parts = service.getTimeParts(result);
      expect(parts.hour).toBe(14);
      expect(parts.minute).toBe(30);
    });

    it('returns base Date unchanged for empty value', () => {
      const base = new Date('2026-07-21T10:00:00-04:00');
      const result = service.applyTime(base, '');
      expect(result.getTime()).toBe(base.getTime());
    });
  });

  // ── parseDate ─────────────────────────────────────────────────────────

  describe('parseDate', () => {
    it('parses ISO string in active timezone', () => {
      // 15:30 CLT → JS Date absolute
      const result = service.parseDate('2026-07-21T15:30:00-04:00');
      expect(result.getTime()).toBe(new Date('2026-07-21T19:30:00Z').getTime());
    });
  });
});
