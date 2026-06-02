import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Booking } from '@models';

@Injectable({ providedIn: 'root' })
export class BookingUpdateService {
  private _updated = new Subject<Booking>();
  readonly updated$ = this._updated.asObservable();

  notify(booking: Booking): void {
    this._updated.next(booking);
  }
}
