import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { BookingFormDialogComponent } from './booking-form-dialog.component';
import { ClientsApiService } from '@services/api/clients-api.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { ServicesApiService } from '@services/api/services-api.service';
import { signal } from '@angular/core';
import { ReferenceStore } from '@core/stores/reference.store';
import { ServicesStore } from '@core/stores/services.store';
import { ClientDetailStore } from '@core/stores/client-detail.store';
import { LanguageService } from '@services/language.service';
import { HttpErrorService } from '@services/http-error.service';

import { MessageService } from 'primeng/api';
import { rutValidator } from '@shared/validators/rut.validator';
import type { NgForm } from '@angular/forms';
import type { Client, ClientPack, Provider } from '@models';

describe('BookingFormDialogComponent', () => {
  let component: BookingFormDialogComponent;
  let fixture: ComponentFixture<BookingFormDialogComponent>;

  /** Helper para setear señales del store mock (el tipo Signal<T> del SignalStore es readonly para TS) */
  function setRefSignal<T>(signal: import('@angular/core').Signal<T>, value: T) {
    (signal as unknown as import('@angular/core').WritableSignal<T>).set(value);
  }

  let refStoreMock: any;
  let servicesStoreMock: any;

  beforeEach(async () => {
    const clientsApi = { getClients: vi.fn().mockReturnValue(of([])), createClient: vi.fn().mockReturnValue(of({ id: 1, first_name: 'Test', last_name: 'Patient' })), getClientPacks: vi.fn().mockReturnValue(of([])) } as any;
    const providersApi = { getProviders: vi.fn().mockReturnValue(of([])) } as any;
    const bookingsApi = { updateBooking: vi.fn(), createBooking: vi.fn(), getBookings: vi.fn().mockReturnValue(of({ data: [], meta: {} })) } as any;
    const servicesApi = { createService: vi.fn() } as any;

    refStoreMock = {
      clients: signal([] as Client[]),
      locations: signal([]),
      services: signal([]),
      packs: signal([]),
      allLoaded: () => true,
      invalidateClients: vi.fn(),
    };

    servicesStoreMock = {
      services: refStoreMock.services,
      packs: refStoreMock.packs,
      loaded: () => ({ services: true, packs: true }),
      invalidateServices: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BookingFormDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClientsApiService, useValue: clientsApi },
        { provide: ProvidersApiService, useValue: providersApi },
        { provide: BookingsApiService, useValue: bookingsApi },
        { provide: ServicesApiService, useValue: servicesApi },
        { provide: ReferenceStore, useValue: refStoreMock },
        { provide: ServicesStore, useValue: servicesStoreMock },
        ClientDetailStore,
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
        { provide: MessageService, useValue: { add: vi.fn() } },
        LanguageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingFormDialogComponent);
    component = fixture.componentInstance;
  });

  describe('visibilidad de servicios en el selector', () => {
    const activeService = { id: 1, name: 'Kinesiología', duration_minutes: 60, price: '25000', active: true };
    const inactiveService = { id: 2, name: 'Servicio retirado', duration_minutes: 45, price: '30000', active: false };
    const activePack = { id: 10, service_id: 1, name: 'Pack 3', total_sessions: 3, price: '67500', active: true };
    const inactivePack = { id: 11, service_id: 1, name: 'Pack viejo', total_sessions: 6, price: '120000', active: false };

    it('no ofrece servicios inactivos', () => {
      refStoreMock.services.set([activeService, inactiveService] as never);

      const values = component.serviceOptions().map((o) => o.value);

      expect(values).toContain('svc_1');
      expect(values).not.toContain('svc_2');
    });

    it('no ofrece packs (las variaciones se eligen en el paso Variación)', () => {
      refStoreMock.packs.set([activePack, inactivePack] as never);

      const values = component.serviceOptions().map((o) => o.value);

      expect(values).not.toContain('pack_10');
      expect(values).not.toContain('pack_11');
    });

    it('mantiene visible el servicio inactivo de la reserva que se edita', () => {
      refStoreMock.services.set([activeService, inactiveService] as never);

      component.openNew({ id: 99, service_id: 2, service_pack_id: null, price: 30000 } as never);

      const values = component.serviceOptions().map((o) => o.value);
      expect(values).toContain('svc_2');
      expect(component.selectedServiceKey).toBe('svc_2');
    });
  });

  describe('panel toggling (mutual exclusion)', () => {
    it('opening the patient panel closes the service panel', () => {
      component.showServicePanel = true;
      component.showPatientPanel = false;

      component.openPatientPanel();

      expect(component.showPatientPanel).toBe(true);
      expect(component.showServicePanel).toBe(false);
    });

    it('opening the service panel closes the patient panel', () => {
      component.showPatientPanel = true;
      component.showServicePanel = false;

      component.openServicePanel();

      expect(component.showServicePanel).toBe(true);
      expect(component.showPatientPanel).toBe(false);
    });
  });

  describe('resetForm()', () => {
    it('resets newClient back to its initial empty state', () => {
      component.newClient = { first_name: 'Juan', last_name: 'Perez', email: 'juan@test.com', phone: '+56912345678', rut: '12.345.678-5' };
      component.showPatientPanel = true;

      // resetForm is private; exercise it via the public onClose() entrypoint
      component.onClose();

      expect(component.newClient).toEqual({ first_name: '', last_name: '', email: '', phone: '', rut: '' });
      expect(component.showPatientPanel).toBe(false);
    });

    it('clears a stale similar-patients picker left open from a previous booking', () => {
      component.similarClients.set([makeClient({ id: 7 })]);
      component.showSimilarDialog.set(true);
      component.selectedClientOption.set(7);

      // resetForm is private; exercise it via the public onClose() entrypoint
      component.onClose();

      expect(component.similarClients()).toEqual([]);
      expect(component.showSimilarDialog()).toBe(false);
      expect(component.selectedClientOption()).toBe('new');
    });
  });

  describe('rutValidator()', () => {
    const validator = rutValidator();

    it('accepts an empty value', () => {
      expect(validator({ value: '' } as never)).toBeNull();
    });

    it('accepts a valid RUT (correct check digit)', () => {
      // 12345678-5 is a valid RUT check digit
      expect(validator({ value: '12345678-5' } as never)).toBeNull();
    });

    it('rejects an invalid RUT (incorrect check digit)', () => {
      expect(validator({ value: '12345678-9' } as never)).toEqual({ rut: true });
    });
  });

  describe('patient panel validity indicator', () => {
    beforeEach(async () => {
      component.visible = true;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    function getIndicator(): HTMLElement {
      return fixture.debugElement.query(By.css('.validity-indicator')).nativeElement as HTMLElement;
    }

    it('shows the warning icon and is not marked is-valid when the patient form is invalid', async () => {
      // patientForm starts empty -> invalid (required fields empty)
      fixture.detectChanges();
      await fixture.whenStable();

      const indicator = getIndicator();
      expect(indicator.classList.contains('is-valid')).toBe(false);
      expect(indicator.classList.contains('pi-exclamation-triangle')).toBe(true);
      expect(indicator.classList.contains('pi-check')).toBe(false);
    });

    it('shows the check icon and is marked is-valid when the patient form is valid', async () => {
      const firstName = fixture.debugElement.query(By.css('input[name="firstName"]')).nativeElement as HTMLInputElement;
      const lastName  = fixture.debugElement.query(By.css('input[name="lastName"]')).nativeElement as HTMLInputElement;
      const email     = fixture.debugElement.query(By.css('input[name="clientEmail"]')).nativeElement as HTMLInputElement;

      firstName.value = 'Juan';
      firstName.dispatchEvent(new Event('input'));
      lastName.value = 'Perez';
      lastName.dispatchEvent(new Event('input'));
      email.value = 'juan@test.com';
      email.dispatchEvent(new Event('input'));

      // Phone is a custom component (bw-phone-input) bound via ngModel; set directly on the model.
      component.newClient.phone = '+56912345678';

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();

      const indicator = getIndicator();
      expect(indicator.classList.contains('is-valid')).toBe(true);
      expect(indicator.classList.contains('pi-check')).toBe(true);
      expect(indicator.classList.contains('pi-exclamation-triangle')).toBe(false);
    });
  });

  describe('patient panel inline validation messages', () => {
    beforeEach(async () => {
      component.visible = true;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('does not show required-field errors before the fields are touched', () => {
      fixture.detectChanges();
      const errors = fixture.debugElement.queryAll(By.css('.field-error'));
      expect(errors.length).toBe(0);
    });

    it('shows required-field errors once a field is touched and left empty', async () => {
      const firstName = fixture.debugElement.query(By.css('input[name="firstName"]')).nativeElement as HTMLInputElement;

      firstName.dispatchEvent(new Event('focus'));
      firstName.dispatchEvent(new Event('blur'));

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const errors = fixture.debugElement.queryAll(By.css('.field-error'));
      const texts = errors.map((e) => (e.nativeElement as HTMLElement).textContent?.trim());
      expect(texts).toContain(component['lang'].t('patient.error.first_name_required'));
    });

    it('hides the required-field error once the field becomes valid', async () => {
      const firstName = fixture.debugElement.query(By.css('input[name="firstName"]')).nativeElement as HTMLInputElement;

      firstName.dispatchEvent(new Event('focus'));
      firstName.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();

      firstName.value = 'Juan';
      firstName.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const errors = fixture.debugElement.queryAll(By.css('.field-error'));
      const texts = errors.map((e) => (e.nativeElement as HTMLElement).textContent?.trim());
      expect(texts).not.toContain(component['lang'].t('patient.error.first_name_required'));
    });

    it('does not show a RUT error when the RUT field is empty, even if touched', async () => {
      const rut = fixture.debugElement.query(By.css('input[name="rut"]')).nativeElement as HTMLInputElement;

      rut.dispatchEvent(new Event('focus'));
      rut.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const errors = fixture.debugElement.queryAll(By.css('.field-error'));
      const texts = errors.map((e) => (e.nativeElement as HTMLElement).textContent?.trim());
      expect(texts).not.toContain(component['lang'].t('patient.error.rut_invalid'));
    });

    it('shows a RUT error when the RUT field has an invalid non-empty value', async () => {
      const rut = fixture.debugElement.query(By.css('input[name="rut"]')).nativeElement as HTMLInputElement;

      rut.value = '12345678-9'; // wrong check digit
      rut.dispatchEvent(new Event('input'));
      rut.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const errors = fixture.debugElement.queryAll(By.css('.field-error'));
      const texts = errors.map((e) => (e.nativeElement as HTMLElement).textContent?.trim());
      expect(texts).toContain(component['lang'].t('patient.error.rut_invalid'));
    });
  });

  // ── Patient duplicate detection (similar-clients pre-check) ────────────────

  function makeClient(overrides: Partial<Client> = {}): Client {
    return {
      id: 42,
      first_name: 'Ana',
      last_name: 'Test',
      email: 'ana@test.com',
      phone: '+56912345678',
      active: true,
      ...overrides,
    } as Client;
  }

  describe('OnDestroy / teardown', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('completes destroy$ on ngOnDestroy and a late precheckTrigger$ emission does not call getClients', async () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };

      component.ngOnInit();
      component.ngOnDestroy();

      clientsApi.getClients.mockClear();
      (component as unknown as { precheckTrigger$: { next: (v: string) => void } }).precheckTrigger$.next('ana@test.com');
      await vi.advanceTimersByTimeAsync(400);

      expect(clientsApi.getClients).not.toHaveBeenCalled();
    });
  });

  describe('debounced similarity pre-check pipeline', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('calls getClients with the trigger term 400ms after precheckTrigger$ emits', async () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      clientsApi.getClients.mockClear();
      clientsApi.getClients.mockReturnValue(of([]));

      component.ngOnInit();
      (component as unknown as { precheckTrigger$: { next: (v: string) => void } }).precheckTrigger$.next('ana@test.com');

      expect(clientsApi.getClients).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(400);

      expect(clientsApi.getClients).toHaveBeenCalledTimes(1);
      expect(clientsApi.getClients).toHaveBeenCalledWith({ search: 'ana@test.com' });
    });
  });

  describe('onContactBlur trigger handlers', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      component.visible = true;
      component.showPatientPanel = true;
      fixture.detectChanges(); // triggers ngOnInit (subscribes precheckTrigger$ once)
      await fixture.whenStable();
      fixture.detectChanges();
    });
    afterEach(() => { vi.useRealTimers(); });

    it('calls getClients with trimmed email 400ms after email blur', async () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      clientsApi.getClients.mockClear();
      clientsApi.getClients.mockReturnValue(of([]));

      component.newClient.email = '  ana@test.com  ';
      const email = fixture.debugElement.query(By.css('input[name="clientEmail"]')).nativeElement as HTMLInputElement;
      email.dispatchEvent(new Event('blur'));

      await vi.advanceTimersByTimeAsync(400);

      expect(clientsApi.getClients).toHaveBeenCalledTimes(1);
      expect(clientsApi.getClients).toHaveBeenCalledWith({ search: 'ana@test.com' });
    });

    it('does not call getClients for sub-threshold email (<5 chars)', async () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      clientsApi.getClients.mockClear();
      clientsApi.getClients.mockReturnValue(of([]));

      component.newClient.email = 'a@b';
      const email = fixture.debugElement.query(By.css('input[name="clientEmail"]')).nativeElement as HTMLInputElement;
      email.dispatchEvent(new Event('blur'));

      await vi.advanceTimersByTimeAsync(400);

      expect(clientsApi.getClients).not.toHaveBeenCalled();
    });

    it('calls getClients after phone settles via ngModelChange + 400ms', async () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      clientsApi.getClients.mockClear();
      clientsApi.getClients.mockReturnValue(of([]));

      const phoneValue = '+56912345678'; // 11 digits after stripping
      component.onPhoneChanged(phoneValue);

      await vi.advanceTimersByTimeAsync(400);

      expect(clientsApi.getClients).toHaveBeenCalledTimes(1);
      expect(clientsApi.getClients).toHaveBeenCalledWith({ search: phoneValue });
    });

    it('does not call getClients for sub-threshold phone (<6 digits)', async () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      clientsApi.getClients.mockClear();
      clientsApi.getClients.mockReturnValue(of([]));

      component.onPhoneChanged('12345'); // 5 digits

      await vi.advanceTimersByTimeAsync(400);

      expect(clientsApi.getClients).not.toHaveBeenCalled();
    });

    it('fires only one getClients for the latest value on rapid re-blur', async () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      clientsApi.getClients.mockClear();
      clientsApi.getClients.mockReturnValue(of([]));

      const email = fixture.debugElement.query(By.css('input[name="clientEmail"]')).nativeElement as HTMLInputElement;

      component.newClient.email = 'ana@test.com';
      email.dispatchEvent(new Event('blur'));

      await vi.advanceTimersByTimeAsync(200);

      component.newClient.email = 'ana2@test.com';
      email.dispatchEvent(new Event('blur'));

      await vi.advanceTimersByTimeAsync(400);

      expect(clientsApi.getClients).toHaveBeenCalledTimes(1);
      expect(clientsApi.getClients).toHaveBeenCalledWith({ search: 'ana2@test.com' });
    });

    it('no-ops when !showPatientPanel', async () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      clientsApi.getClients.mockClear();
      clientsApi.getClients.mockReturnValue(of([]));

      component.showPatientPanel = false;
      component.onContactBlur('ana@test.com', 'email');

      await vi.advanceTimersByTimeAsync(400);

      expect(clientsApi.getClients).not.toHaveBeenCalled();
    });
  });

  describe('onPrecheckResult / picker visibility', () => {
    beforeEach(() => {
      component.ngOnInit();
      component.showPatientPanel = true;
    });

    it('opens picker with candidates and pre-selects "new"', () => {
      component.newClient.email = 'ana@test.com';
      const candidate = makeClient({ id: 7, email: 'ana@test.com' });

      component.onPrecheckResult([candidate]);

      expect(component.showSimilarDialog()).toBe(true);
      expect(component.selectedClientOption()).toBe('new');
      expect(component.similarClients().map(c => c.id)).toContain(7);
    });

    it('does not open picker when no candidates match', () => {
      component.newClient.email = 'ana@test.com';
      const candidate = makeClient({ id: 8, email: 'other@test.com', phone: '+5611111111' });

      component.onPrecheckResult([candidate]);

      expect(component.showSimilarDialog()).toBe(false);
      expect(component.similarClients()).toEqual([]);
    });

    it('merges and dedupes candidates across email and phone triggers', () => {
      component.newClient.email = 'ana@test.com';
      component.newClient.phone = '+56912345678';
      const candidate = makeClient({ id: 9, email: 'ana@test.com', phone: '+56912345678' });

      component.onPrecheckResult([candidate]);
      component.onPrecheckResult([candidate]);

      const ids = component.similarClients().map(c => c.id);
      expect(ids).toEqual([9]);
    });
  });

  describe('similar-patients picker resolution', () => {
    let clientsApi: { createClient: ReturnType<typeof vi.fn>; getClients: ReturnType<typeof vi.fn> };
    let messageService: { add: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      clientsApi = TestBed.inject(ClientsApiService) as unknown as typeof clientsApi;
      messageService = TestBed.inject(MessageService) as unknown as typeof messageService;
      clientsApi.createClient.mockClear();
      messageService.add.mockClear();

      component.visible = true;
      component.showPatientPanel = true;
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('Cancelar closes the dialog without side effects', () => {
      component.similarClients.set([makeClient({ id: 5 })]);
      component.showSimilarDialog.set(true);
      component.formData.client_id = 0;
      component.newClient = { first_name: 'Juan', last_name: 'Perez', email: 'juan@test.com', phone: '+56911112222', rut: '' };

      component.onSimilarCancel();

      expect(component.showSimilarDialog()).toBe(false);
      expect(component.similarClients()).toEqual([]);
      expect(component.formData.client_id).toBe(0);
      expect(component.showPatientPanel).toBe(true);
      expect(component.newClient).toEqual({ first_name: 'Juan', last_name: 'Perez', email: 'juan@test.com', phone: '+56911112222', rut: '' });
    });

    it('Cancelar resets selectedClientOption back to "new"', () => {
      component.similarClients.set([makeClient({ id: 42 })]);
      component.showSimilarDialog.set(true);
      component.selectedClientOption.set(42);

      component.onSimilarCancel();

      expect(component.selectedClientOption()).toBe('new');
    });

    it('selecting an existing client + Aceptar sets client_id, closes panel, no createClient, shows toast', () => {
      component.similarClients.set([makeClient({ id: 42 })]);
      component.showSimilarDialog.set(true);
      component.selectedClientOption.set(42);

      component.onSimilarAccept();

      expect(component.formData.client_id).toBe(42);
      expect(component.showPatientPanel).toBe(false);
      expect(component.newClient).toEqual({ first_name: '', last_name: '', email: '', phone: '', rut: '' });
      expect(clientsApi.createClient).not.toHaveBeenCalled();
      expect(messageService.add).toHaveBeenCalledWith(expect.objectContaining({
        severity: 'success',
        summary: component['lang'].t('toast.existing_client_assigned.summary'),
        detail: component['lang'].t('toast.existing_client_assigned.detail'),
      }));
      expect(component.showSimilarDialog()).toBe(false);
    });

    it('new-profile + Aceptar runs saveClient/createClient as today', async () => {
      component.newClient = { first_name: 'Juan', last_name: 'Perez', email: 'juan@test.com', phone: '+56911112222', rut: '' };
      component.similarClients.set([makeClient({ id: 42 })]);
      component.showSimilarDialog.set(true);
      component.selectedClientOption.set('new');

      const firstName = fixture.debugElement.query(By.css('input[name="firstName"]')).nativeElement as HTMLInputElement;
      firstName.value = 'Juan';
      firstName.dispatchEvent(new Event('input'));
      const lastName = fixture.debugElement.query(By.css('input[name="lastName"]')).nativeElement as HTMLInputElement;
      lastName.value = 'Perez';
      lastName.dispatchEvent(new Event('input'));
      const email = fixture.debugElement.query(By.css('input[name="clientEmail"]')).nativeElement as HTMLInputElement;
      email.value = 'juan@test.com';
      email.dispatchEvent(new Event('input'));

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();

      component.onSimilarAccept();

      expect(clientsApi.createClient).toHaveBeenCalledTimes(1);
      expect(component.showSimilarDialog()).toBe(false);
      expect(component.similarClients()).toEqual([]);
    });
  });

  describe('pre-check in-flight at submit', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('clicking save while a pre-check is pending is blocked until it resolves', async () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClients: ReturnType<typeof vi.fn>; createClient: ReturnType<typeof vi.fn> };
      clientsApi.getClients.mockClear();
      clientsApi.createClient.mockClear();

      const candidate = makeClient({ id: 99, email: 'pending@test.com' });
      clientsApi.getClients.mockReturnValue(of([candidate]));

      component.ngOnInit();
      component.showPatientPanel = true;
      component.newClient = { first_name: 'Pend', last_name: 'Ing', email: 'pending@test.com', phone: '', rut: '' };

      component.onContactBlur('pending@test.com', 'email');
      expect(component.precheckPending()).toBe(true);

      component.saveClient();
      expect(clientsApi.createClient).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(400);

      expect(component.precheckPending()).toBe(false);
      expect(component.showSimilarDialog()).toBe(true);
    });

    it('an invalid-form save attempt does not block a later legitimate pre-check result', async () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClients: ReturnType<typeof vi.fn>; createClient: ReturnType<typeof vi.fn> };
      clientsApi.getClients.mockClear();
      clientsApi.createClient.mockClear();

      const candidate = makeClient({ id: 100, email: 'late@test.com' });
      clientsApi.getClients.mockReturnValue(of([candidate]));

      component.ngOnInit();
      component.showPatientPanel = true;
      component.newClient = { first_name: 'Late', last_name: 'Result', email: 'late@test.com', phone: '', rut: '' };

      (component as unknown as { precheckTrigger$: { next: (v: string) => void } }).precheckTrigger$.next('late@test.com');

      const invalidForm = {
        form: { markAllAsTouched: vi.fn() },
        invalid: true,
      } as unknown as NgForm;

      component.saveClient(invalidForm);

      expect(clientsApi.createClient).not.toHaveBeenCalled();
      expect((component as unknown as { saveInProgress: boolean }).saveInProgress).toBe(false);

      await vi.advanceTimersByTimeAsync(400);

      expect(component.showSimilarDialog()).toBe(true);
    });
  });

  describe('single-page candidate set', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('does not issue a paginated getClients call during pre-check', async () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      clientsApi.getClients.mockClear();
      clientsApi.getClients.mockReturnValue(of([]));

      component.ngOnInit();
      component.showPatientPanel = true;
      component.onContactBlur('ana@test.com', 'email');

      await vi.advanceTimersByTimeAsync(400);

      expect(clientsApi.getClients).toHaveBeenCalledTimes(1);
      const [callArgs] = clientsApi.getClients.mock.calls[0];
      expect(callArgs).not.toHaveProperty('page');
      expect(callArgs).not.toHaveProperty('per_page');
    });
  });

  describe('similar_patients i18n keys', () => {
    it('resolves similar_patients.* and toast.existing_client_assigned.* in es and en', () => {
      const lang = component['lang'] as LanguageService;
      const keys = [
        'similar_patients.title',
        'similar_patients.subtitle',
        'similar_patients.new_profile_option',
        'similar_patients.cancel',
        'similar_patients.accept',
        'toast.existing_client_assigned.summary',
        'toast.existing_client_assigned.detail',
      ];

      for (const locale of ['es', 'en'] as const) {
        lang.setLang(locale);
        for (const key of keys) {
          expect(lang.t(key)).toBeTruthy();
          expect(lang.t(key)).not.toBe(key);
        }
      }
    });
  });

  describe('patient card integration', () => {
    it('selectedClientId() is null by default', () => {
      expect(component.selectedClientId()).toBeNull();
    });

    it('selectedClient() returns null when no clients are loaded', () => {
      expect(component.selectedClient()).toBeNull();
    });

    it('onClientChange() updates selectedClientId signal from formData.client_id', () => {
      setRefSignal(component.clients, [makeClient({ id: 42 })]);
      component.formData.client_id = 42;

      component.onClientChange();

      expect(component.selectedClientId()).toBe(42);
    });

    it('selectedClient() returns the matching Client object after onClientChange()', () => {
      const client = makeClient({ id: 7, first_name: 'Juan', last_name: 'Pérez' });
      setRefSignal(component.clients, [client]);
      component.formData.client_id = 7;

      component.onClientChange();

      expect(component.selectedClient()).toEqual(client);
    });

    it('selectedClient() returns null when clients list does not include the id', () => {
      setRefSignal(component.clients, [makeClient({ id: 1 })]);
      component.formData.client_id = 999;

      component.onClientChange();

      expect(component.selectedClient()).toBeNull();
    });

    it('onClientChange() with falsy client_id sets selectedClientId to null', () => {
      setRefSignal(component.clients, [makeClient({ id: 5 })]);
      component.formData.client_id = 5;
      component.onClientChange();
      expect(component.selectedClientId()).toBe(5);

      component.formData.client_id = 0;
      component.onClientChange();

      expect(component.selectedClientId()).toBeNull();
    });

    it('dialogTitle() returns "Reserva de Juan Pérez" when selectedClient() is non-null', () => {
      const client = makeClient({ id: 3, first_name: 'Juan', last_name: 'Pérez' });
      setRefSignal(component.clients, [client]);
      component.formData.client_id = 3;
      component.onClientChange();

      expect(component.dialogTitle()).toBe(component['lang'].t('booking_form.title.for_client', { name: 'Juan Pérez' }));
    });

    it('dialogTitle() returns create title when selectedClient() is null and not editing', () => {
      component.isEdit.set(false);
      // No client selected (default)
      expect(component.dialogTitle()).toBe(component['lang'].t('booking_form.title.create'));
    });

    it('dialogTitle() returns edit title when selectedClient() is null and in edit mode', () => {
      component.isEdit.set(true);
      // No client selected
      expect(component.dialogTitle()).toBe(component['lang'].t('booking_form.title.edit'));
    });

    it('bw-patient-card is absent from DOM when no client is selected', async () => {
      component.visible = true;
      fixture.detectChanges();
      await fixture.whenStable();

      const card = fixture.debugElement.query(By.css('bw-patient-card'));
      expect(card).toBeNull();
    });

    it('bw-patient-card appears when a valid client is selected via onClientChange()', async () => {
      component.visible = true;
      const client = makeClient({ id: 42 });
      setRefSignal(component.clients, [client]);
      component.formData.client_id = 42;
      component.onClientChange();

      fixture.detectChanges();
      await fixture.whenStable();

      const card = fixture.debugElement.query(By.css('bw-patient-card'));
      expect(card).not.toBeNull();
    });

    it('bw-patient-card is hidden again after onClientChange(0)', async () => {
      component.visible = true;
      const client = makeClient({ id: 42 });
      setRefSignal(component.clients, [client]);
      component.formData.client_id = 42;
      component.onClientChange();

      fixture.detectChanges();
      await fixture.whenStable();

      component.formData.client_id = 0;
      component.onClientChange();
      fixture.detectChanges();
      await fixture.whenStable();

      const card = fixture.debugElement.query(By.css('bw-patient-card'));
      expect(card).toBeNull();
    });
  });

  // ── D1: inactive providers excluded from new-booking selection ─────────────

  describe('providerOptions (D1 — inactive providers excluded from new-booking selection)', () => {
    const activeProvider = { id: 1, first_name: 'Ana', last_name: 'Activa', active: true } as Provider;
    const inactiveProvider = { id: 2, first_name: 'Bruno', last_name: 'Inactivo', active: false } as Provider;
    const inactiveAssigned = { id: 3, first_name: 'Carla', last_name: 'Inactiva', active: false } as Provider;
    const anotherActive = { id: 4, first_name: 'Diego', last_name: 'Activo', active: true } as Provider;

    function setProviders(list: Provider[]) {
      component.providers.set(list);
    }

    function optionValues(): Array<number | null> {
      return component.providerOptions().map((o) => o.value);
    }

    it('excludes inactive providers when creating a new booking (nothing selected)', () => {
      component.formData.provider_id = null;
      setProviders([activeProvider, inactiveProvider, inactiveAssigned]);

      expect(optionValues()).toEqual([null, 1]);
    });

    it('keeps active providers selectable in a new booking', () => {
      component.formData.provider_id = null;
      setProviders([activeProvider, inactiveProvider, anotherActive]);

      const options = component.providerOptions();
      expect(options.some((o) => o.value === 1 && o.label === 'Ana Activa')).toBe(true);
      expect(options.some((o) => o.value === 4 && o.label === 'Diego Activo')).toBe(true);
      expect(options.some((o) => o.value === 2)).toBe(false);
    });

    it('resolves an inactive assigned provider when editing a booking', () => {
      // Edición: la reserva apunta al provider inactivo id 3 — debe seguir figurando
      component.formData.provider_id = 3;
      setProviders([activeProvider, inactiveProvider, inactiveAssigned]);

      expect(optionValues()).toEqual([null, 1, 3]);
    });

    it('excludes inactive unassigned providers when editing a booking', () => {
      // Edición: el asignado (activo, id 1) resuelve; los inactivos no asignados quedan fuera
      component.formData.provider_id = 1;
      setProviders([activeProvider, inactiveProvider, inactiveAssigned, anotherActive]);

      expect(optionValues()).toEqual([null, 1, 4]);
    });
  });

  describe('servicio → variación (dos pasos)', () => {
    const activeService = { id: 1, name: 'Kinesiología', duration_minutes: 60, price: '25000', active: true };
    const otherService = { id: 2, name: 'Masaje', duration_minutes: 45, price: '20000', active: true };
    const inactiveService = { id: 3, name: 'Retirado', duration_minutes: 45, price: '30000', active: false };
    const pack1 = { id: 101, service_id: 1, name: '1 sesión', total_sessions: 1, price: '25000', active: true };
    const pack3 = { id: 103, service_id: 1, name: '3 sesiones', total_sessions: 3, price: '67500', active: true };
    const pack6 = { id: 106, service_id: 1, name: '6 sesiones', total_sessions: 6, price: '120000', active: true };
    const otherPack = { id: 201, service_id: 2, name: '3 sesiones masaje', total_sessions: 3, price: '50000', active: true };

    it('serviceOptions no ofrece packs y excluye servicios inactivos', () => {
      refStoreMock.services.set([activeService, inactiveService] as never);
      refStoreMock.packs.set([pack3] as never);

      const values = component.serviceOptions().map((o) => o.value);

      expect(values).toEqual(['svc_1']);
      expect(values).not.toContain('pack_103');
    });

    it('variationOptions devuelve variaciones activas del servicio ordenadas por sesiones', () => {
      refStoreMock.services.set([activeService, otherService] as never);
      refStoreMock.packs.set([pack6, pack1, otherPack, { ...pack3, active: false }] as never);
      component.selectedServiceId.set(1);

      const options = component.variationOptions();

      expect(options.map((o) => o.value)).toEqual(['term_101', 'term_106']);
      expect(options.map((o) => o.sessions)).toEqual([1, 6]);
    });

    it('servicio sin packs activos → variationOptions vacío', () => {
      refStoreMock.services.set([otherService] as never);
      refStoreMock.packs.set([pack3] as never);
      component.selectedServiceId.set(2);

      expect(component.variationOptions()).toEqual([]);
    });

    it('elegir una variación setea service_pack_id, price y duration_minutes del término', () => {
      refStoreMock.services.set([activeService] as never);
      refStoreMock.packs.set([pack1, pack3] as never);
      component.selectedServiceId.set(1);
      component.selectedVariationKey = 'term_103';

      component.onVariationChange();

      expect(component.formData.service_pack_id).toBe(103);
      expect(component.formData.price).toBe(67500);
      expect(component.formData.duration_minutes).toBe(60);
    });

    it('cambiar de servicio limpia service_pack_id y la variación elegida', () => {
      refStoreMock.services.set([activeService, otherService] as never);
      refStoreMock.packs.set([pack1, pack3, otherPack] as never);
      component.selectedServiceId.set(1);
      component.selectedVariationKey = 'term_103';
      component.formData.service_pack_id = 103;
      component.formData.price = 67500;
      component.selectedServiceKey = 'svc_2';

      component.onServiceChange();

      expect(component.formData.service_pack_id).toBeNull();
      expect(component.selectedVariationKey).toBe('');
      expect(component.formData.service_id).toBe(2);
    });
  });

  describe('badge de descuento por término', () => {
    const service = { id: 1, name: 'Kinesiología', duration_minutes: 60, price: '25000', active: true };
    const pack1 = { id: 101, service_id: 1, name: '1 sesión', total_sessions: 1, price: '25000', active: true };
    const pack3 = { id: 103, service_id: 1, name: '3 sesiones', total_sessions: 3, price: '67500', active: true };

    it('3 sesiones a $67.500 con 1 sesión a $25.000 ⇒ discountPercent 10', () => {
      refStoreMock.services.set([service] as never);
      refStoreMock.packs.set([pack1, pack3] as never);
      component.selectedServiceId.set(1);

      const option = component.variationOptions().find((o) => o.value === 'term_103');

      expect(option?.discountPercent).toBe(10);
      expect(option?.perSession).toBe(22500);
    });

    it('un término de 1 sesión ⇒ sin badge', () => {
      refStoreMock.services.set([service] as never);
      refStoreMock.packs.set([pack1] as never);
      component.selectedServiceId.set(1);

      const option = component.variationOptions().find((o) => o.value === 'term_101');

      expect(option?.discountPercent).toBe(0);
    });

    it('sin referencia válida ⇒ sin badge', () => {
      refStoreMock.services.set([{ ...service, price: '0' }] as never);
      refStoreMock.packs.set([pack3] as never);
      component.selectedServiceId.set(1);

      const option = component.variationOptions().find((o) => o.value === 'term_103');

      expect(option?.discountPercent).toBe(0);
    });
  });

  describe('resumen del pack del paciente', () => {
    const activeService = { id: 1, name: 'Kinesiología', duration_minutes: 60, price: '25000', active: true };
    const pack3 = { id: 103, service_id: 1, name: '3 sesiones', total_sessions: 3, price: '67500', active: true };

    function clientPack(overrides: Partial<ClientPack> = {}): ClientPack {
      return {
        id: 500,
        client_id: 42,
        service_pack_id: 103,
        total_sessions: 3,
        used_sessions: 1,
        remaining_sessions: 2,
        status: 'active',
        ...overrides,
      } as ClientPack;
    }

    it('con getClientPacks devolviendo un pack del servicio se muestra «1 de 3»', async () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClientPacks: ReturnType<typeof vi.fn> };
      clientsApi.getClientPacks.mockReturnValue(of([clientPack()]));

      refStoreMock.services.set([activeService] as never);
      refStoreMock.packs.set([pack3] as never);
      component['lang'].setLang('es');

      component.visible = true;
      fixture.detectChanges();
      await fixture.whenStable();

      component.formData.client_id = 42;
      component.selectedServiceId.set(1);
      component.onClientChange();
      fixture.detectChanges();
      await fixture.whenStable();

      const summary = fixture.debugElement.query(By.css('.paid-summary'));
      expect(summary).not.toBeNull();
      expect((summary.nativeElement as HTMLElement).textContent).toContain('1 de 3');
    });

    it('sin pack ⇒ no se muestra el resumen', async () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClientPacks: ReturnType<typeof vi.fn> };
      clientsApi.getClientPacks.mockReturnValue(of([]));

      refStoreMock.services.set([activeService] as never);
      refStoreMock.packs.set([pack3] as never);

      component.visible = true;
      fixture.detectChanges();
      await fixture.whenStable();

      component.formData.client_id = 42;
      component.selectedServiceId.set(1);
      component.onClientChange();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.debugElement.query(By.css('.paid-summary'))).toBeNull();
    });

    it('no re-consulta getClientPacks si el cliente no cambió', () => {
      const clientsApi = TestBed.inject(ClientsApiService) as unknown as { getClientPacks: ReturnType<typeof vi.fn> };
      clientsApi.getClientPacks.mockClear();
      clientsApi.getClientPacks.mockReturnValue(of([clientPack()]));

      refStoreMock.services.set([activeService] as never);
      refStoreMock.packs.set([pack3] as never);
      component.formData.client_id = 42;
      component.selectedServiceId.set(1);

      component.onClientChange();
      component.onServiceChange();

      expect(clientsApi.getClientPacks).toHaveBeenCalledTimes(1);
    });
  });
});
