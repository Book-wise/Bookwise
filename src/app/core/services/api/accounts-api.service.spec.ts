import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AccountsApiService } from './accounts-api.service';
import { environment } from '@env/environment';
import { AccountSummary, UpdateAccountBillingData } from '@models';

describe('AccountsApiService', () => {
  let service: AccountsApiService;
  let httpMock: HttpTestingController;

  const account: AccountSummary = {
    id: 12,
    uuid: '01J',
    reference: 'BW-7K3M9Q',
    name: 'Kinesilk SpA',
    rut: '11.111.111-1',
    taxpayer_type: 'company',
    legal_name: 'Kinesilk Servicios SpA',
    sii_activity: { id: 612, code: '960200', description: 'PELUQUERÍA Y OTROS TRATAMIENTOS DE BELLEZA' },
    billing_email: 'facturacion@kinesilk.cl',
    billing_phone: '+56987524346',
    billing_address: 'Av. Siempre Viva 742',
    billing_region_id: 13,
    billing_comuna_id: 141,
    role: 'owner',
    membership_status: 'active',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('updateBillingData PATCHes /accounts/{id} with only the given fields', () => {
    const payload: UpdateAccountBillingData = { legal_name: 'Nueva SpA', sii_activity_id: 612 };

    service.updateBillingData(12, payload).subscribe((res) => {
      expect(res.message).toBe('Datos de facturación actualizados.');
      expect(res.data).toEqual(account);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/accounts/12`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    req.flush({ message: 'Datos de facturación actualizados.', data: account });
  });

  it('updateBillingData sends explicit nulls so a field can be cleared', () => {
    service.updateBillingData(12, { sii_activity_id: null }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/accounts/12`);
    expect(req.request.body).toEqual({ sii_activity_id: null });
    req.flush({ message: 'ok', data: account });
  });
});
