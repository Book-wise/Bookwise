import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { BlockedSlotsApiService } from './blocked-slots-api.service';
import { environment } from '@env/environment';
import { BlockedSlot, BlockConflictResponse } from '@models';

describe('BlockedSlotsApiService', () => {
  let service: BlockedSlotsApiService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BlockedSlotsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /blocked-slots via getBlockedSlots()', () => {
    const params = { date_from: '2024-01-01', date_to: '2024-01-07', location_id: 1 };
    const response = { data: [{ id: 1, start_time: '2024-01-01T09:00:00', end_time: '2024-01-01T10:00:00' }] as BlockedSlot[] };

    service.getBlockedSlots(params).subscribe((res) => {
      expect(res).toEqual(response);
    });

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/blocked-slots`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('date_from')).toBe('2024-01-01');
    expect(req.request.params.get('date_to')).toBe('2024-01-07');
    expect(req.request.params.get('location_id')).toBe('1');
    req.flush(response);
  });

  it('POST /blocked-slots via createBlockedSlot()', () => {
    const body = {
      start_time: '2024-01-01T09:00:00',
      end_time: '2024-01-01T10:00:00',
      reason: 'Mantención',
      scope: 'all' as const,
      provider_id: null,
      location_id: null,
    };
    const response: Partial<BlockConflictResponse> = {
      blocked: [1, 2],
      conflicts: [],
    };

    service.createBlockedSlot(body).subscribe((res) => {
      expect(res).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/blocked-slots`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(response);
  });

  it('GET /blocked-slots via getBlockedSlots() without optional params', () => {
    const params = { date_from: '2024-01-01', date_to: '2024-01-07' };

    service.getBlockedSlots(params).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/blocked-slots`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('date_from')).toBe('2024-01-01');
    expect(req.request.params.get('date_to')).toBe('2024-01-07');
    expect(req.request.params.get('location_id')).toBeNull();
    expect(req.request.params.get('provider_id')).toBeNull();
    req.flush({ data: [] });
  });

  it('PATCH /blocked-slots/:id via updateBlockedSlot()', () => {
    const body = { start_time: '2024-01-01T10:00:00', end_time: '2024-01-01T11:00:00', reason: 'Actualizado' };
    const response: BlockedSlot = { id: 1, start_time: '2024-01-01T10:00:00', end_time: '2024-01-01T11:00:00', reason: 'Actualizado' };

    service.updateBlockedSlot(1, body).subscribe((res) => {
      expect(res).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/blocked-slots/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(body);
    req.flush(response);
  });

  it('DELETE /blocked-slots/:id via deleteBlockedSlot()', () => {
    service.deleteBlockedSlot(1).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/blocked-slots/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('DELETE /blocked-slots/group/:groupId via deleteBlockedSlotGroup()', () => {
    service.deleteBlockedSlotGroup('group-abc').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/blocked-slots/group/group-abc`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
