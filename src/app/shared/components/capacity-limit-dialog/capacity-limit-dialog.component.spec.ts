import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { CapacityLimitDialogComponent } from './capacity-limit-dialog.component';
import { LanguageService } from '@services/language.service';
import type { Quota } from '@models';

describe('CapacityLimitDialogComponent', () => {
  let fixture: ComponentFixture<CapacityLimitDialogComponent>;
  let component: CapacityLimitDialogComponent;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    router = { navigate: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [CapacityLimitDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: router },
        LanguageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CapacityLimitDialogComponent);
    component = fixture.componentInstance;
  });

  it('uses the account-tenant title and detail by default', () => {
    expect(component.title()).toBe('Límite de negocios alcanzado');
    expect(component.detail()).toBe('Alcanzaste el límite de negocios de tu plan.');
  });

  it('resolves the configured title and detail keys', () => {
    fixture.componentRef.setInput('titleKey', 'biz.tenant_location_limit_reached');
    fixture.componentRef.setInput('detailKey', 'biz.tenant_location_limit_reached.detail');
    fixture.detectChanges();

    expect(component.title()).toBe('Límite de sucursales alcanzado');
    expect(component.detail()).toBe('Alcanzaste el límite de sucursales de tu plan.');
  });

  it('renders the usage label from the quota', () => {
    fixture.componentRef.setInput('quota', { limit: 5, current: 3 } as Quota);
    fixture.detectChanges();

    expect(component.usageLabel()).toBe('Usado 3 de 5.');
  });

  it('renders an empty usage label when there is no quota', () => {
    expect(component.usageLabel()).toBe('');
  });

  it('emits closed when close() is called', () => {
    const spy = vi.spyOn(component.closed, 'emit');

    component.close();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits closed and navigates to the plan admin when goToUpgrade() is called', () => {
    const spy = vi.spyOn(component.closed, 'emit');

    component.goToUpgrade();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/planes/administrar']);
  });
});
