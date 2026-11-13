import { Component, Input, forwardRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  Validator,
} from '@angular/forms';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BillingDataComponent } from './billing-data.component';
import { AuthService } from '@services/auth.service';
import { AccountsApiService } from '@services/api/accounts-api.service';
import { SiiActivitiesApiService } from '@services/api/sii-activities-api.service';
import { LocationsApiService } from '@services/api/locations-api.service';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { AccountSummary, AuthMeData } from '@models';

/** Stub de `bw-phone-input`: el real necesita `intl-tel-input` + DOM real. */
@Component({
  selector: 'bw-phone-input',
  standalone: true,
  template: '',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInputStubComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => PhoneInputStubComponent),
      multi: true,
    },
  ],
})
class PhoneInputStubComponent implements ControlValueAccessor, Validator {
  @Input() placeholder = '';
  writeValue(): void {}
  registerOnChange(): void {}
  registerOnTouched(): void {}
  validate(): null {
    return null;
  }
}

const account: AccountSummary = {
  id: 12,
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

const me: AuthMeData = {
  id: 7,
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin',
  tenant_id: 1,
  current_account_id: 12,
  accounts: [account],
  email_verified_at: '2026-09-01T16:00:00Z',
  onboarding_complete: true,
  business: null,
};

describe('BillingDataComponent', () => {
  let auth: { me: () => AuthMeData; updateAccount: ReturnType<typeof vi.fn> };
  let accountsApi: { updateBillingData: ReturnType<typeof vi.fn> };
  let siiApi: { search: ReturnType<typeof vi.fn> };
  let locationsApi: {
    getRegions: ReturnType<typeof vi.fn>;
    getComunas: ReturnType<typeof vi.fn>;
  };

  function setup(
    overrides: {
      accounts?: AccountSummary[];
      currentAccountId?: number | null;
      updateBillingData?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    const meData: AuthMeData = {
      ...me,
      current_account_id:
        overrides.currentAccountId === undefined ? me.current_account_id : overrides.currentAccountId,
      accounts: overrides.accounts ?? [account],
    };
    auth = {
      me: () => meData,
      updateAccount: vi.fn(),
    };
    accountsApi = {
      updateBillingData:
        overrides.updateBillingData ??
        vi.fn(() => of({ message: 'ok', data: { ...account, legal_name: 'Nueva SpA' } })),
    };
    siiApi = {
      search: vi.fn(() =>
        of({
          data: [{ id: 612, code: '960200', description: 'PELUQUERÍA' }],
          meta: { current_page: 1, from: 1, last_page: 1, per_page: 25, to: 1, total: 1 },
        }),
      ),
    };
    locationsApi = {
      getRegions: vi.fn(() => of({ data: [{ id: 13, name: 'Magallanes', timezone: 'America/Santiago' }] })),
      getComunas: vi.fn(() => of({ data: [{ id: 141, name: 'Punta Arenas' }] })),
    };

    TestBed.configureTestingModule({
      imports: [BillingDataComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: AccountsApiService, useValue: accountsApi },
        { provide: SiiActivitiesApiService, useValue: siiApi },
        { provide: LocationsApiService, useValue: locationsApi },
        { provide: MessageService, useValue: { add: vi.fn() } },
      ],
    });

    TestBed.overrideComponent(BillingDataComponent, {
      remove: { imports: [PhoneInputComponent] },
      add: { imports: [PhoneInputStubComponent] },
    });

    const fixture = TestBed.createComponent(BillingDataComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('seeds the form from the account fiscal block', () => {
    const { component } = setup();

    expect(component.account()?.id).toBe(12);
    const value = component.form.getRawValue();
    expect(value.rut).toBe('11.111.111-1');
    expect(value.taxpayer_type).toBe('company');
    expect(value.legal_name).toBe('Kinesilk Servicios SpA');
    expect(value.sii_activity?.id).toBe(612);
    expect(value.billing_phone).toBe('+56987524346');
    expect(value.billing_region_id).toBe(13);
    expect(value.billing_comuna_id).toBe(141);
  });

  const GATING: Array<[Partial<AccountSummary>, boolean]> = [
    [{ role: 'owner' }, true],
    [{ role: 'billing' }, true],
    [{ role: 'admin' }, false],
    [{ role: 'owner', membership_status: 'inactive' }, false],
    [{ role: 'billing', membership_status: 'inactive' }, false],
  ];

  it.each(GATING)('gates editing on account role + active membership: %o', (over, expected) => {
    const { fixture, component } = setup({ accounts: [{ ...account, ...over }] });
    fixture.detectChanges();

    expect(component.canEdit()).toBe(expected);
    expect(component.form.disabled).toBe(!expected);
    const notice = (fixture.nativeElement as HTMLElement).querySelector('.billing-data__notice');
    expect(notice === null).toBe(expected);
  });

  it('resolves the account by current_account_id, not by position', () => {
    const other: AccountSummary = { ...account, id: 99, reference: 'BW-OTHER', legal_name: 'Otra SpA' };
    const { component } = setup({ accounts: [other, account], currentAccountId: 12 });

    expect(component.account()?.id).toBe(12);
  });

  it('does not guess the account when current_account_id is missing and there are several', () => {
    const other: AccountSummary = { ...account, id: 99, reference: 'BW-OTHER' };
    const { component } = setup({ accounts: [other, account], currentAccountId: null });

    expect(component.account()).toBeNull();
  });

  it('saves the fiscal profile sending sii_activity_id, never the denormalized object', () => {
    const { component } = setup();
    component.form.controls.billing_phone.setValue('+56911112222');

    component.save();

    expect(accountsApi.updateBillingData).toHaveBeenCalledTimes(1);
    const [accountId, payload] = accountsApi.updateBillingData.mock.calls[0];
    expect(accountId).toBe(12);
    expect(payload.sii_activity_id).toBe(612);
    expect(payload).not.toHaveProperty('sii_activity');
    expect(payload.billing_phone).toBe('+56911112222');
    expect(payload.billing_region_id).toBe(13);
    expect(payload.billing_comuna_id).toBe(141);
  });

  it('sends exactly the nine contract keys, with sii_activity_id and no denormalized object', () => {
    const { component } = setup();

    component.save();

    const [, payload] = accountsApi.updateBillingData.mock.calls[0];
    expect(Object.keys(payload).sort()).toEqual([
      'billing_address',
      'billing_comuna_id',
      'billing_email',
      'billing_phone',
      'billing_region_id',
      'legal_name',
      'rut',
      'sii_activity_id',
      'taxpayer_type',
    ]);
    expect(payload).not.toHaveProperty('sii_activity');
    expect(payload).not.toHaveProperty('name');
  });

  it('sends the phone verbatim as E.164, without normalizing a non-CL number', () => {
    const { component } = setup();
    component.form.controls.billing_phone.setValue('+5491123456789');

    component.save();

    const [, payload] = accountsApi.updateBillingData.mock.calls[0];
    expect(payload.billing_phone).toBe('+5491123456789');
  });

  it('never sends a comuna without its region', () => {
    const { component } = setup();
    component.form.controls.billing_region_id.setValue(null);

    component.save();

    const [, payload] = accountsApi.updateBillingData.mock.calls[0];
    expect(payload.billing_region_id).toBeNull();
    expect(payload.billing_comuna_id).toBeNull();
  });

  it('blocks the save when the RUT fails module 11', () => {
    const { component } = setup();
    component.form.controls.rut.setValue('11.111.111-2');

    component.save();

    expect(accountsApi.updateBillingData).not.toHaveBeenCalled();
    expect(component.form.controls.rut.invalid).toBe(true);
  });

  it('replaces the cached account with the PATCH response instead of refetching', () => {
    const { component } = setup();

    component.save();

    expect(auth.updateAccount).toHaveBeenCalledWith(
      expect.objectContaining({ id: 12, legal_name: 'Nueva SpA' }),
    );
  });

  it('sends null for blank optional fields', () => {
    const { component } = setup();
    component.form.controls.legal_name.setValue('   ');
    component.form.controls.billing_email.setValue('');

    component.save();

    const [, payload] = accountsApi.updateBillingData.mock.calls[0];
    expect(payload.legal_name).toBeNull();
    expect(payload.billing_email).toBeNull();
  });

  it('clears the comuna and reloads them when the region changes', () => {
    const { component } = setup();

    component.form.controls.billing_region_id.setValue(5);

    expect(component.form.controls.billing_comuna_id.value).toBeNull();
    expect(locationsApi.getComunas).toHaveBeenCalledWith(5);
  });

  it('searches the SII catalog server-side with the typed term', () => {
    const { component } = setup();

    component.searchGiro({ query: 'peluquería' });

    expect(siiApi.search).toHaveBeenCalledWith({ search: 'peluquería', perPage: 25 });
    expect(component.giroSuggestions().length).toBe(1);
  });

  it('starts at step 1 and only shows the basic information fields', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.billing-data__panel-head-text .overline')?.textContent).toContain(
      'Paso 1 de 3',
    );
    expect(el.querySelector('#rut')).toBeTruthy();
    expect(el.querySelector('#legal_name')).toBeTruthy();
    expect(el.querySelector('#sii_activity')).toBeTruthy();
    expect(el.querySelector('#taxpayer-company')).toBeTruthy();
    expect(el.querySelector('#taxpayer-individual')).toBeTruthy();

    expect(el.querySelector('#billing_address')).toBeNull();
    expect(el.querySelector('#billing_region_id')).toBeNull();
    expect(el.querySelector('#billing_comuna_id')).toBeNull();
    expect(el.querySelector('#billing_email')).toBeNull();
    expect(el.querySelector('bw-phone-input')).toBeNull();
  });

  it('switches the panel to the clicked rail step', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const stepButtons = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.billing-data__step-btn'),
    );
    stepButtons[1].click();
    fixture.detectChanges();

    expect(el.querySelector('.billing-data__panel-head-text .overline')?.textContent).toContain(
      'Paso 2 de 3',
    );
    expect(el.querySelector('#billing_address')).toBeTruthy();
    expect(el.querySelector('#billing_region_id')).toBeTruthy();
    expect(el.querySelector('#billing_comuna_id')).toBeTruthy();
    expect(el.querySelector('#rut')).toBeNull();
    expect(el.querySelector('#legal_name')).toBeNull();
  });

  it('counts seeded data in the progress indicator and labels a complete step', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const progress = el.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute('aria-valuenow')).toBe('9');
    expect(progress?.getAttribute('aria-valuemin')).toBe('0');
    expect(progress?.getAttribute('aria-valuemax')).toBe('9');
    expect(el.textContent).toContain('9 de 9 datos');

    const panelChip = el.querySelector('.billing-data__panel-head .bw-chip');
    expect(panelChip?.textContent?.trim()).toBe('Completo');
  });

  it('lists missing data in "Qué falta" and jumps to the step that holds it', () => {
    const partial: AccountSummary = {
      ...account,
      legal_name: null,
      sii_activity: null,
      billing_address: null,
      billing_region_id: null,
      billing_comuna_id: null,
      billing_phone: null,
      billing_email: null,
    };
    const { fixture } = setup({ accounts: [partial] });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.billing-data__missing')).toBeTruthy();
    expect(el.querySelectorAll('.billing-data__missing-item').length).toBe(7);

    const goStep2 = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.billing-data__missing-go'),
    ).find((button) => button.textContent?.includes('Ir al paso 2'));
    expect(goStep2).toBeTruthy();
    goStep2?.click();
    fixture.detectChanges();

    expect(el.querySelector('.billing-data__panel-head-text .overline')?.textContent).toContain(
      'Paso 2 de 3',
    );
  });

  it('saves and advances to the next step only on a successful response', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    el.querySelector<HTMLButtonElement>('button.billing-data__primary')?.click();
    fixture.detectChanges();

    expect(accountsApi.updateBillingData).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.billing-data__panel-head-text .overline')?.textContent).toContain(
      'Paso 2 de 3',
    );
  });

  it('stays on the current step when saving fails', () => {
    const { fixture } = setup({
      updateBillingData: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 }))),
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    el.querySelector<HTMLButtonElement>('button.billing-data__primary')?.click();
    fixture.detectChanges();

    expect(accountsApi.updateBillingData).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.billing-data__panel-head-text .overline')?.textContent).toContain(
      'Paso 1 de 3',
    );
  });

  it('disables the form and hides the save actions without edit permission', () => {
    const { fixture, component } = setup({ accounts: [{ ...account, role: 'admin' }] });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(component.form.disabled).toBe(true);
    expect(el.querySelector('.billing-data__notice')).toBeTruthy();
    expect(el.querySelector('.billing-data__rail')).toBeTruthy();
    expect(el.querySelector('.billing-data__actions')).toBeNull();
  });
});
