import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountSettingsNavComponent } from './account-settings-nav.component';

describe('AccountSettingsNavComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountSettingsNavComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(AccountSettingsNavComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('groups the links in Pago and Plan, in that order', () => {
    const host = render();
    const titles = Array.from(host.querySelectorAll('.as-nav__title')).map((el) => el.textContent?.trim());

    expect(titles).toEqual(['Pago', 'Plan']);
  });

  it('links every section to its route', () => {
    const host = render();
    const hrefs = Array.from(host.querySelectorAll('.as-nav__item')).map((el) =>
      el.getAttribute('href'),
    );

    expect(hrefs).toEqual([
      '/admin/facturacion',
      '/admin/facturacion/historial',
      '/admin/facturacion/datos',
      '/admin/planes',
      '/admin/planes/administrar',
    ]);
  });

  it('does not include Preguntas frecuentes (the section does not exist)', () => {
    const host = render();
    const labels = Array.from(host.querySelectorAll('.as-nav__label')).map((el) =>
      el.textContent?.trim(),
    );

    expect(labels.join(' ')).not.toContain('Preguntas');
  });
});
