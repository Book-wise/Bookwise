import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { PatientCardComponent } from './patient-card.component';
import { ClientDetailStore } from '@core/stores/client-detail.store';
import { ApiService } from '@services/api.service';
import { LanguageService } from '@services/language.service';
import type { Client, ClientPack, Booking, Sale } from '@models';

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
  let apiServiceMock: {
    getClientPacks: ReturnType<typeof vi.fn>;
    getSales: ReturnType<typeof vi.fn>;
    getBookings: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    apiServiceMock = {
      getClientPacks: vi.fn().mockReturnValue(of([])),
      getSales: vi.fn().mockReturnValue(of({ data: [], meta: {} })),
      getBookings: vi.fn().mockReturnValue(of({ data: [], meta: {} })),
    };

    await TestBed.configureTestingModule({
      imports: [PatientCardComponent],
      providers: [
        provideZonelessChangeDetection(),
        ClientDetailStore,
        { provide: ApiService, useValue: apiServiceMock },
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
    it('activeTab() is null on mount (tab list shown)', () => {
      expect(component.activeTab()).toBeNull();
    });

    it('selectTab sets activeTab to the chosen tab', () => {
      component.selectTab('planes');
      expect(component.activeTab()).toBe('planes');
    });

    it('backToTabs resets activeTab to null', () => {
      component.selectTab('planes');
      component.backToTabs();
      expect(component.activeTab()).toBeNull();
    });
  });

  // ── lazy load via store ──────────────────────────────────────────────────────

  describe('lazy load — sales (prepago tab)', () => {
    it('selectTab("prepago") triggers api.getSales via store', () => {
      fixture.componentRef.setInput('client', makeClient({ id: 42 }));
      apiServiceMock.getSales.mockReturnValue(of({ data: [makeSale()], meta: {} }));
      apiServiceMock.getSales.mockClear();

      component.selectTab('prepago');

      expect(apiServiceMock.getSales).toHaveBeenCalledTimes(1);
      expect(apiServiceMock.getSales).toHaveBeenCalledWith({ client_id: 42 });
    });

    it('does NOT re-fetch getSales when tab is selected a second time', () => {
      fixture.componentRef.setInput('client', makeClient({ id: 42 }));
      apiServiceMock.getSales.mockReturnValue(of({ data: [], meta: {} }));

      component.selectTab('prepago');
      apiServiceMock.getSales.mockClear();
      component.backToTabs();
      component.selectTab('prepago');

      expect(apiServiceMock.getSales).not.toHaveBeenCalled();
    });

    it('populates store sales state from response.data', () => {
      const sale = makeSale({ id: 99 });
      apiServiceMock.getSales.mockReturnValue(of({ data: [sale], meta: {} }));

      component.selectTab('prepago');

      expect(component.detailStore.sales().data).toHaveLength(1);
      expect(component.detailStore.sales().data[0].id).toBe(99);
    });
  });

  describe('lazy load — recent bookings (recientes tab)', () => {
    it('selectTab("recientes") triggers api.getBookings via store', () => {
      fixture.componentRef.setInput('client', makeClient({ id: 7 }));
      apiServiceMock.getBookings.mockReturnValue(of({ data: [], meta: {} }));
      apiServiceMock.getBookings.mockClear();

      component.selectTab('recientes');

      expect(apiServiceMock.getBookings).toHaveBeenCalledTimes(1);
      expect(apiServiceMock.getBookings).toHaveBeenCalledWith({ client_id: 7, per_page: 10 });
    });

    it('does NOT re-fetch getBookings when tab is selected a second time', () => {
      fixture.componentRef.setInput('client', makeClient({ id: 7 }));
      apiServiceMock.getBookings.mockReturnValue(of({ data: [], meta: {} }));

      component.selectTab('recientes');
      apiServiceMock.getBookings.mockClear();
      component.backToTabs();
      component.selectTab('recientes');

      expect(apiServiceMock.getBookings).not.toHaveBeenCalled();
    });

    it('populates store recent state from response.data', () => {
      const booking = makeBooking({ id: 55 });
      apiServiceMock.getBookings.mockReturnValue(of({ data: [booking], meta: {} }));

      component.selectTab('recientes');

      expect(component.detailStore.recent().data).toHaveLength(1);
      expect(component.detailStore.recent().data[0].id).toBe(55);
    });
  });

  // ── badge counts ──────────────────────────────────────────────────────────────

  describe('badge counts', () => {
    it('plansCount() counts only active packs when loaded via store', () => {
      apiServiceMock.getClientPacks.mockReturnValue(of([
        makePack({ id: 1, status: 'active' }),
        makePack({ id: 2, status: 'active' }),
        makePack({ id: 3, status: 'expired' }),
      ]));
      fixture.componentRef.setInput('client', makeClient({ id: 1 }));

      component.selectTab('planes');

      expect(component.plansCount()).toBe(2);
    });

    it('sessionsCount() sums used_sessions of active packs via store', () => {
      apiServiceMock.getClientPacks.mockReturnValue(of([
        makePack({ id: 1, status: 'active', used_sessions: 3 }),
        makePack({ id: 2, status: 'active', used_sessions: 5 }),
        makePack({ id: 3, status: 'expired', used_sessions: 10 }),
      ]));
      fixture.componentRef.setInput('client', makeClient({ id: 1 }));

      component.selectTab('planes');

      expect(component.sessionsCount()).toBe(8);
    });

    it('plansCount() and sessionsCount() return 0 when packs are empty', () => {
      apiServiceMock.getClientPacks.mockReturnValue(of([]));
      fixture.componentRef.setInput('client', makeClient({ id: 1 }));

      component.selectTab('planes');

      expect(component.plansCount()).toBe(0);
      expect(component.sessionsCount()).toBe(0);
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
  });
});
