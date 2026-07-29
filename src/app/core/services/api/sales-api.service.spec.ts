import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { SalesApiService } from './sales-api.service';
import { environment } from '@env/environment';
import { Sale, SaleDetailResponse, CreateSaleRequest, UpdateSaleRequest, CreateTransactionRequest, CreateTransactionResponse, TransactionListResponse, DeleteTransactionResponse, PaginatedResponse } from '@models';

describe('SalesApiService', () => {
  let service: SalesApiService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SalesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /sales via getSales() without params', () => {
    const dummy: PaginatedResponse<Sale> = {
      data: [],
      meta: { current_page: 1, from: null as unknown as number, last_page: 1, per_page: 10, to: null as unknown as number, total: 0 },
    };

    service.getSales().subscribe((data) => {
      expect(data).toEqual(dummy);
    });

    const req = httpMock.expectOne(`${baseUrl}/sales`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush(dummy);
  });

  it('GET /sales via getSales() with params', () => {
    service.getSales({ payment_status: 'paid', client_id: 1 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/sales`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('payment_status')).toBe('paid');
    expect(req.request.params.get('client_id')).toBe('1');
    req.flush({ data: [], meta: { current_page: 1, from: null, last_page: 1, per_page: 10, to: null, total: 0 } });
  });

  it('GET /sales/:id via getSale()', () => {
    const response: SaleDetailResponse = {
      data: {
        id: 1,
        total: 15000,
        paid_amount: 15000,
        remaining_amount: 0,
        payment_status: 'paid',
        transactions: [],
      } as Sale,
    };

    service.getSale(1).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/sales/1`);
    expect(req.request.method).toBe('GET');
    req.flush(response);
  });

  it('POST /sales via createSale()', () => {
    const payload: CreateSaleRequest = { booking_id: 1 };
    const response: SaleDetailResponse = {
      data: {
        id: 1,
        total: 15000,
        paid_amount: 0,
        remaining_amount: 15000,
        payment_status: 'unpaid',
        transactions: [],
      } as Sale,
    };

    service.createSale(payload).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/sales`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(response);
  });

  it('PATCH /sales/:id via updateSale()', () => {
    const payload: UpdateSaleRequest = { total: 20000 };
    const response: SaleDetailResponse = {
      data: { id: 1, total: 20000, paid_amount: 0, remaining_amount: 20000, payment_status: 'unpaid', transactions: [] } as Sale,
    };

    service.updateSale(1, payload).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/sales/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush(response);
  });

  it('GET /sales/:id/transactions via getTransactions()', () => {
    const response: TransactionListResponse = {
      data: [{ id: 1, amount: 15000, payment_method: 'cash', paid_at: '2024-01-01T10:00:00', created_at: '2024-01-01T10:00:00' }],
      sale: { total: 15000, paid_amount: 15000, remaining_amount: 0, payment_status: 'paid' },
    };

    service.getTransactions(1).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/sales/1/transactions`);
    expect(req.request.method).toBe('GET');
    req.flush(response);
  });

  it('POST /sales/:id/transactions via createTransaction()', () => {
    const body = { amount: 15000, payment_method: 'cash' };
    const response: CreateTransactionResponse = {
      data: { id: 1, amount: 15000, payment_method: 'cash', paid_at: '2024-01-01T10:00:00', created_at: '2024-01-01T10:00:00' },
      sale: { total: 15000, paid_amount: 15000, remaining_amount: 0, payment_status: 'paid' },
    };

    service.createTransaction(1, body).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/sales/1/transactions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(response);
  });

  it('DELETE /sales/:id/transactions/:tid via deleteTransaction()', () => {
    const response: DeleteTransactionResponse = {
      message: 'Transaction deleted',
      sale: { total: 0, paid_amount: 0, remaining_amount: 0, payment_status: 'unpaid' },
    };

    service.deleteTransaction(1, 5).subscribe((data) => {
      expect(data).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/sales/1/transactions/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush(response);
  });
});
