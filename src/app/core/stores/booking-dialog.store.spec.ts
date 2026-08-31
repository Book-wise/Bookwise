import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BookingDialogStore } from './booking-dialog.store';
import type { Booking } from '@models';

const booking = {
  id: 12,
  client_id: 7,
  status_id: 1,
  start_time: '2026-08-24T10:00:00Z',
  end_time: '2026-08-24T11:00:00Z',
  price: 10000,
} as Booking;

describe('BookingDialogStore', () => {
  let store: BookingDialogStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), BookingDialogStore],
    });
    store = TestBed.inject(BookingDialogStore);
  });

  it('exposes only the booking surface — patient/navigation members are gone', () => {
    // Removed members (from the state consolidation): patientView, notifications
    // and the navigation helpers moved to ClientDetailStore.
    expect(store).not.toHaveProperty('patientView');
    expect(store).not.toHaveProperty('notifications');
    expect(store).not.toHaveProperty('selectPatientView');
    expect(store).not.toHaveProperty('returnToReservation');
    expect(store).not.toHaveProperty('setNotification');

    // Kept booking surface.
    expect(store).toHaveProperty('booking');
    expect(store).toHaveProperty('bookingId');
    expect(store).toHaveProperty('open');
    expect(store).toHaveProperty('replaceBooking');
    expect(store).toHaveProperty('reset');
  });

  it('open() stores a copied snapshot and anchors bookingId', () => {
    expect(store.booking()).toBeNull();

    store.open(booking);

    expect(store.booking()).toEqual(booking);
    expect(store.booking()).not.toBe(booking);
    expect(store.bookingId()).toBe(12);
  });

  it('replaceBooking() refreshes the copy for the same id and ignores others', () => {
    store.open(booking);

    store.replaceBooking({ ...booking, price: 15000 });
    expect(store.booking()?.price).toBe(15000);

    // A different booking must not overwrite the open one.
    store.replaceBooking({ ...booking, id: 99, price: 20000 });
    expect(store.booking()?.id).toBe(12);
    expect(store.booking()?.price).toBe(15000);
  });

  it('reset() clears the working copy and the anchor', () => {
    store.open(booking);
    store.reset();

    expect(store.booking()).toBeNull();
    expect(store.bookingId()).toBeNull();
  });
});
