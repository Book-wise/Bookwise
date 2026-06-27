import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { BookingFormDialogComponent } from './booking-form-dialog.component';
import { ApiService } from '@services/api.service';
import { signal } from '@angular/core';
import { ReferenceStore } from '@core/stores/reference.store';
import { ClientDetailStore } from '@core/stores/client-detail.store';
import { LanguageService } from '@services/language.service';
import { HttpErrorService } from '@services/http-error.service';

import { MessageService } from 'primeng/api';
import { rutValidator } from '@shared/validators/rut.validator';
import type { NgForm } from '@angular/forms';
import type { Client } from '@models';

describe('BookingFormDialogComponent', () => {
  let component: BookingFormDialogComponent;
  let fixture: ComponentFixture<BookingFormDialogComponent>;

  /** Helper para setear señales del store mock (el tipo Signal<T> del SignalStore es readonly para TS) */
  function setRefSignal<T>(signal: import('@angular/core').Signal<T>, value: T) {
    (signal as unknown as import('@angular/core').WritableSignal<T>).set(value);
  }

  beforeEach(async () => {
    const apiServiceMock = {
      getClients: vi.fn().mockReturnValue(of([])),
      getServices: vi.fn().mockReturnValue(of([])),
      getPacks: vi.fn().mockReturnValue(of({ data: [] })),
      getProviders: vi.fn().mockReturnValue(of([])),
      getLocations: vi.fn().mockReturnValue(of([])),
      createClient: vi.fn().mockReturnValue(of({ id: 1, first_name: 'Test', last_name: 'Patient' })),
      // Required by bw-patient-card when rendered inside the form
      getClientPacks: vi.fn().mockReturnValue(of([])),
      getSales: vi.fn().mockReturnValue(of({ data: [], meta: {} })),
      getBookings: vi.fn().mockReturnValue(of({ data: [], meta: {} })),
    };

    const refStoreMock = {
      clients: signal([] as Client[]),
      locations: signal([]),
      services: signal([]),
      packs: signal([]),
      allLoaded: () => true,
      invalidateClients: vi.fn(),
      invalidateServices: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BookingFormDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ApiService, useValue: apiServiceMock },
        { provide: ReferenceStore, useValue: refStoreMock },
        ClientDetailStore,
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
        { provide: MessageService, useValue: { add: vi.fn() } },
        LanguageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingFormDialogComponent);
    component = fixture.componentInstance;
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
      const apiService = TestBed.inject(ApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };

      component.ngOnInit();
      component.ngOnDestroy();

      apiService.getClients.mockClear();
      (component as unknown as { precheckTrigger$: { next: (v: string) => void } }).precheckTrigger$.next('ana@test.com');
      await vi.advanceTimersByTimeAsync(400);

      expect(apiService.getClients).not.toHaveBeenCalled();
    });
  });

  describe('debounced similarity pre-check pipeline', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('calls getClients with the trigger term 400ms after precheckTrigger$ emits', async () => {
      const apiService = TestBed.inject(ApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      apiService.getClients.mockClear();
      apiService.getClients.mockReturnValue(of([]));

      component.ngOnInit();
      (component as unknown as { precheckTrigger$: { next: (v: string) => void } }).precheckTrigger$.next('ana@test.com');

      expect(apiService.getClients).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(400);

      expect(apiService.getClients).toHaveBeenCalledTimes(1);
      expect(apiService.getClients).toHaveBeenCalledWith({ search: 'ana@test.com' });
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
      const apiService = TestBed.inject(ApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      apiService.getClients.mockClear();
      apiService.getClients.mockReturnValue(of([]));

      component.newClient.email = '  ana@test.com  ';
      const email = fixture.debugElement.query(By.css('input[name="clientEmail"]')).nativeElement as HTMLInputElement;
      email.dispatchEvent(new Event('blur'));

      await vi.advanceTimersByTimeAsync(400);

      expect(apiService.getClients).toHaveBeenCalledTimes(1);
      expect(apiService.getClients).toHaveBeenCalledWith({ search: 'ana@test.com' });
    });

    it('does not call getClients for sub-threshold email (<5 chars)', async () => {
      const apiService = TestBed.inject(ApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      apiService.getClients.mockClear();
      apiService.getClients.mockReturnValue(of([]));

      component.newClient.email = 'a@b';
      const email = fixture.debugElement.query(By.css('input[name="clientEmail"]')).nativeElement as HTMLInputElement;
      email.dispatchEvent(new Event('blur'));

      await vi.advanceTimersByTimeAsync(400);

      expect(apiService.getClients).not.toHaveBeenCalled();
    });

    it('calls getClients after phone settles via ngModelChange + 400ms', async () => {
      const apiService = TestBed.inject(ApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      apiService.getClients.mockClear();
      apiService.getClients.mockReturnValue(of([]));

      const phoneValue = '+56912345678'; // 11 digits after stripping
      component.onPhoneChanged(phoneValue);

      await vi.advanceTimersByTimeAsync(400);

      expect(apiService.getClients).toHaveBeenCalledTimes(1);
      expect(apiService.getClients).toHaveBeenCalledWith({ search: phoneValue });
    });

    it('does not call getClients for sub-threshold phone (<6 digits)', async () => {
      const apiService = TestBed.inject(ApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      apiService.getClients.mockClear();
      apiService.getClients.mockReturnValue(of([]));

      component.onPhoneChanged('12345'); // 5 digits

      await vi.advanceTimersByTimeAsync(400);

      expect(apiService.getClients).not.toHaveBeenCalled();
    });

    it('fires only one getClients for the latest value on rapid re-blur', async () => {
      const apiService = TestBed.inject(ApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      apiService.getClients.mockClear();
      apiService.getClients.mockReturnValue(of([]));

      const email = fixture.debugElement.query(By.css('input[name="clientEmail"]')).nativeElement as HTMLInputElement;

      component.newClient.email = 'ana@test.com';
      email.dispatchEvent(new Event('blur'));

      await vi.advanceTimersByTimeAsync(200);

      component.newClient.email = 'ana2@test.com';
      email.dispatchEvent(new Event('blur'));

      await vi.advanceTimersByTimeAsync(400);

      expect(apiService.getClients).toHaveBeenCalledTimes(1);
      expect(apiService.getClients).toHaveBeenCalledWith({ search: 'ana2@test.com' });
    });

    it('no-ops when !showPatientPanel', async () => {
      const apiService = TestBed.inject(ApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      apiService.getClients.mockClear();
      apiService.getClients.mockReturnValue(of([]));

      component.showPatientPanel = false;
      component.onContactBlur('ana@test.com', 'email');

      await vi.advanceTimersByTimeAsync(400);

      expect(apiService.getClients).not.toHaveBeenCalled();
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
    let apiService: { createClient: ReturnType<typeof vi.fn>; getClients: ReturnType<typeof vi.fn> };
    let messageService: { add: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      apiService = TestBed.inject(ApiService) as unknown as typeof apiService;
      messageService = TestBed.inject(MessageService) as unknown as typeof messageService;
      apiService.createClient.mockClear();
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
      expect(apiService.createClient).not.toHaveBeenCalled();
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

      expect(apiService.createClient).toHaveBeenCalledTimes(1);
      expect(component.showSimilarDialog()).toBe(false);
      expect(component.similarClients()).toEqual([]);
    });
  });

  describe('pre-check in-flight at submit', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('clicking save while a pre-check is pending is blocked until it resolves', async () => {
      const apiService = TestBed.inject(ApiService) as unknown as { getClients: ReturnType<typeof vi.fn>; createClient: ReturnType<typeof vi.fn> };
      apiService.getClients.mockClear();
      apiService.createClient.mockClear();

      const candidate = makeClient({ id: 99, email: 'pending@test.com' });
      apiService.getClients.mockReturnValue(of([candidate]));

      component.ngOnInit();
      component.showPatientPanel = true;
      component.newClient = { first_name: 'Pend', last_name: 'Ing', email: 'pending@test.com', phone: '', rut: '' };

      component.onContactBlur('pending@test.com', 'email');
      expect(component.precheckPending()).toBe(true);

      component.saveClient();
      expect(apiService.createClient).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(400);

      expect(component.precheckPending()).toBe(false);
      expect(component.showSimilarDialog()).toBe(true);
    });

    it('an invalid-form save attempt does not block a later legitimate pre-check result', async () => {
      const apiService = TestBed.inject(ApiService) as unknown as { getClients: ReturnType<typeof vi.fn>; createClient: ReturnType<typeof vi.fn> };
      apiService.getClients.mockClear();
      apiService.createClient.mockClear();

      const candidate = makeClient({ id: 100, email: 'late@test.com' });
      apiService.getClients.mockReturnValue(of([candidate]));

      component.ngOnInit();
      component.showPatientPanel = true;
      component.newClient = { first_name: 'Late', last_name: 'Result', email: 'late@test.com', phone: '', rut: '' };

      (component as unknown as { precheckTrigger$: { next: (v: string) => void } }).precheckTrigger$.next('late@test.com');

      const invalidForm = {
        form: { markAllAsTouched: vi.fn() },
        invalid: true,
      } as unknown as NgForm;

      component.saveClient(invalidForm);

      expect(apiService.createClient).not.toHaveBeenCalled();
      expect((component as unknown as { saveInProgress: boolean }).saveInProgress).toBe(false);

      await vi.advanceTimersByTimeAsync(400);

      expect(component.showSimilarDialog()).toBe(true);
    });
  });

  describe('single-page candidate set', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('does not issue a paginated getClients call during pre-check', async () => {
      const apiService = TestBed.inject(ApiService) as unknown as { getClients: ReturnType<typeof vi.fn> };
      apiService.getClients.mockClear();
      apiService.getClients.mockReturnValue(of([]));

      component.ngOnInit();
      component.showPatientPanel = true;
      component.onContactBlur('ana@test.com', 'email');

      await vi.advanceTimersByTimeAsync(400);

      expect(apiService.getClients).toHaveBeenCalledTimes(1);
      const [callArgs] = apiService.getClients.mock.calls[0];
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
});
