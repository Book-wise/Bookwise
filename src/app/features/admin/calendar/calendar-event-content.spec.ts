import { escapeHtml, eventCardHtml, blockedCardHtml } from './calendar-event-content';
import type { EventCardInput } from './calendar-event-content';

describe('CalendarEventContent', () => {
  const base: EventCardInput = {
    statusColor: '#77D0FA',
    clientName: 'Matias Díaz',
    serviceLabel: 'Kinesiología general',
    sessionPill: null,
    payment: null,
    startLabel: '09:00',
    isShort: false,
  };

  describe('escapeHtml', () => {
    it('escapa & < > " y \'', () => {
      expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
    });

    it('no toca texto sin caracteres reservados', () => {
      expect(escapeHtml('Kinesiología general')).toBe('Kinesiología general');
    });
  });

  describe('eventCardHtml', () => {
    it('escapa nombre y servicio', () => {
      const html = eventCardHtml({
        ...base,
        clientName: 'Masaje & "relax"',
        serviceLabel: "Masaje <deportivo> 'relax'",
      });
      expect(html).toContain('Masaje &amp; &quot;relax&quot;');
      expect(html).toContain('Masaje &lt;deportivo&gt; &#39;relax&#39;');
      expect(html).not.toContain('<deportivo>');
    });

    it('pagado → ev__pay--paid con $', () => {
      const html = eventCardHtml({ ...base, payment: 'paid' });
      expect(html).toContain('ev__pay--paid');
      expect(html).toContain('>$</span>');
    });

    it('parcial → ev__pay--partial con A', () => {
      const html = eventCardHtml({ ...base, payment: 'partial' });
      expect(html).toContain('ev__pay--partial');
      expect(html).toContain('>A</span>');
    });

    it('impago → ev__pay--none y sin letra', () => {
      const html = eventCardHtml({ ...base, payment: null });
      expect(html).toContain('ev__pay--none');
      expect(html).not.toContain('>$</span>');
      expect(html).not.toContain('>A</span>');
      const pay = html.match(/<span class="ev__pay[^>]*>([^<]*)<\/span>/);
      expect(pay?.[1]).toBe('');
    });

    it('con pack: ev__ctx = "Pack · sesión 3/6" y píldora "3/6"', () => {
      const html = eventCardHtml({
        ...base,
        serviceLabel: 'Pack · sesión 3/6',
        sessionPill: '3/6',
      });
      expect(html).toContain('<span class="ev__ctx">Pack · sesión 3/6</span>');
      expect(html).toContain('<span class="ev__marks"><span class="ev__sessions">3/6</span></span>');
    });

    it('sin pack: no emite ev__marks', () => {
      const html = eventCardHtml({ ...base, sessionPill: null });
      expect(html).not.toContain('ev__marks');
      expect(html).not.toContain('ev__sessions');
    });

    it('isShort → no emite ev__row2', () => {
      const html = eventCardHtml({ ...base, isShort: true });
      expect(html).not.toContain('ev__row2');
      expect(html).not.toContain('ev__ctx');
      expect(html).toContain('ev__row1');
    });

    it('nombre antes que hora en el HTML', () => {
      const html = eventCardHtml(base);
      expect(html.indexOf('ev__name')).toBeGreaterThan(-1);
      expect(html.indexOf('ev__name')).toBeLessThan(html.indexOf('ev__time'));
    });
  });

  describe('blockedCardHtml', () => {
    it('emite ev--blocked con motivo y rango, sin badge de pago', () => {
      const html = blockedCardHtml({
        reason: 'Bloqueado · almuerzo',
        startLabel: '13:00',
        endLabel: '14:00',
      });
      expect(html).toContain('ev--blocked');
      expect(html).toContain('Bloqueado · almuerzo');
      expect(html).toContain('13:00–14:00');
      expect(html).not.toContain('ev__pay');
    });
  });
});
