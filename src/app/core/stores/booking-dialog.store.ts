import { Injectable, signal } from '@angular/core';
import { Booking } from '@models';

/**
 * Dialog-scoped working copy of the reservation being edited.
 *
 * Sole owner of the booking surface inside the detail dialog: the header,
 * the Reserva tab and the patient card all read `booking()`. Mutations flow
 * through `replaceBooking()`; the calendar-canonical `BookingStore` is kept in
 * sync by the callers (dual write). `reset()` clears the copy on close.
 */
@Injectable()
export class BookingDialogStore {
  readonly booking = signal<Booking | null>(null);
  readonly bookingId = signal<number | null>(null);

  open(booking: Booking): void {
    this.booking.set({ ...booking });
    this.bookingId.set(booking.id);
  }

  replaceBooking(booking: Booking): void {
    if (this.bookingId() === booking.id) this.booking.set({ ...booking });
  }

  reset(): void {
    this.booking.set(null);
    this.bookingId.set(null);
  }
}
