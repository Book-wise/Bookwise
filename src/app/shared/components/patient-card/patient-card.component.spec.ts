import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { PatientCardComponent, PatientTab } from './patient-card.component';
import { ClientDetailStore } from '@core/stores/client-detail.store';
import { ClientsApiService } from '@services/api/clients-api.service';
import { SalesApiService } from '@services/api/sales-api.service';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import type { Client, ClientPack, Booking, Sale } from '@models';

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1,
    first_name: 'Juan',
    last_name: 'Perez',
    email: 'juan@test.com',
    phone: '+56912345678',
    active: true,
    ...overrides,
  } as Client;
}

function makePack(overrides: Partial<ClientPack> = {}): ClientPack {
  return {
    id: 1,
    client_id: 1,
    service_pack_id: 1,
    total_sessions: 10,
    used_sessions: 3,
    remaining_sessions: 7,
    status: 'active',
    service_pack: { id: 1, name: 'Kinesiología', total_sessions: 10, price: 50000, active: true },
    ...overrides,
  } as ClientPack;
}

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 1,
    total: 50000,
    paid_amount: 50000,
    remaining_amount: 0,
    payment_status: 'paid',
    transactions: [],
    ...overrides,
  } as Sale;
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 1,
    start_time: '2024-01-15T10:00:00',
    end_time: '2024-01-15T11:00:00',
    status_id: 2,
    price: 30000,
    ...overrides,
  } as Booking;
}

describe('PatientCardComponent', () => {
  let component: PatientCardComponent;
  let fixture: ComponentFixture<PatientCardComponent>;
  let clientsApi: Partial<Record<keyof ClientsApiService, ReturnType<typeof vi.fn>>>;
  let salesApi: Partial<Record<keyof SalesApiService, ReturnType<typeof vi.fn>>>;
  let bookingsApi: Partial<Record<keyof BookingsApiService, ReturnType<typeof vi.fn>>>;

  beforeEach(async () => {
    clientsApi = {
      getClientPacks: vi.fn().mockReturnValue(of([])),
      updateClient: vi.fn().mockReturnValue(of({ ...makeClient(), notification_prefs: {} })),
    } as any;
    salesApi = { getSales: vi.fn().mockReturnValue(of({ data: [], meta: {} })) } as any;
    bookingsApi = { getBookings: vi.fn().mockReturnValue(of({ data: [], meta: {} })) } as any;

    await TestBed.configureTestingModule({
      imports: [PatientCardComponent],
      providers: [
        provideZonelessChangeDetection(),
        ClientDetailStore,
        { provide: ClientsApiService, useValue: clientsApi },
        { provide: SalesApiService, useValue: salesApi },
        { provide: BookingsApiService, useValue: bookingsApi },
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
        LanguageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('client', makeClient());
  });

  // ── initials ──────────────────────────────────────────────────────────────────

  describe('initials computed', () => {
    it('returns uppercase initials for full name', () => {
      fixture.componentRef.setInput('client', makeClient({ first_name: 'Juan', last_name: 'Perez' }));
      expect(component.initials()).toBe('JP');
    });

    it('returns single initial when last_name is empty', () => {
      fixture.componentRef.setInput('client', makeClient({ first_name: 'Juan', last_name: '' }));
      expect(component.initials()).toBe('J');
    });

    it('returns "?" when both first_name and last_name are empty', () => {
      fixture.componentRef.setInput('client', makeClient({ first_name: '', last_name: '' }));
      expect(component.initials()).toBe('?');
    });
  });

  // ── hasContactWarning ─────────────────────────────────────────────────────────

  describe('hasContactWarning computed', () => {
    it('returns false when both email and phone are present', () => {
      fixture.componentRef.setInput('client', makeClient({ email: 'a@b.com', phone: '+56912345678' }));
      expect(component.hasContactWarning()).toBe(false);
    });

    it('returns true when email is missing (empty string)', () => {
      fixture.componentRef.setInput('client', makeClient({ email: '' }));
      expect(component.hasContactWarning()).toBe(true);
    });

    it('returns true when phone is null', () => {
      fixture.componentRef.setInput('client', makeClient({ phone: null }));
      expect(component.hasContactWarning()).toBe(true);
    });

    it('returns true when both email and phone are missing', () => {
      fixture.componentRef.setInput('client', makeClient({ email: '', phone: null }));
      expect(component.hasContactWarning()).toBe(true);
    });
  });

  // ── whatsappHref ──────────────────────────────────────────────────────────────

  describe('whatsappHref computed', () => {
    it('strips non-digit characters from phone', () => {
      fixture.componentRef.setInput('client', makeClient({ phone: '+56 9 1234 5678' }));
      expect(component.whatsappHref()).toBe('https://wa.me/56912345678');
    });

    it('returns wa.me with empty path when phone is null', () => {
      fixture.componentRef.setInput('client', makeClient({ phone: null }));
      expect(component.whatsappHref()).toBe('https://wa.me/');
    });
  });

  // ── warning bar in DOM ────────────────────────────────────────────────────────

  describe('warning bar', () => {
    it('is absent when email and phone are both present', async () => {
      fixture.componentRef.setInput('client', makeClient({ email: 'a@b.com', phone: '+56911111111' }));
      fixture.detectChanges();
      await fixture.whenStable();
      const warning = fixture.debugElement.query(By.css('[data-testid="pc-warning"]'));
      expect(warning).toBeNull();
    });

    it('is shown when email is missing', async () => {
      fixture.componentRef.setInput('client', makeClient({ email: '' }));
      fixture.detectChanges();
      await fixture.whenStable();
      const warning = fixture.debugElement.query(By.css('[data-testid="pc-warning"]'));
      expect(warning).not.toBeNull();
    });

    it('is shown when phone is null', async () => {
      fixture.componentRef.setInput('client', makeClient({ phone: null }));
      fixture.detectChanges();
      await fixture.whenStable();
      const warning = fixture.debugElement.query(By.css('[data-testid="pc-warning"]'));
      expect(warning).not.toBeNull();
    });
  });

  // ── tab switching ─────────────────────────────────────────────────────────────

  describe('tab switching', () => {
    it('panel is closed on mount (tab list shown)', () => {
      expect(component.panelOpen()).toBe(false);
    });

    it('openPanel sets the selected panel tab', () => {
      component.openPanel('planes');
      expect(component.panelOpen()).toBe(true);
      expect(component.panelTab()).toBe('planes');
    });

    it('closePanel returns to the card tabs', () => {
      component.openPanel('planes');
      component.closePanel();
      expect(component.panelOpen()).toBe(false);
    });
  });

  // ── lazy load via store ──────────────────────────────────────────────────────

  describe('lazy load — sales (prepago tab)', () => {
    it('openPanel("prepago") triggers api.getSales via store', () => {
      fixture.componentRef.setInput('client', makeClient({ id: 42 }));
      salesApi.getSales!.mockReturnValue(of({ data: [makeSale()], meta: {} }));
      salesApi.getSales!.mockClear();

      component.openPanel('prepago');

      expect(salesApi.getSales!).toHaveBeenCalledTimes(1);
      expect(salesApi.getSales!).toHaveBeenCalledWith({ client_id: 42 });
    });

    it('does NOT re-fetch getSales when the panel is reopened', () => {
      fixture.componentRef.setInput('client', makeClient({ id: 42 }));
      salesApi.getSales!.mockReturnValue(of({ data: [], meta: {} }));

      component.openPanel('prepago');
      salesApi.getSales!.mockClear();
      component.closePanel();
      component.openPanel('prepago');

      expect(salesApi.getSales!).not.toHaveBeenCalled();
    });

    it('populates store sales state from response.data', () => {
      const sale = makeSale({ id: 99 });
      salesApi.getSales!.mockReturnValue(of({ data: [sale], meta: {} }));

      component.openPanel('prepago');

      expect(component.detailStore.sales().data).toHaveLength(1);
      expect(component.detailStore.sales().data[0].id).toBe(99);
    });
  });

  describe('lazy load — recent bookings (recientes tab)', () => {
    it('openPanel("recientes") triggers api.getBookings via store', () => {
      fixture.componentRef.setInput('client', makeClient({ id: 7 }));
      bookingsApi.getBookings!.mockReturnValue(of({ data: [], meta: {} }));
      bookingsApi.getBookings!.mockClear();

      component.openPanel('recientes');

      expect(bookingsApi.getBookings!).toHaveBeenCalledTimes(1);
      expect(bookingsApi.getBookings!).toHaveBeenCalledWith({ client_id: 7, per_page: 10 });
    });

    it('does NOT re-fetch getBookings when tab is selected a second time', () => {
      fixture.componentRef.setInput('client', makeClient({ id: 7 }));
      bookingsApi.getBookings!.mockReturnValue(of({ data: [], meta: {} }));

      component.openPanel('recientes');
      bookingsApi.getBookings!.mockClear();
      component.closePanel();
      component.openPanel('recientes');

      expect(bookingsApi.getBookings!).not.toHaveBeenCalled();
    });

    it('populates store recent state from response.data', () => {
      const booking = makeBooking({ id: 55 });
      bookingsApi.getBookings!.mockReturnValue(of({ data: [booking], meta: {} }));

      component.openPanel('recientes');

      expect(component.detailStore.recent().data).toHaveLength(1);
      expect(component.detailStore.recent().data[0].id).toBe(55);
    });
  });

  // ── badge counts ──────────────────────────────────────────────────────────────

  describe('badge counts', () => {
    it('plansCount() counts every pack when loaded via store', () => {
      clientsApi.getClientPacks!.mockReturnValue(of([
        makePack({ id: 1, status: 'active' }),
        makePack({ id: 2, status: 'active' }),
        makePack({ id: 3, status: 'expired' }),
      ]));
      fixture.componentRef.setInput('client', makeClient({ id: 1 }));

      component.openPanel('planes');

      expect(component.plansCount()).toBe(3);
    });

    it('sessionsCount() sums used_sessions of active packs via store', () => {
      clientsApi.getClientPacks!.mockReturnValue(of([
        makePack({ id: 1, status: 'active', used_sessions: 3 }),
        makePack({ id: 2, status: 'active', used_sessions: 5 }),
        makePack({ id: 3, status: 'expired', used_sessions: 10 }),
      ]));
      fixture.componentRef.setInput('client', makeClient({ id: 1 }));

      component.openPanel('planes');

      expect(component.sessionsCount()).toBe(20);
    });

    it('packStatusChip() maps completed/abandoned to distinct labels and colors', () => {
      expect(component.packStatusChip(makePack({ status: 'completed' })).label).toBe('Completado');
      expect(component.packStatusChip(makePack({ status: 'completed' })).cls).toContain('bw-chip--secondary');
      expect(component.packStatusChip(makePack({ status: 'abandoned' })).cls).toContain('bw-chip--warning');
      expect(component.packStatusChip(makePack({ status: 'active' })).cls).toContain('bw-chip--success');
    });

    it('plansCount() and sessionsCount() return 0 when packs are empty', () => {
      clientsApi.getClientPacks!.mockReturnValue(of([]));
      fixture.componentRef.setInput('client', makeClient({ id: 1 }));

      component.openPanel('planes');

      expect(component.plansCount()).toBe(0);
      expect(component.sessionsCount()).toBe(0);
    });
  });

  // ── disabled sub-tab matrix (loaded && length === 0) ─────────────────────────

  describe('disabled sub-tab buttons', () => {
    function tabButton(testid: string): HTMLButtonElement {
      const el = fixture.debugElement.query(By.css(`[data-testid="${testid}"]`));
      expect(el).not.toBeNull();
      return el.nativeElement as HTMLButtonElement;
    }

    it('keeps all sub-tabs enabled while data is not loaded yet', async () => {
      fixture.componentRef.setInput('client', makeClient({ id: 42 }));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(tabButton('tab-planes').disabled).toBe(false);
      expect(tabButton('tab-sesiones').disabled).toBe(false);
      expect(tabButton('tab-prepago').disabled).toBe(false);
      expect(tabButton('tab-recientes').disabled).toBe(false);
    });

    it('disables planes and sesiones when packs are loaded but empty', async () => {
      fixture.componentRef.setInput('client', makeClient({ id: 42 }));
      clientsApi.getClientPacks!.mockReturnValue(of([]));
      component.detailStore.loadPacks(42);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(tabButton('tab-planes').disabled).toBe(true);
      expect(tabButton('tab-sesiones').disabled).toBe(true);
      expect(tabButton('tab-prepago').disabled).toBe(false);
    });

    it('disables prepago when sales are loaded but empty', async () => {
      fixture.componentRef.setInput('client', makeClient({ id: 42 }));
      salesApi.getSales!.mockReturnValue(of({ data: [], meta: {} }));
      component.detailStore.loadSales(42);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(tabButton('tab-prepago').disabled).toBe(true);
      expect(tabButton('tab-planes').disabled).toBe(false);
    });

    it('disables recientes when recent bookings are loaded but empty', async () => {
      fixture.componentRef.setInput('client', makeClient({ id: 42 }));
      bookingsApi.getBookings!.mockReturnValue(of({ data: [], meta: {} }));
      component.detailStore.loadRecent(42);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(tabButton('tab-recientes').disabled).toBe(true);
      expect(tabButton('tab-prepago').disabled).toBe(false);
    });

    it('re-enables a sub-tab when its category gains data', async () => {
      fixture.componentRef.setInput('client', makeClient({ id: 42 }));
      clientsApi.getClientPacks!.mockReturnValue(of([]));
      component.detailStore.loadPacks(42);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(tabButton('tab-planes').disabled).toBe(true);

      clientsApi.getClientPacks!.mockReturnValue(of([makePack()]));
      component.detailStore.loadPacks(42);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(tabButton('tab-planes').disabled).toBe(false);
    });
  });

  // ── editRequested output ──────────────────────────────────────────────────────

  describe('editRequested output', () => {
    it('showEdit=false: edit button is absent from DOM', async () => {
      fixture.componentRef.setInput('showEdit', false);
      fixture.detectChanges();
      await fixture.whenStable();
      const btn = fixture.debugElement.query(By.css('[data-testid="pc-edit"]'));
      expect(btn).toBeNull();
    });

    it('showEdit=true (default): edit button is present', async () => {
      fixture.componentRef.setInput('showEdit', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const btn = fixture.debugElement.query(By.css('[data-testid="pc-edit"]'));
      expect(btn).not.toBeNull();
    });

    it('clicking edit button emits editRequested output exactly once', async () => {
      fixture.componentRef.setInput('showEdit', true);
      fixture.detectChanges();
      await fixture.whenStable();

      let callCount = 0;
      const sub = component.editRequested.subscribe(() => callCount++);

      const btn = fixture.debugElement.query(By.css('[data-testid="pc-edit"]'));
      (btn.nativeElement as HTMLButtonElement).click();

      expect(callCount).toBe(1);
      sub.unsubscribe();
    });
  });

  // ── onEditClick method ────────────────────────────────────────────────────────

  describe('onEditClick()', () => {
    it('emits editRequested when called directly', () => {
      let callCount = 0;
      const sub = component.editRequested.subscribe(() => callCount++);
      component.onEditClick();
      expect(callCount).toBe(1);
      sub.unsubscribe();
    });
  });

  // ── toggleNotif ───────────────────────────────────────────────────────────────

  describe('toggleNotif()', () => {
    it('notifOpen() starts as false', () => {
      expect(component.notifOpen()).toBe(false);
    });

    it('toggleNotif() flips notifOpen from false to true', () => {
      component.toggleNotif();
      expect(component.notifOpen()).toBe(true);
    });

    it('toggleNotif() flips notifOpen back to false', () => {
      component.toggleNotif();
      component.toggleNotif();
      expect(component.notifOpen()).toBe(false);
    });
  });

  // ── notifications collapsible in DOM ─────────────────────────────────────────

  describe('notifications collapsible', () => {
    it('notif block is absent when showNotifications=false', async () => {
      fixture.componentRef.setInput('showNotifications', false);
      fixture.detectChanges();
      await fixture.whenStable();
      const notif = fixture.debugElement.query(By.css('.bw-pc__notif'));
      expect(notif).toBeNull();
    });

    it('notif block is present when showNotifications=true', async () => {
      fixture.componentRef.setInput('showNotifications', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const notif = fixture.debugElement.query(By.css('.bw-pc__notif'));
      expect(notif).not.toBeNull();
    });

    it('stores notification values in dialog mode and keeps accordion expansion local', () => {
      fixture.componentRef.setInput('dialogMode', true);
      component.detailStore.initialize(makeClient());
      component.setNotification('email_new_booking', true);
      component.toggleNotif();

      expect(component.notificationValue('email_new_booking')).toBe(true);
      expect(component.detailStore.notifications().email_new_booking).toBe(true);
      expect(component.notifOpen()).toBe(true);

      component.closePanel();
      expect(component.notifOpen()).toBe(true);
    });

    it('sends a partial PATCH with only the changed flag on toggle', () => {
      fixture.componentRef.setInput('dialogMode', true);
      component.detailStore.initialize(makeClient());
      clientsApi.updateClient!.mockClear();

      component.setNotification('whatsapp_reminder', false);

      expect(clientsApi.updateClient).toHaveBeenCalledTimes(1);
      expect(clientsApi.updateClient).toHaveBeenCalledWith(1, {
        notification_prefs: { whatsapp_reminder: false },
      });
    });

    it('renders exactly six flags grouped by channel and no citaWa', async () => {
      fixture.componentRef.setInput('showNotifications', true);
      fixture.componentRef.setInput('dialogMode', true);
      component.detailStore.initialize(makeClient());
      component.toggleNotif();
      fixture.detectChanges();
      await fixture.whenStable();

      const expected = [
        'notif-flag-email_new_booking',
        'notif-flag-email_booking_confirmation',
        'notif-flag-email_booking_cancellation',
        'notif-flag-email_reminder',
        'notif-flag-whatsapp_reminder',
        'notif-flag-whatsapp_cancellation_confirmation',
      ];
      const flags = fixture.debugElement.queryAll(By.css('[data-testid^="notif-flag-"]'));
      const rendered = flags.map(f => f.attributes['data-testid']);

      expect(rendered).toEqual(expected);
      expect(rendered).not.toContain('notif-flag-citaWa');

      const groups = fixture.debugElement.queryAll(By.css('.bw-pc__notif-group-title'));
      expect(groups.length).toBe(2);
      expect(flags.length).toBe(6);
    });

    it('exposes a keyboard-reachable info button with a tooltip per flag', async () => {
      fixture.componentRef.setInput('showNotifications', true);
      fixture.componentRef.setInput('dialogMode', true);
      component.detailStore.initialize(makeClient());
      component.toggleNotif();
      fixture.detectChanges();
      await fixture.whenStable();

      const infoButtons = fixture.debugElement.queryAll(By.css('.bw-pc__notif-info-btn'));
      expect(infoButtons.length).toBe(6);
      for (const btn of infoButtons) {
        expect(btn.nativeElement.tagName).toBe('BUTTON');
      }

      // Tooltip content appears when the info button gains hover/focus.
      infoButtons[0].nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      await fixture.whenStable();
      const tooltip = document.body.querySelector('.p-tooltip .p-tooltip-text');
      expect(tooltip?.textContent?.trim()).toBe('Email inmediato al crear una reserva.');
    });
  });

  // ── master switch, email reminder and per-group counters (T12) ─────────────

  describe('notification master switch', () => {
    /** Opens the notifications accordion and renders with the given prefs. */
    async function renderWith(prefs?: Client['notification_prefs'], topLevel?: boolean) {
      const client = makeClient({ notification_prefs: prefs, notifications_enabled: topLevel });
      fixture.componentRef.setInput('client', client);
      fixture.componentRef.setInput('showNotifications', true);
      fixture.componentRef.setInput('dialogMode', true);
      component.detailStore.initialize(client);
      component.toggleNotif();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges(); // flush the checkbox model→checked binding after ngModel writes
    }

    function masterInput(): HTMLInputElement {
      const host = fixture.debugElement.query(By.css('[data-testid="notif-master-checkbox"]'));
      expect(host).not.toBeNull();
      return host.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    }

    function flagInput(flag: string): HTMLInputElement {
      const host = fixture.debugElement.query(By.css(`[data-testid="notif-checkbox-${flag}"]`));
      expect(host).not.toBeNull();
      return host.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    }

    it('reflects notification_prefs.notifications_enabled', async () => {
      await renderWith({
        email_new_booking: true,
        email_booking_confirmation: true,
        email_booking_cancellation: true,
        email_reminder: true,
        whatsapp_reminder: true,
        whatsapp_cancellation_confirmation: true,
        notifications_enabled: false,
      });

      expect(masterInput().checked).toBe(false);
      expect(component.masterEnabled()).toBe(false);
    });

    it('falls back to the top-level Client.notifications_enabled when prefs omit it', async () => {
      await renderWith(
        {
          email_new_booking: false,
          email_booking_confirmation: false,
          email_booking_cancellation: false,
          email_reminder: true,
          whatsapp_reminder: false,
          whatsapp_cancellation_confirmation: false,
        },
        false,
      );

      expect(masterInput().checked).toBe(false);
    });

    it('defaults the master to on when neither source provides a value', async () => {
      await renderWith(undefined, undefined);

      expect(masterInput().checked).toBe(true);
      expect(component.masterEnabled()).toBe(true);
    });

    it('toggling the master PATCHes only notifications_enabled and keeps flag state', async () => {
      await renderWith({
        email_new_booking: true,
        email_booking_confirmation: true,
        email_booking_cancellation: false,
        email_reminder: true,
        whatsapp_reminder: true,
        whatsapp_cancellation_confirmation: false,
      });
      clientsApi.updateClient!.mockClear();

      masterInput().click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.masterEnabled()).toBe(false);
      expect(clientsApi.updateClient).toHaveBeenCalledTimes(1);
      expect(clientsApi.updateClient).toHaveBeenCalledWith(1, {
        notification_prefs: { notifications_enabled: false },
      });

      // Turning it off must NOT rewrite any per-channel flag.
      const state = component.detailStore.notifications();
      expect(state.email_new_booking).toBe(true);
      expect(state.email_booking_confirmation).toBe(true);
      expect(state.email_booking_cancellation).toBe(false);
      expect(state.email_reminder).toBe(true);
      expect(state.whatsapp_reminder).toBe(true);
      expect(state.whatsapp_cancellation_confirmation).toBe(false);
    });

    it('with the master off the six switches are disabled and keep their checked state', async () => {
      await renderWith({
        email_new_booking: true,
        email_booking_confirmation: false,
        email_booking_cancellation: true,
        email_reminder: true,
        whatsapp_reminder: true,
        whatsapp_cancellation_confirmation: false,
        notifications_enabled: false,
      });

      const flags = [
        'email_new_booking',
        'email_booking_confirmation',
        'email_booking_cancellation',
        'email_reminder',
        'whatsapp_reminder',
        'whatsapp_cancellation_confirmation',
      ];
      for (const flag of flags) {
        expect(flagInput(flag).disabled).toBe(true);
      }

      expect(flagInput('email_new_booking').checked).toBe(true);
      expect(flagInput('email_booking_confirmation').checked).toBe(false);
      expect(flagInput('email_booking_cancellation').checked).toBe(true);
      expect(flagInput('email_reminder').checked).toBe(true);
      expect(flagInput('whatsapp_reminder').checked).toBe(true);
      expect(flagInput('whatsapp_cancellation_confirmation').checked).toBe(false);
    });
  });

  describe('email reminder flag (6th email flag)', () => {
    async function renderWith(prefs?: Client['notification_prefs']) {
      fixture.componentRef.setInput('showNotifications', true);
      fixture.componentRef.setInput('dialogMode', true);
      component.detailStore.initialize(makeClient({ notification_prefs: prefs }));
      component.toggleNotif();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges(); // flush the checkbox model→checked binding after ngModel writes
    }

    function flagInput(flag: string): HTMLInputElement {
      const host = fixture.debugElement.query(By.css(`[data-testid="notif-checkbox-${flag}"]`));
      expect(host).not.toBeNull();
      return host.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    }

    it('renders in the Email group after cancellation with its label and hint', async () => {
      await renderWith(undefined);

      const row = fixture.debugElement.query(By.css('[data-testid="notif-flag-email_reminder"]'));
      expect(row).not.toBeNull();
      expect(row.nativeElement.textContent).toContain('Recordatorio de reserva');
      expect(row.nativeElement.textContent).toContain('Email 24 h y 30 min antes de la reserva.');

      const groupRows = fixture.debugElement
        .queryAll(By.css('.bw-pc__notif-group'))[0]
        .queryAll(By.css('[data-testid^="notif-flag-"]'))
        .map(el => el.attributes['data-testid']);
      expect(groupRows).toEqual([
        'notif-flag-email_new_booking',
        'notif-flag-email_booking_confirmation',
        'notif-flag-email_booking_cancellation',
        'notif-flag-email_reminder',
      ]);
    });

    it('defaults to on when the API omits email_reminder', async () => {
      await renderWith({
        email_new_booking: true,
        email_booking_confirmation: true,
        email_booking_cancellation: true,
        whatsapp_reminder: true,
        whatsapp_cancellation_confirmation: true,
      });

      expect(flagInput('email_reminder').checked).toBe(true);
    });

    it('toggling it PATCHes only email_reminder', async () => {
      await renderWith(undefined);
      clientsApi.updateClient!.mockClear();

      flagInput('email_reminder').click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(clientsApi.updateClient).toHaveBeenCalledTimes(1);
      expect(clientsApi.updateClient).toHaveBeenCalledWith(1, {
        notification_prefs: { email_reminder: false },
      });
    });
  });

  describe('per-group active counters', () => {
    async function renderWith(prefs: Client['notification_prefs']) {
      fixture.componentRef.setInput('showNotifications', true);
      fixture.componentRef.setInput('dialogMode', true);
      component.detailStore.initialize(makeClient({ notification_prefs: prefs }));
      component.toggleNotif();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges(); // flush the checkbox model→checked binding after ngModel writes
    }

    it('shows “N de M activos” per channel group', async () => {
      await renderWith({
        email_new_booking: true,
        email_booking_confirmation: false,
        email_booking_cancellation: true,
        email_reminder: true,
        whatsapp_reminder: false,
        whatsapp_cancellation_confirmation: true,
      });

      const counts = fixture.debugElement
        .queryAll(By.css('.bw-pc__notif-group-count'))
        .map(el => el.nativeElement.textContent.trim());

      expect(counts).toEqual(['3 de 4 activos', '1 de 2 activos']);
    });
  });

  describe('pre-existing flags still PATCH themselves', () => {
    it('whatsapp_reminder toggle still sends a partial PATCH with only that flag', async () => {
      fixture.componentRef.setInput('showNotifications', true);
      fixture.componentRef.setInput('dialogMode', true);
      component.detailStore.initialize(makeClient());
      component.toggleNotif();
      fixture.detectChanges();
      await fixture.whenStable();
      clientsApi.updateClient!.mockClear();

      const host = fixture.debugElement.query(By.css('[data-testid="notif-checkbox-whatsapp_reminder"]'));
      (host.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(clientsApi.updateClient).toHaveBeenCalledTimes(1);
      expect(clientsApi.updateClient).toHaveBeenCalledWith(1, {
        notification_prefs: { whatsapp_reminder: true },
      });
    });
  });

  describe('dialog navigation output', () => {
    it('emits one typed output for every patient tab without opening a local panel', () => {
      fixture.componentRef.setInput('dialogMode', true);
      const selected: PatientTab[] = [];
      const sub = component.patientTabSelected.subscribe(tab => selected.push(tab));

      (['planes', 'sesiones', 'prepago', 'recientes'] as const).forEach(tab => component.openPanel(tab));

      expect(selected).toEqual(['planes', 'sesiones', 'prepago', 'recientes']);
      expect(component.panelOpen()).toBe(false);
      sub.unsubscribe();
    });
  });
});
