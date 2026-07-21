import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { environment } from '@env/environment';
import type { Booking, Client } from '@models';

describe('ApiService Resource contract', () => {
  let service: ApiService;
  let http: HttpTestingController;
  const apiUrl = environment.apiUrl;

  const client = {
    id: 8,
    first_name: 'Ana',
    last_name: 'Pérez',
    email: 'ana@example.test',
    phone: '+56912345678',
  } as Client;

  const booking = {
    id: 23,
    client_id: 8,
    location_id: 2,
    service_id: 3,
    status_id: 1,
    start_time: '2026-07-21T10:00:00-04:00',
    end_time: '2026-07-21T10:45:00-04:00',
  } as Booking;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates and updates clients from Resource envelopes', () => {
    let created: Client | undefined;
    let updated: Client | undefined;

    service.createClient({ first_name: 'Ana', email: client.email }).subscribe((value) => (created = value));
    const create = http.expectOne(`${apiUrl}/clients`);
    expect(create.request.method).toBe('POST');
    create.flush({ data: client });

    service.updateClient(client.id, { phone: '+56998765432' }).subscribe((value) => (updated = value));
    const update = http.expectOne(`${apiUrl}/clients/${client.id}`);
    expect(update.request.method).toBe('PATCH');
    update.flush({ data: { ...client, phone: '+56998765432' } });

    expect(created).toEqual(client);
    expect(updated?.phone).toBe('+56998765432');
  });

  it('creates, edits and cancels bookings from Resource envelopes', () => {
    const results: Booking[] = [];

    service.createBooking({
      client_id: 8,
      location_id: 2,
      service_id: 3,
      status_id: 1,
      start_time: booking.start_time,
    }).subscribe((value) => results.push(value));
    const create = http.expectOne(`${apiUrl}/bookings`);
    expect(create.request.method).toBe('POST');
    create.flush({ data: booking });

    service.updateBooking(booking.id, { notes: 'Reagendada' }).subscribe((value) => results.push(value));
    const update = http.expectOne(`${apiUrl}/bookings/${booking.id}`);
    expect(update.request.method).toBe('PATCH');
    update.flush({ data: { ...booking, notes: 'Reagendada' } });

    service.cancelBooking(booking.id).subscribe((value) => results.push(value));
    const cancel = http.expectOne(`${apiUrl}/bookings/${booking.id}/cancel`);
    expect(cancel.request.method).toBe('PATCH');
    cancel.flush({ data: { ...booking, status_id: 7 } });

    expect(results).toHaveLength(3);
    expect(results[1].notes).toBe('Reagendada');
    expect(results[2].status_id).toBe(7);
  });

  it('preserves collection pagination through getClientsPage', () => {
    let page: { data: Client[]; meta: { current_page: number; total: number } } | undefined;

    service.getClientsPage({ page: 2, per_page: 15 }).subscribe((value) => {
      page = value as typeof page;
    });
    const request = http.expectOne((req) =>
      req.url === `${apiUrl}/clients`
      && req.params.get('page') === '2'
      && req.params.get('per_page') === '15',
    );
    request.flush({
      data: [client],
      meta: { current_page: 2, from: 16, last_page: 3, per_page: 15, to: 30, total: 32 },
      links: { next: `${apiUrl}/clients?page=3` },
    });

    expect(page?.data).toEqual([client]);
    expect(page?.meta.current_page).toBe(2);
    expect(page?.meta.total).toBe(32);
  });

  it('forwards HTTP errors instead of returning local fallback data', () => {
    let receivedStatus: number | undefined;

    service.getClient(999).subscribe({ error: (error) => (receivedStatus = error.status) });
    const request = http.expectOne(`${apiUrl}/clients/999`);
    request.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

    expect(receivedStatus).toBe(404);
  });
});
