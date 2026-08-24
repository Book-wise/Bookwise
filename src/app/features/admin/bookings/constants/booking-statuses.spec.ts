import { describe, expect, it } from 'vitest';
import {
  BOOKING_STATUSES,
  STATUS_COLOR_MAP,
  bookingStatusChipClass,
  salePaymentChipClass,
} from './booking-statuses';

// ---------------------------------------------------------------------------
// bookingStatusChipClass — maps a booking status (id or name) to a CSS
// variable (single source of truth in _tokens.scss).
// ---------------------------------------------------------------------------

describe('bookingStatusChipClass', () => {
  it('maps by status id (the reliable path)', () => {
    expect(bookingStatusChipClass(undefined, 1)).toBe('var(--bw-status-reservado)');
    expect(bookingStatusChipClass(undefined, 2)).toBe('var(--bw-status-confirmado)');
    expect(bookingStatusChipClass(undefined, 3)).toBe('var(--bw-status-asiste)');
    expect(bookingStatusChipClass(undefined, 4)).toBe('var(--bw-status-no-asistio)');
    expect(bookingStatusChipClass(undefined, 5)).toBe('var(--bw-status-pendiente)');
    expect(bookingStatusChipClass(undefined, 6)).toBe('var(--bw-status-en-espera)');
    expect(bookingStatusChipClass(undefined, 7)).toBe('var(--bw-status-cancelado)');
  });

  it('falls back to name matching when id is missing', () => {
    expect(bookingStatusChipClass('confirmado')).toBe('var(--bw-status-confirmado)');
    expect(bookingStatusChipClass('Cancelado')).toBe('var(--bw-status-cancelado)');
    expect(bookingStatusChipClass('pendiente')).toBe('var(--bw-status-pendiente)');
  });

  it('returns the neutral variant for unknown or missing status', () => {
    expect(bookingStatusChipClass('Estado desconocido')).toBe('var(--bw-status-cancelado)');
    expect(bookingStatusChipClass()).toBe('var(--bw-status-cancelado)');
  });
});

// ---------------------------------------------------------------------------
// salePaymentChipClass — maps a sale payment status to a CSS variable.
// ---------------------------------------------------------------------------

describe('salePaymentChipClass', () => {
  it('maps each payment status to a chip variable', () => {
    expect(salePaymentChipClass('paid')).toBe('var(--bw-payment-paid)');
    expect(salePaymentChipClass('partial')).toBe('var(--bw-payment-partial)');
    expect(salePaymentChipClass('unpaid')).toBe('var(--bw-payment-unpaid)');
  });

  it('treats missing status as unpaid', () => {
    expect(salePaymentChipClass(undefined)).toBe('var(--bw-payment-unpaid)');
  });
});

// ---------------------------------------------------------------------------
// Constants sanity (guard against accidental palette drift)
// ---------------------------------------------------------------------------

describe('BOOKING_STATUSES constants', () => {
  it('keeps STATUS_COLOR_MAP in sync with the status list', () => {
    expect(Object.keys(STATUS_COLOR_MAP)).toHaveLength(BOOKING_STATUSES.length);
    expect(STATUS_COLOR_MAP[1]).toBe('#77D0FA');
  });
});
