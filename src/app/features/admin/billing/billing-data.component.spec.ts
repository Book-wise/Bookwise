import { Component, Input, forwardRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  Validator,
} from '@angular/forms';
import { of } from 'rxjs';
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

  function setup(overrides: { accounts?: AccountSummary[] } = {}) {
    auth = {
      me: () => ({ ...me, accounts: overrides.accounts ?? [account] }),
      updateAccount: vi.fn(),
    };
    accountsApi = {
      updateBillingData: vi.fn(() => of({ message: 'ok', data: { ...account, legal_name: 'Nueva SpA' } })),
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

  it('disables the form when the account role cannot bill', () => {
    const { fixture, component } = setup({ accounts: [{ ...account, role: 'admin' }] });
    fixture.detectChanges();

    expect(component.canEdit()).toBe(false);
    expect(component.form.disabled).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.billing-data__notice')).not.toBeNull();
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
});
