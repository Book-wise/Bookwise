import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { BookingsApiService } from './bookings-api.service';
import { environment } from '@env/environment';
import { Booking, CreateBooking, UpdateBooking, ApiResponse, PaginatedResponse, AvailableSlot } from '@models';

describe('BookingsApiService', () => {
  let service: BookingsApiService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BookingsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /bookings via getBookings() without params', () => {
    const dummy: PaginatedResponse<Booking> = {
      data: [],
      meta: { current_page: 1, from: null as unknown as number, last_page: 1, per_page: 10, to: null as unknown as number, total: 0 },
    };

    service.getBookings().subscribe((data) => {
      expect(data).toEqual(dummy);
    });

    const req = httpMock.expectOne(`${baseUrl}/bookings`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush(dummy);
  });

  it('GET /bookings via getBookings() with params', () => {
    service.getBookings({ location_id: 1, status_id: 2 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/bookings`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('location_id')).toBe('1');
    expect(req.request.params.get('status_id')).toBe('2');
    req.flush({ data: [], meta: { current_page: 1, from: null, last_page: 1, per_page: 10, to: null, total: 0 } });
  });

  it('GET /bookings/:id via getBooking() unwraps data', () => {
    const booking = {
      id: 1,
      start_time: '2024-01-01T10:00:00',
      end_time: '2024-01-01T11:00:00',
      effective_duration_minutes: 60,
      price: 15000,
      status_id: 1,
      status: { id: 1, name: 'Confirmed', color: '#000', is_cancellation: false },
      client: { id: 1, first_name: 'Juan', last_name: 'Pérez', email: 'juan@test.com' },
      service: { id: 1, name: 'Corte', duration_minutes: 60, price: 15000 },
      provider: { id: 1, first_name: 'Ana', last_name: 'García' },
      location: { id: 1, name: 'Sucursal 1' },
      payment_status: null,
    } as Booking;

    service.getBooking(1).subscribe((data) => {
      expect(data).toEqual(booking);
    });

    const req = httpMock.expectOne(`${baseUrl}/bookings/1`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: booking });
  });

  it('POST /bookings via createBooking()', () => {
    const payload: CreateBooking = {
      start_time: '2024-01-01T10:00:00',
      client_id: 1,
      service_id: 1,
      provider_id: 1,
      location_id: 1,
      status_id: 1,
    };
    const response = { id: 1, ...payload, end_time: '2024-01-01T11:00:00', effective_duration_minutes: 60, price: 15000, status: { id: 1, name: 'Confirmed', color: '#000' }, client: { id: 1, first_name: 'Juan', last_name: 'Pérez', email: 'juan@test.com' }, service: { id: 1, name: 'Corte', duration_minutes: 60, price: 15000 }, provider: { id: 1, first_name: 'Ana', last_name: 'García' }, location: { id: 1, name: 'Sucursal 1' }, payment_status: null } as unknown as Booking;

    service.createBooking(payload).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/bookings`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(response);
  });

  it('PATCH /bookings/:id via updateBooking()', () => {
    const payload: UpdateBooking = { notes: 'Updated notes' };
    const response: ApiResponse<Booking> = { data: { id: 1, start_time: '2024-01-01T10:00:00', end_time: '2024-01-01T11:00:00', effective_duration_minutes: 60, price: 15000, status_id: 1, notes: 'Updated notes', status: { id: 1, name: 'Confirmed', color: '#000' }, client: { id: 1, first_name: 'Juan', last_name: 'Pérez', email: 'juan@test.com' }, service: { id: 1, name: 'Corte', duration_minutes: 60, price: 15000 }, provider: { id: 1, first_name: 'Ana', last_name: 'García' }, location: { id: 1, name: 'Sucursal 1' }, payment_status: null } as Booking };

    service.updateBooking(1, payload).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/bookings/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush(response);
  });

  it('PATCH /bookings/:id/cancel via cancelBooking()', () => {
    const response = { id: 1, start_time: '2024-01-01T10:00:00', end_time: '2024-01-01T11:00:00', status_id: 5, status: { id: 5, name: 'Cancelled', color: '#f00', is_cancellation: true }, client: { id: 1, first_name: 'Juan', last_name: 'Pérez', email: 'juan@test.com' }, service: { id: 1, name: 'Corte', duration_minutes: 60, price: 15000 }, provider: { id: 1, first_name: 'Ana', last_name: 'García' }, location: { id: 1, name: 'Sucursal 1' }, payment_status: null } as Booking;

    service.cancelBooking(1).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/bookings/1/cancel`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});
    req.flush(response);
  });

  it('GET /available_slots via getAvailableSlots()', () => {
    const params = { date: '2024-01-01', location_id: 1 };
    const response: AvailableSlot[] = [
      { location_id: 1, provider_id: 1, service_id: 1, start_time: '2024-01-01T09:00:00', end_time: '2024-01-01T10:00:00', duration_minutes: 60 },
    ];

    service.getAvailableSlots(params).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/available_slots`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('date')).toBe('2024-01-01');
    expect(req.request.params.get('location_id')).toBe('1');
    expect(req.request.params.get('provider_id')).toBeNull();
    expect(req.request.params.get('service_id')).toBeNull();
    req.flush(response);
  });
});
