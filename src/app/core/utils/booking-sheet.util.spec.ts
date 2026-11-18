import { describe, expect, it } from 'vitest';
import { formatSpanishLongDate, personInitials, whatsappHref } from './booking-sheet.util';

// ---------------------------------------------------------------------------
// formatSpanishLongDate — the sheet header shows «viernes 14 de noviembre».
// The app never registers a DatePipe locale, so long names are formatted here.
// ---------------------------------------------------------------------------

describe('formatSpanishLongDate', () => {
  it('formats a local ISO datetime as weekday + day + month in Spanish', () => {
    expect(formatSpanishLongDate('2025-11-14T09:30:00')).toBe('viernes 14 de noviembre');
  });

  it('handles month and weekday boundaries', () => {
    expect(formatSpanishLongDate('2025-01-05T10:00:00')).toBe('domingo 5 de enero');
    expect(formatSpanishLongDate(new Date(2025, 11, 31, 23, 59))).toBe(
      'miércoles 31 de diciembre',
    );
  });

  it('returns an empty string for missing or invalid input', () => {
    expect(formatSpanishLongDate()).toBe('');
    expect(formatSpanishLongDate(null)).toBe('');
    expect(formatSpanishLongDate('no-es-una-fecha')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// personInitials — avatar fallback in the sheet header.
// ---------------------------------------------------------------------------

describe('personInitials', () => {
  it('takes the first letter of both names', () => {
    expect(personInitials('Camila', 'Rojas Fuentes')).toBe('CR');
  });

  it('uses whatever part exists and uppercases it', () => {
    expect(personInitials('camila', null)).toBe('C');
    expect(personInitials(undefined, 'rojas')).toBe('R');
  });

  it('falls back to a placeholder when there is nothing to show', () => {
    expect(personInitials('', '   ')).toBe('?');
    expect(personInitials()).toBe('?');
  });
});

// ---------------------------------------------------------------------------
// whatsappHref — el teléfono del cliente, como enlace de WhatsApp.
// ---------------------------------------------------------------------------

describe('whatsappHref', () => {
  it('keeps only the digits of a formatted phone number', () => {
    expect(whatsappHref('+56 9 8123 4567')).toBe('https://wa.me/56981234567');
    expect(whatsappHref('+56912345678')).toBe('https://wa.me/56912345678');
    expect(whatsappHref('(2) 2345 6789')).toBe('https://wa.me/223456789');
  });

  it('returns null when there is no usable number', () => {
    expect(whatsappHref()).toBeNull();
    expect(whatsappHref('')).toBeNull();
    expect(whatsappHref('sin telefono')).toBeNull();
  });
});
