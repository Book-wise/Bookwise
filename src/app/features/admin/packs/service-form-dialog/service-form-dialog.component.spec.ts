import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { FormGroup } from '@angular/forms';
import { ServiceFormDialogComponent, suggestTermForSessions } from './service-form-dialog.component';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { ServicesApiService } from '@services/api/services-api.service';
import type { Service, ServiceVariation } from '@models';

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    name: 'Kinesiología general',
    duration_minutes: 60,
    price: '25000',
    active: true,
    status: 'active',
    ...overrides,
  } as Service;
}

function makeVariation(overrides: Partial<ServiceVariation> = {}): ServiceVariation {
  return {
    id: 10,
    term: '3 sesiones',
    total_sessions: 3,
    price: '67500',
    active: true,
    ...overrides,
  };
}

describe('suggestTermForSessions', () => {
  it('sugiere «1 sesion» (sin tilde) para una sesión y «n sesiones» para el resto', () => {
    expect(suggestTermForSessions(1)).toBe('1 sesion');
    expect(suggestTermForSessions(3)).toBe('3 sesiones');
    expect(suggestTermForSessions(6)).toBe('6 sesiones');
  });

  it('devuelve cadena vacía para valores inválidos', () => {
    expect(suggestTermForSessions(0)).toBe('');
    expect(suggestTermForSessions(Number.NaN)).toBe('');
  });
});

describe('ServiceFormDialogComponent', () => {
  let fixture: ComponentFixture<ServiceFormDialogComponent>;
  let component: ServiceFormDialogComponent;
  let servicesApi: {
    getService: ReturnType<typeof vi.fn>;
    createService: ReturnType<typeof vi.fn>;
    updateService: ReturnType<typeof vi.fn>;
    uploadServiceImage: ReturnType<typeof vi.fn>;
  };
  let messageAdd: ReturnType<typeof vi.fn>;
  let httpErrorHandle: ReturnType<typeof vi.fn>;

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ServiceFormDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ServicesApiService, useValue: servicesApi },
        { provide: HttpErrorService, useValue: { handle: httpErrorHandle } },
        { provide: MessageService, useValue: { add: messageAdd } },
        {
          provide: LanguageService,
          useValue: { t: (key: string) => key, has: () => true, lang: () => 'es' },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ServiceFormDialogComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    messageAdd = vi.fn();
    httpErrorHandle = vi.fn();
    servicesApi = {
      getService: vi.fn(() => of(makeService())),
      createService: vi.fn(() => of(makeService())),
      updateService: vi.fn(() => of(makeService())),
      uploadServiceImage: vi.fn(() => of({ image_url: '/img.jpg', image_thumb_url: '/thumb.jpg' })),
    };
  });

  beforeEach(async () => {
    await setup();
  });

  function open(mode: 'create' | 'edit', service: Service | null): void {
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('service', service);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  }

  function fillValidBasics(): void {
    component.form.patchValue({
      name: 'Servicio de prueba',
      durationMinutes: 60,
      price: 25000,
      status: 'active',
    });
  }

  function addVariationWith(
    values: Partial<{ term: string; totalSessions: number; price: number; compareAtPrice: number | null }>,
  ): FormGroup {
    component.addVariation();
    const group = component.variations.at(component.variations.length - 1);
    group.patchValue(values);
    return group;
  }

  // ── Contrato de payload ────────────────────────────────────────────────────

  it('en create el payload no lleva id en las variaciones', () => {
    servicesApi.createService.mockReturnValue(of(makeService({ id: 9 })));
    open('create', null);

    fillValidBasics();
    addVariationWith({ term: '3 sesiones', totalSessions: 3, price: 67500 });
    fixture.detectChanges();
    component.onSave();

    expect(servicesApi.createService).toHaveBeenCalledTimes(1);
    const payload = servicesApi.createService.mock.calls[0][0];
    expect(payload.variations).toHaveLength(1);
    expect(payload.variations[0].id).toBeUndefined();
    expect(payload.variations[0].term).toBe('3 sesiones');
  });

  it('en edit el payload sí lleva el id de las variaciones existentes (sync por id)', () => {
    servicesApi.updateService.mockReturnValue(of(makeService({ id: 5 })));
    open(
      'edit',
      makeService({
        id: 5,
        variations: [makeVariation({ id: 21, term: '3 sesiones', total_sessions: 3, price: '67500' })],
      }),
    );

    component.onSave();

    expect(servicesApi.updateService).toHaveBeenCalledTimes(1);
    const [id, payload] = servicesApi.updateService.mock.calls[0];
    expect(id).toBe(5);
    expect(payload.variations).toHaveLength(1);
    expect(payload.variations[0].id).toBe(21);
  });

  // ── Validación de descuento ────────────────────────────────────────────────

  it('bloquea el submit y muestra el error cuando compare_at_price <= price', () => {
    open('create', null);
    fillValidBasics();
    const group = addVariationWith({
      term: '3 sesiones',
      totalSessions: 3,
      price: 67500,
      compareAtPrice: 60000,
    });
    fixture.detectChanges();

    expect(group.hasError('compareAtInvalid')).toBe(true);
    expect(component.compareAtError(0)).toBe('packs.form.error.compare_at_price');

    component.onSave();
    expect(servicesApi.createService).not.toHaveBeenCalled();
  });

  // ── Términos: agregar/borrar y precio por sesión ───────────────────────────

  it('agregar y borrar un término actualiza el array y el precio por sesión', () => {
    open('create', null);

    expect(component.variations.length).toBe(0);

    component.addVariation();
    component.addVariation();
    expect(component.variations.length).toBe(2);

    const first = component.variations.at(0);
    first.patchValue({ totalSessions: 3, price: 67500 });
    fixture.detectChanges();
    expect(component.variationPerSession(0)).toBe(22500);

    component.removeVariation(1);
    expect(component.variations.length).toBe(1);
  });

  it('confirma antes de borrar un término existente (con id) y no borra al cancelar', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    open('edit', makeService({ id: 5, variations: [makeVariation({ id: 21 })] }));

    component.removeVariation(0);

    expect(confirmSpy).toHaveBeenCalled();
    expect(component.variations.length).toBe(1);

    confirmSpy.mockRestore();
  });

  // ── Transiciones de estado ─────────────────────────────────────────────────

  it('en draft no ofrece inactive como transición', () => {
    open('edit', makeService({ id: 5, status: 'draft', active: false, variations: [] }));

    const values = component.statusOptions().map((o) => o.value);

    expect(values).toEqual(['draft', 'active']);
    expect(values).not.toContain('inactive');
    expect(component.activeState()).toBe(false);
  });

  it('en active ofrece active e inactive (no draft)', () => {
    open('edit', makeService({ id: 5, status: 'active', variations: [] }));

    expect(component.statusOptions().map((o) => o.value)).toEqual(['active', 'inactive']);
  });

  // ── Imagen (después de guardar los datos) ──────────────────────────────────

  it('en edit sube la imagen después de guardar los datos', () => {
    servicesApi.updateService.mockReturnValue(of(makeService({ id: 5 })));
    const savedSpy = vi.spyOn(component.saved, 'emit');
    open('edit', makeService({ id: 5, variations: [] }));

    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    component.selectedFile.set(file);

    component.onSave();

    expect(servicesApi.updateService).toHaveBeenCalledTimes(1);
    expect(servicesApi.uploadServiceImage).toHaveBeenCalledWith(5, file);
    expect(savedSpy).toHaveBeenCalledTimes(1);
  });

  it('en create el selector de imagen queda deshabilitado', () => {
    open('create', null);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#svc-image') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('rechaza archivos que no sean jpg/png/webp', () => {
    open('edit', makeService({ id: 5, variations: [] }));

    const input = { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })] } as unknown as HTMLInputElement;
    component.onFileChange({ target: input } as unknown as Event);

    expect(component.selectedFile()).toBeNull();
    expect(component.imageError()).toBe('packs.form.image.error_type');
  });

  it('ante un error de guardado no emite saved y delega en httpError', () => {
    servicesApi.updateService.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { error: 'pack_discount_invalid' } })),
    );
    const savedSpy = vi.spyOn(component.saved, 'emit');
    open('edit', makeService({ id: 5, variations: [] }));

    component.onSave();

    expect(httpErrorHandle).toHaveBeenCalled();
    expect(savedSpy).not.toHaveBeenCalled();
    expect(component.saving()).toBe(false);
  });
});
