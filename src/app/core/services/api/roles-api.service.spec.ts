import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RolesApiService } from './roles-api.service';
import { environment } from '@env/environment';
import { Role } from '@models';

describe('RolesApiService', () => {
  let service: RolesApiService;
  let httpMock: HttpTestingController;

  const roles: Role[] = [
    { id: 1, name: 'admin_general', label: 'Admin General' },
    { id: 2, name: 'admin_local', label: 'Admin Local' },
    { id: 3, name: 'recepcionista', label: 'Recepcionista' },
    { id: 4, name: 'recepcionista_readonly', label: 'Recepcionista (solo lectura)' },
    { id: 5, name: 'staff', label: 'Staff' },
    { id: 6, name: 'staff_readonly', label: 'Staff (solo lectura)' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(RolesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  describe('getRoles', () => {
    it('unwraps { data: Role[] }', () => {
      service.getRoles().subscribe((res) => {
        expect(res).toEqual(roles);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/roles`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: roles });
    });
  });

  describe('assignProviderRoles', () => {
    it('PATCHes /providers/{id}/roles with { roles: [...] } and returns the new set', () => {
      const selected = ['admin_local', 'recepcionista'];
      const response = { data: roles.filter((r) => selected.includes(r.name)) };

      service.assignProviderRoles(5, selected).subscribe((res) => {
        expect(res).toEqual(response);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/providers/5/roles`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ roles: selected });
      req.flush(response);
    });
  });
});
