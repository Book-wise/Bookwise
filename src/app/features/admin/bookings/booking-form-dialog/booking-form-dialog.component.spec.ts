import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { BookingFormDialogComponent } from './booking-form-dialog.component';
import { ApiService } from '@services/api.service';
import { DataCacheService } from '@services/data-cache.service';
import { LanguageService } from '@services/language.service';
import { HttpErrorService } from '@services/http-error.service';
import { BookingUpdateService } from '@services/booking-update.service';
import { MessageService } from 'primeng/api';
import { rutValidator } from '@shared/validators/rut.validator';

describe('BookingFormDialogComponent', () => {
  let component: BookingFormDialogComponent;
  let fixture: ComponentFixture<BookingFormDialogComponent>;

  beforeEach(async () => {
    const apiServiceMock = {
      getClients: vi.fn().mockReturnValue(of([])),
      getServices: vi.fn().mockReturnValue(of([])),
      getPacks: vi.fn().mockReturnValue(of({ data: [] })),
      getProviders: vi.fn().mockReturnValue(of([])),
      getLocations: vi.fn().mockReturnValue(of([])),
      createClient: vi.fn().mockReturnValue(of({ id: 1, first_name: 'Test', last_name: 'Patient' })),
    };

    const dataCacheMock = {
      getOrFetchResource: vi.fn((_key: string, fetchFn: () => unknown) => fetchFn()),
      invalidateCacheEntries: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BookingFormDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ApiService, useValue: apiServiceMock },
        { provide: DataCacheService, useValue: dataCacheMock },
        { provide: HttpErrorService, useValue: { handle: vi.fn() } },
        { provide: BookingUpdateService, useValue: { notify: vi.fn() } },
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
});
