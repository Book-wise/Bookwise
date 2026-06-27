import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { BookingStore } from './booking.store';
import { ApiService } from '@services/api.service';
import { AuthService } from '@services/auth.service';
import type { Booking, BlockedSlot, User } from '@models';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 1,
    client_id: 10,
    service_id: 20,
    provider_id: 30,
    location_id: 40,
    status_id: 1,
    start_time: '2026-06-27T10:00:00Z',
    end_time: '2026-06-27T11:00:00Z',
    effective_duration_minutes: 60,
    price: 30000,
    payment_status: 'unpaid',
    payment: {},
    client: { id: 10, first_name: 'Ana', last_name: 'López', email: 'ana@test.com' },
    service: { id: 20, name: 'Consulta', price: 30000, duration_minutes: 60 },
    provider: { id: 30, first_name: 'Dr.', last_name: 'Uno' },
    location: { id: 40, name: 'Sala 1' },
    status: { id: 1, name: 'Pendiente', color: '#ffc107' },
    ...overrides,
  } as Booking;
}

function makeBlockedSlot(overrides: Partial<BlockedSlot> = {}): BlockedSlot {
  return {
    id: 99,
    start_time: '2026-06-27T12:00:00Z',
    end_time: '2026-06-27T13:00:00Z',
    reason: 'Mantenimiento',
    ...overrides,
  } as BlockedSlot;
}

function makeAdminUser(): User {
  return { id: 1, email: 'admin@test.com', name: 'Admin', role: 'admin' } as User;
}

function makeProviderUser(): User {
  return { id: 2, email: 'pro@test.com', name: 'Provider', role: 'provider', provider_id: 30 } as User;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('BookingStore', () => {
  let store: InstanceType<typeof BookingStore>;
  let api: any;
  let authUser: ReturnType<typeof signal<User | null>>;

  function createStore() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: { user: authUser.asReadonly() } },
      ],
    });
    store = TestBed.inject(BookingStore);
  }

  // ── Initial state ──────────────────────────────────────────────────

  describe('initial state', () => {
    beforeEach(() => {
      api = {
        getBookings: vi.fn().mockReturnValue(of({ data: [] })),
        getBlockedSlots: vi.fn().mockReturnValue(of({ data: [] })),
        createBooking: vi.fn(),
        updateBooking: vi.fn(),
        cancelBooking: vi.fn(),
        createBlockedSlot: vi.fn(),
        getBooking: vi.fn(),
        deleteBlockedSlot: vi.fn(),
      };
      authUser = signal(makeAdminUser());
      createStore();
    });

    it('starts with empty arrays', () => {
      expect(store.bookings()).toEqual([]);
      expect(store.blockedSlots()).toEqual([]);
    });

    it('anyLoading is false initially', () => {
      expect(store.anyLoading()).toBe(false);
    });

    it('no error initially', () => {
      const err = store.error();
      expect(err.bookings).toBeNull();
      expect(err.blockedSlots).toBeNull();
      expect(err.mutation).toBeNull();
    });

    it('scopeProviderId is null for admin user', () => {
      expect(store.filters().scopeProviderId).toBeNull();
    });

    it('isProviderRole is false for admin', () => {
      expect(store.isProviderRole()).toBe(false);
    });

    it('eventsForCalendar is empty', () => {
      expect(store.eventsForCalendar()).toEqual([]);
    });

    it('selectedBookingId is null initially', () => {
      expect(store.selectedBookingId()).toBeNull();
    });

    it('selectedBooking is null initially', () => {
      expect(store.selectedBooking()).toBeNull();
    });
  });

  // ── Role scoping ───────────────────────────────────────────────────

  describe('role scoping', () => {
    it('sets scopeProviderId for provider user', () => {
      api = {
        getBookings: vi.fn().mockReturnValue(of({ data: [] })),
        getBlockedSlots: vi.fn().mockReturnValue(of({ data: [] })),
        createBooking: vi.fn(),
        updateBooking: vi.fn(),
        cancelBooking: vi.fn(),
        createBlockedSlot: vi.fn(),
        getBooking: vi.fn(),
        deleteBlockedSlot: vi.fn(),
      };
      authUser = signal(makeProviderUser());
      createStore();

      expect(store.filters().scopeProviderId).toBe(30);
      expect(store.isProviderRole()).toBe(true);
    });

    it('scopeProviderId is null when user is null', () => {
      api = {
        getBookings: vi.fn().mockReturnValue(of({ data: [] })),
        getBlockedSlots: vi.fn().mockReturnValue(of({ data: [] })),
        createBooking: vi.fn(),
        updateBooking: vi.fn(),
        cancelBooking: vi.fn(),
        createBlockedSlot: vi.fn(),
        getBooking: vi.fn(),
        deleteBlockedSlot: vi.fn(),
      };
      authUser = signal(null);
      createStore();

      expect(store.filters().scopeProviderId).toBeNull();
    });
  });

  // ── Selected booking ─────────────────────────────────────────────

  describe('selected booking', () => {
    const booking1 = makeBooking({ id: 1 });
    const booking2 = makeBooking({ id: 2 });

    beforeEach(() => {
      api = {
        getBookings: vi.fn().mockReturnValue(of({ data: [booking1, booking2] })),
        getBlockedSlots: vi.fn().mockReturnValue(of({ data: [] })),
        createBooking: vi.fn(),
        updateBooking: vi.fn(),
        cancelBooking: vi.fn(),
        createBlockedSlot: vi.fn(),
        deleteBlockedSlot: vi.fn(),
        getBooking: vi.fn(),
      };
      authUser = signal(makeAdminUser());
      createStore();
      store.loadEvents({ dateFrom: '2026-06-01', dateTo: '2026-06-30' });
    });

    it('selectBooking sets selectedBookingId and selectedBooking returns the booking', () => {
      store.selectBooking(booking1);
      expect(store.selectedBookingId()).toBe(1);
      const selected1 = store.selectedBooking();
      expect(selected1).not.toBeNull();
      expect(selected1!.id).toBe(1);
      expect(selected1!.client!.first_name).toBe('Ana');
    });

    it('setSelectedBookingId updates selectedBookingId', () => {
      store.setSelectedBookingId(2);
      expect(store.selectedBookingId()).toBe(2);
      const selected2 = store.selectedBooking();
      expect(selected2).not.toBeNull();
      expect(selected2!.id).toBe(2);
    });

    it('setSelectedBookingId(null) clears selection', () => {
      store.selectBooking(booking1);
      store.setSelectedBookingId(null);
      expect(store.selectedBookingId()).toBeNull();
      expect(store.selectedBooking()).toBeNull();
    });

    it('selectedBooking returns null for non-existent id', () => {
      store.setSelectedBookingId(999);
      expect(store.selectedBooking()).toBeNull();
    });

    it('mergeBooking replaces a booking in the array', () => {
      store.selectBooking(booking1);
      const updated = makeBooking({ id: 1, start_time: '2026-06-28T14:00:00Z', client: { id: 10, first_name: 'Maria', last_name: 'López', email: 'maria@test.com', active: true } });
      store.mergeBooking(updated);

      expect(store.bookings()).toHaveLength(2);
      expect(store.bookings()[0].start_time).toBe('2026-06-28T14:00:00Z');
      const selected = store.selectedBooking();
      expect(selected).not.toBeNull();
      expect(selected!.client!.first_name).toBe('Maria');
    });

    it('mergeBooking does not affect other bookings', () => {
      store.selectBooking(booking2);
      const updated = makeBooking({ id: 1, start_time: '2026-06-28T14:00:00Z' });
      store.mergeBooking(updated);

      expect(store.selectedBooking()?.start_time).toBe(booking2.start_time);
    });

    it('refreshBooking re-fetches and merges', () => {
      const refreshed = makeBooking({ id: 1, notes: 'Refreshed note' });
      api.getBooking.mockReturnValue(of(refreshed));
      store.selectBooking(booking1);

      store.refreshBooking(1);

      expect(api.getBooking).toHaveBeenCalledWith(1);
      // optimistic: booked was updated via merge
      expect(store.bookings().find(b => b.id === 1)?.notes).toBe('Refreshed note');
    });
  });

  // ── Loading lifecycle ──────────────────────────────────────────────

  describe('loading lifecycle', () => {
    const booking1 = makeBooking({ id: 1 });
    const booking2 = makeBooking({ id: 2 });
    const blocked  = makeBlockedSlot();

    beforeEach(() => {
      api = {
        getBookings: vi.fn().mockReturnValue(of({ data: [booking1, booking2] })),
        getBlockedSlots: vi.fn().mockReturnValue(of({ data: [blocked] })),
        createBooking: vi.fn(),
        updateBooking: vi.fn(),
        cancelBooking: vi.fn(),
        createBlockedSlot: vi.fn(),
        getBooking: vi.fn(),
        deleteBlockedSlot: vi.fn(),
      };
      authUser = signal(makeAdminUser());
      createStore();
    });

    it('loadEvents populates bookings and blockedSlots', () => {
      store.loadEvents({ dateFrom: '2026-06-01', dateTo: '2026-06-30' });

      expect(store.bookings()).toHaveLength(2);
      expect(store.blockedSlots()).toHaveLength(1);
    });

    it('eventsForCalendar merges bookings and blocked slots', () => {
      store.loadEvents({ dateFrom: '2026-06-01', dateTo: '2026-06-30' });

      const events = store.eventsForCalendar();
      expect(events).toHaveLength(3);   // 2 bookings + 1 blocked

      const bkgEvent = events.find((e) => e.id === '1');
      expect(bkgEvent).toBeDefined();
      expect(bkgEvent!.title).toContain('Ana');

      const blockedEvent = events.find((e) => e.id === 'blocked-99');
      expect(blockedEvent).toBeDefined();
      expect(blockedEvent!.classNames).toContain('fc-blocked-slot');
    });

    it('anyLoading is true during fetch', () => {
      // Use a delayed observable to catch the loading state
      const delayed$ = new Promise<{ data: Booking[] }>((resolve) =>
        setTimeout(() => resolve({ data: [] }), 50),
      );
      api.getBookings.mockReturnValue(delayed$);

      store.loadEvents({ dateFrom: '2026-06-01', dateTo: '2026-06-30' });

      expect(store.anyLoading()).toBe(true);
    });
  });

  // ── Computed: filteredBookings ─────────────────────────────────────

  describe('filteredBookings', () => {
    const b1 = makeBooking({ id: 1, status_id: 1 });
    const b2 = makeBooking({ id: 2, status_id: 2 });
    const b3 = makeBooking({ id: 3, status_id: 3 });

    beforeEach(() => {
      api = {
        getBookings: vi.fn().mockReturnValue(of({ data: [b1, b2, b3] })),
        getBlockedSlots: vi.fn().mockReturnValue(of({ data: [] })),
        createBooking: vi.fn(),
        updateBooking: vi.fn(),
        cancelBooking: vi.fn(),
        createBlockedSlot: vi.fn(),
        getBooking: vi.fn(),
        deleteBlockedSlot: vi.fn(),
      };
      authUser = signal(makeAdminUser());
      createStore();
      store.loadEvents({ dateFrom: '2026-06-01', dateTo: '2026-06-30' });
    });

    it('returns all bookings when no status filter', () => {
      expect(store.filteredBookings()).toHaveLength(3);
    });

    it('filters by single status', () => {
      store.setFilters({ selectedStatusIds: [1] });
      expect(store.filteredBookings()).toHaveLength(1);
      expect(store.filteredBookings()[0].id).toBe(1);
    });

    it('filters by multiple statuses', () => {
      store.setFilters({ selectedStatusIds: [1, 2] });
      expect(store.filteredBookings()).toHaveLength(2);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────

  describe('error handling', () => {
    beforeEach(() => {
      api = {
        getBookings: vi.fn().mockReturnValue(throwError(() => new Error('API failure'))),
        getBlockedSlots: vi.fn().mockReturnValue(of({ data: [] })),
        createBooking: vi.fn(),
        updateBooking: vi.fn(),
        cancelBooking: vi.fn(),
        createBlockedSlot: vi.fn(),
        getBooking: vi.fn(),
        deleteBlockedSlot: vi.fn(),
      };
      authUser = signal(makeAdminUser());
      createStore();
    });

    it('sets error state when bookings API fails', () => {
      store.loadEvents({ dateFrom: '2026-06-01', dateTo: '2026-06-30' });

      expect(store.error().bookings).toBe('API failure');
    });

    it('loading is false after error', () => {
      store.loadEvents({ dateFrom: '2026-06-01', dateTo: '2026-06-30' });

      expect(store.loading().bookings).toBe(false);
      expect(store.loading().blockedSlots).toBe(false);
    });
  });

  // ── Optimistic updates ─────────────────────────────────────────────

  describe('optimistic updates', () => {
    const booking = makeBooking({ id: 1, start_time: '2026-06-27T10:00:00Z', end_time: '2026-06-27T11:00:00Z' });

    beforeEach(() => {
      api = {
        getBookings: vi.fn().mockReturnValue(of({ data: [booking] })),
        getBlockedSlots: vi.fn().mockReturnValue(of({ data: [] })),
        createBooking: vi.fn(),
        updateBooking: vi.fn(),
        cancelBooking: vi.fn(),
        createBlockedSlot: vi.fn(),
        getBooking: vi.fn(),
        deleteBlockedSlot: vi.fn(),
      };
      authUser = signal(makeAdminUser());
      createStore();
      store.loadEvents({ dateFrom: '2026-06-01', dateTo: '2026-06-30' });
    });

    it('updateBooking patches optimistically and keeps changes on success', () => {
      api.updateBooking.mockReturnValue(of(makeBooking({ id: 1, start_time: '2026-06-27T14:00:00Z', end_time: '2026-06-27T15:00:00Z' })));

      store.updateBooking({ id: 1, data: { start_time: '2026-06-27T14:00:00Z', end_time: '2026-06-27T15:00:00Z' } });

      expect(store.bookings()[0].start_time).toBe('2026-06-27T14:00:00Z');
    });

    it('updateBooking reverts on API error', () => {
      api.updateBooking.mockReturnValue(throwError(() => new Error('Update failed')));

      store.updateBooking({ id: 1, data: { start_time: '2026-06-27T14:00:00Z', end_time: '2026-06-27T15:00:00Z' } });

      // Should have reverted to original
      expect(store.bookings()[0].start_time).toBe('2026-06-27T10:00:00Z');
      expect(store.error().mutation).toBe('Update failed');
    });

    it('deleteBooking removes optimistically and restores on error', () => {
      // Make cancelBooking fail
      api.cancelBooking.mockReturnValue(throwError(() => new Error('Cancel failed')));

      store.deleteBooking(1);

      // Should be restored
      expect(store.bookings()).toHaveLength(1);
      expect(store.bookings()[0].id).toBe(1);
      expect(store.error().mutation).toBe('Error al cancelar reserva');
    });

    it('createBooking adds booking to list on success', () => {
      const newBooking = makeBooking({ id: 5, client: { id: 10, first_name: 'Nuevo', last_name: 'Paciente', email: 'nuevo@test.com', active: true } });
      api.createBooking.mockReturnValue(of(newBooking));

      store.createBooking({
        start_time: '2026-06-28T10:00:00Z',
        client_id: 10,
        provider_id: 30,
        location_id: 40,
        service_id: 20,
        status_id: 1,
      });

      expect(store.bookings()).toHaveLength(2);
      expect(store.bookings().find((b) => b.id === 5)).toBeDefined();
    });

    it('createBooking sets mutation error on failure', () => {
      api.createBooking.mockReturnValue(throwError(() => new Error('Create failed')));

      store.createBooking({
        start_time: '2026-06-28T10:00:00Z',
        client_id: 10,
        provider_id: 30,
        location_id: 40,
        service_id: 20,
        status_id: 1,
      });

      expect(store.error().mutation).toBe('Create failed');
    });

    it('unblockSlot removes optimistically and restores on error', () => {
      // First load a blocked slot
      api.getBlockedSlots.mockReturnValue(of({ data: [makeBlockedSlot({ id: 99 })] }));
      store.loadEvents({ dateFrom: '2026-06-01', dateTo: '2026-06-30' });
      expect(store.blockedSlots()).toHaveLength(1);

      // Make delete fail
      api.deleteBlockedSlot.mockReturnValue(throwError(() => new Error('Delete failed')));

      store.unblockSlot(99);

      // Should be restored
      expect(store.blockedSlots()).toHaveLength(1);
      expect(store.blockedSlots()[0].id).toBe(99);
      expect(store.error().mutation).toBe('Error al eliminar bloqueo');
    });
  });

  // ── Filter changes ─────────────────────────────────────────────────

  describe('filter changes', () => {
    beforeEach(() => {
      api = {
        getBookings: vi.fn().mockReturnValue(of({ data: [] })),
        getBlockedSlots: vi.fn().mockReturnValue(of({ data: [] })),
        createBooking: vi.fn(),
        updateBooking: vi.fn(),
        cancelBooking: vi.fn(),
        createBlockedSlot: vi.fn(),
        getBooking: vi.fn(),
        deleteBlockedSlot: vi.fn(),
      };
      authUser = signal(makeAdminUser());
      createStore();
    });

    it('setFilters ignores scopeProviderId changes', () => {
      store.setFilters({ scopeProviderId: 999 } as any);
      // scopeProviderId should remain null (admin)
      expect(store.filters().scopeProviderId).toBeNull();
    });

    it('setFilters updates selectedLocationId', () => {
      store.setFilters({ selectedLocationId: 5 });
      expect(store.filters().selectedLocationId).toBe(5);
    });
  });
});
