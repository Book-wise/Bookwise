import { describe, expect, it } from 'vitest';
import {
  BOOKING_STATUSES,
  STATUS_COLOR_MAP,
  bookingStatusChipClass,
  salePaymentChipClass,
} from './booking-statuses';

// ---------------------------------------------------------------------------
// bookingStatusChipClass — maps a booking status (id or name) to a .bw-chip
// variant class, replacing the old per-component PrimeNG severity helpers.
// ---------------------------------------------------------------------------

describe('bookingStatusChipClass', () => {
  it('maps by status id (the reliable path)', () => {
    expect(bookingStatusChipClass(undefined, 1)).toBe('bw-chip--online');    // Reservado (info → blue)
    expect(bookingStatusChipClass(undefined, 2)).toBe('bw-chip--warning');   // Confirmado (warn)
    expect(bookingStatusChipClass(undefined, 3)).toBe('bw-chip--warning');   // Asiste (help → warn, same as legacy)
    expect(bookingStatusChipClass(undefined, 4)).toBe('bw-chip--secondary'); // No asistio
    expect(bookingStatusChipClass(undefined, 5)).toBe('bw-chip--danger');    // Pendiente
    expect(bookingStatusChipClass(undefined, 6)).toBe('bw-chip--secondary'); // En espera
    expect(bookingStatusChipClass(undefined, 7)).toBe('bw-chip--danger');    // Cancelado
  });

  it('falls back to name matching when id is missing', () => {
    expect(bookingStatusChipClass('confirmado')).toBe('bw-chip--warning');
    expect(bookingStatusChipClass('Cancelado')).toBe('bw-chip--danger');
    expect(bookingStatusChipClass('pendiente')).toBe('bw-chip--danger');
  });

  it('returns the neutral variant for unknown or missing status', () => {
    expect(bookingStatusChipClass('Estado desconocido')).toBe('bw-chip--secondary');
    expect(bookingStatusChipClass()).toBe('bw-chip--secondary');
  });
});

// ---------------------------------------------------------------------------
// salePaymentChipClass — maps a sale payment status to a .bw-chip variant.
// ---------------------------------------------------------------------------

describe('salePaymentChipClass', () => {
  it('maps each payment status to a chip variant', () => {
    expect(salePaymentChipClass('paid')).toBe('bw-chip--success');
    expect(salePaymentChipClass('partial')).toBe('bw-chip--warning');
    expect(salePaymentChipClass('unpaid')).toBe('bw-chip--danger');
  });

  it('treats missing status as unpaid', () => {
    expect(salePaymentChipClass(undefined)).toBe('bw-chip--danger');
  });
});

// ---------------------------------------------------------------------------
// Constants sanity (guard against accidental palette/severity drift)
// ---------------------------------------------------------------------------

describe('BOOKING_STATUSES constants', () => {
  it('keeps STATUS_COLOR_MAP in sync with the status list', () => {
    expect(Object.keys(STATUS_COLOR_MAP)).toHaveLength(BOOKING_STATUSES.length);
    expect(STATUS_COLOR_MAP[1]).toBe('#93c5fd');
  });
});
