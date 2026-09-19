import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RolesApiService } from './roles-api.service';
import { environment } from '@env/environment';
import { Role } from '@models';

describe('RolesApiService', () => {
  let service: RolesApiService;
  let httpMock: HttpTestingController;

  const roles: Role[] = [
    { id: 1, slug: 'admin_general', name: 'Admin General', permissions: [] },
    { id: 2, slug: 'admin_local', name: 'Admin Local', permissions: [] },
    { id: 3, slug: 'recepcionista', name: 'Recepcionista', permissions: [] },
    { id: 4, slug: 'recepcionista_readonly', name: 'Recepcionista (solo lectura)', permissions: [] },
    { id: 5, slug: 'staff', name: 'Staff', permissions: [] },
    { id: 6, slug: 'staff_readonly', name: 'Staff (solo lectura)', permissions: [] },
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
      const response = { data: roles.filter((r) => selected.includes(r.slug)) };

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
