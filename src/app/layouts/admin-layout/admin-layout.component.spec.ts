import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AdminLayoutComponent } from './admin-layout.component';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { ThemeService } from '@services/theme.service';
import { TenantSwitchService } from '@services/tenant-switch.service';
import { CalendarNavigationService } from '@services/calendar-navigation.service';
import type { AuthMeData, Business, User } from '@models';

const business: Business = {
  id: 1,
  name: 'Kinesilk Centro',
  rut: '11111111-1',
  email: 'negocio@test.com',
  address: 'Av. Providencia 123',
  phone: '+56912345678',
  plan: 'starter',
};

const otherBusiness: Business = { ...business, id: 2, name: 'Kinesilk Norte' };

function makeMe(): AuthMeData {
  return {
    id: 7,
    name: 'Admin',
    email: 'admin@test.com',
    phone: '+56912345678',
    role: 'admin',
    tenant_id: 1,
    email_verified_at: '2026-09-01T16:00:00Z',
    onboarding_complete: true,
    business,
    businesses: [business, otherBusiness],
  } as AuthMeData;
}

const user: User = { id: 7, email: 'admin@test.com', name: 'Admin', role: 'admin' };

/**
 * The redesigned shell: the header is a full-width top row and the panel below
 * it opens with the SAME header hamburger (desktop pushes the content, mobile
 * shows the drawer with the scrim).
 */
describe('AdminLayoutComponent — panel de navegación', () => {
  let fixture: ComponentFixture<AdminLayoutComponent>;
  let component: AdminLayoutComponent;
  let el: HTMLElement;
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // jsdom default width (1024) is already desktop, but pin it so the
    // "mobile vs desktop" assertions never depend on the environment.
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true, writable: true });
    logout = vi.fn();

    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            me: signal(makeMe()),
            user: signal(user),
            userRole: () => 'admin',
            isAdmin: () => true,
            isAdminGeneral: () => true,
            hasPermission: () => true,
            meLoaded: () => true,
            loadMe: () => of(makeMe()),
            logout,
          },
        },
        {
          provide: ThemeService,
          useValue: {
            themeOptions: [],
            currentTheme: 'light',
            appearance: 'light',
            setTheme: vi.fn(),
            setAppearance: vi.fn(),
          },
        },
        { provide: TenantSwitchService, useValue: { switchTenant: vi.fn(() => of(void 0)) } },
        // Real service: PrimeNG's Toast subscribes to its `messageObserver`.
        MessageService,
        { provide: CalendarNavigationService, useValue: { navigateToCalendar: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    component = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
  });

  function menuButton(): HTMLButtonElement {
    const btn = el.querySelector<HTMLButtonElement>('.app-header__menu-btn');
    expect(btn).not.toBeNull();
    return btn!;
  }

  function sidebar(): HTMLElement {
    const aside = el.querySelector<HTMLElement>('aside.sidebar');
    expect(aside).not.toBeNull();
    return aside!;
  }

  /** PRESERVE: la cabecera conserva negocio + tema + cuenta, en ese orden. */
  it('conserva el selector de negocio, el tema y la cuenta en el orden final', () => {
    const lang = TestBed.inject(LanguageService);
    const menuBtn = menuButton();
    const wordmark = el.querySelector('.app-header__wordmark');
    const biz = el.querySelector('.app-header__business');
    const theme = el.querySelector('.app-header__theme');
    const account = el.querySelector('bw-account-menu');

    expect(wordmark).not.toBeNull();
    expect(wordmark!.querySelector('img')!.getAttribute('alt')).toBe('Bookwise');
    expect(biz).not.toBeNull();
    expect(theme).not.toBeNull();
    expect(account).not.toBeNull();

    // Negocio: nombre + RUT + chevron (canSwitch con 2 negocios).
    expect(biz!.textContent).toContain(business.name);
    expect(biz!.textContent).toContain(`${lang.t('ui.rut')}: ${business.rut}`);
    expect(biz!.querySelector('.app-header__chevron')).not.toBeNull();

    // Orden: [☰] [wordmark] [negocio] … [tema] [cuenta].
    const order = [menuBtn, wordmark!, biz!, theme!, account!];
    for (let i = 0; i < order.length - 1; i++) {
      expect(
        order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('muestra la hamburguesa en desktop y arranca con el panel abierto', () => {
    const btn = menuButton();

    // Hoy el sidebar siempre está visible: arrancar cerrado dejaría al usuario
    // sin navegación hasta que descubriera la hamburguesa.
    expect(el.querySelector('.layout')!.classList).toContain('panel-open');
    expect(component.panelOpen()).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.querySelector('i')!.classList).toContain('pi-times');
    expect(btn.classList).toContain('app-header__menu-btn--open');
  });

  it('la misma hamburguesa cierra y vuelve a abrir el panel (desktop)', () => {
    const btn = menuButton();

    btn.click();
    fixture.detectChanges();
    expect(component.panelOpen()).toBe(false);
    expect(el.querySelector('.layout')!.classList).not.toContain('panel-open');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.querySelector('i')!.classList).toContain('pi-bars');
    expect(btn.classList).not.toContain('app-header__menu-btn--open');

    btn.click();
    fixture.detectChanges();
    expect(component.panelOpen()).toBe(true);
    expect(el.querySelector('.layout')!.classList).toContain('panel-open');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.classList).toContain('app-header__menu-btn--open');
    expect(btn.querySelector('i')!.classList).toContain('pi-times');
    // Desktop: empuja el contenido, sin scrim.
    expect(el.querySelector('.mobile-overlay')).toBeNull();
  });

  it('el panel contiene la navegación original (6 ítems) y el cerrar sesión', () => {
    const lang = TestBed.inject(LanguageService);
    // El panel ya arranca abierto en desktop.

    const navItems = Array.from(el.querySelectorAll<HTMLAnchorElement>('.sidebar-nav .nav-item'));
    expect(navItems.map((a) => a.textContent!.trim())).toEqual([
      lang.t('nav.dashboard'),
      lang.t('nav.locations'),
      lang.t('nav.providers'),
      lang.t('nav.calendar'),
      lang.t('nav.clients'),
      lang.t('nav.packs'),
    ]);

    // El mes reusa bw-agenda-navigator, después de la navegación.
    const nav = el.querySelector('.sidebar-nav')!;
    const month = el.querySelector('.sidebar-widget bw-agenda-navigator');
    expect(month).not.toBeNull();
    expect(nav.compareDocumentPosition(month!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const logoutBtn = el.querySelector<HTMLButtonElement>('.sidebar-footer .sidebar-logout');
    expect(logoutBtn).not.toBeNull();
    expect(logoutBtn!.textContent).toContain(lang.t('ui.logout'));
    expect(month!.parentElement!.compareDocumentPosition(logoutBtn!) &
      Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    logoutBtn!.click();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('en mobile el mismo botón abre el drawer con scrim y el scrim lo cierra', () => {
    Object.defineProperty(window, 'innerWidth', { value: 420, configurable: true, writable: true });
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(component.isMobile()).toBe(true);

    const btn = menuButton();
    expect(el.querySelector('.mobile-overlay')).toBeNull();

    btn.click();
    fixture.detectChanges();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(sidebar().classList).toContain('mobile-open');
    const scrim = el.querySelector<HTMLElement>('.mobile-overlay');
    expect(scrim).not.toBeNull();

    scrim!.click();
    fixture.detectChanges();
    expect(component.mobileMenuOpen()).toBe(false);
    expect(sidebar().classList).not.toContain('mobile-open');
    expect(el.querySelector('.mobile-overlay')).toBeNull();

    // El mismo botón también cierra.
    btn.click();
    fixture.detectChanges();
    expect(sidebar().classList).toContain('mobile-open');
    btn.click();
    fixture.detectChanges();
    expect(sidebar().classList).not.toContain('mobile-open');
  });
});
