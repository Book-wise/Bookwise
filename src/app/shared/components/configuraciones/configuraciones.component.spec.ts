import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfiguracionesComponent } from './configuraciones.component';
import { AuthService } from '@services/auth.service';
import { ThemeService } from '@services/theme.service';
import { LanguageService } from '@services/language.service';
import { HttpErrorService } from '@services/http-error.service';
import { TenantSettingsApiService } from '@services/api/tenant-settings-api.service';

describe('ConfiguracionesComponent — holidays setting', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ConfiguracionesComponent>>;
  let component: ConfiguracionesComponent;
  let settingsApi: {
    getSettings: ReturnType<typeof vi.fn>;
    updateSettings: ReturnType<typeof vi.fn>;
  };
  let httpErrorHandle: ReturnType<typeof vi.fn>;

  async function setup() {
    settingsApi = {
      getSettings: vi.fn(() => of({ block_bookings_on_holidays: true })),
      updateSettings: vi.fn(() => of({ block_bookings_on_holidays: false })),
    };
    httpErrorHandle = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ConfiguracionesComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: () => null,
            userRole: () => 'admin',
            isAdmin: () => true,
            me: () => ({ business: null }),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            appearance: signal('light'),
            currentTheme: signal('default'),
            themeOptions: [],
            setTheme: vi.fn(),
            setAppearance: vi.fn(),
          },
        },
        {
          provide: LanguageService,
          useValue: { t: (k: string) => k, lang: signal('es'), langOptions: [], setLang: vi.fn() },
        },
        { provide: TenantSettingsApiService, useValue: settingsApi },
        { provide: HttpErrorService, useValue: { handle: httpErrorHandle } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfiguracionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('loads block_bookings_on_holidays from tenant settings', async () => {
    await setup();

    expect(settingsApi.getSettings).toHaveBeenCalled();
    expect(component.blockHolidays()).toBe(true);
  });

  it('patches only block_bookings_on_holidays and stores the response', async () => {
    await setup();

    component.onBlockHolidaysChange(false);

    expect(settingsApi.updateSettings).toHaveBeenCalledWith({ block_bookings_on_holidays: false });
    expect(component.blockHolidays()).toBe(false);
    expect(component.savingHolidays()).toBe(false);
  });

  it('reverts the toggle and reports the error when the patch fails', async () => {
    await setup();
    settingsApi.updateSettings.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422 })),
    );

    component.onBlockHolidaysChange(false);

    expect(component.blockHolidays()).toBe(true); // revertido al valor previo
    expect(component.savingHolidays()).toBe(false);
    expect(httpErrorHandle).toHaveBeenCalled();
  });
});
