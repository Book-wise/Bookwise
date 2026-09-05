import { Component, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { MenuItem } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@services/auth.service';
import { ThemeService, ThemeName } from '@services/theme.service';
import { LanguageService, Language } from '@services/language.service';
import { AppHeaderComponent } from '@shared/components/app-header/app-header.component';
import { AgendaNavigatorComponent } from '@shared/components/agenda-navigator/agenda-navigator.component';

@Component({
  selector: 'bw-provider-layout',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ButtonModule, ToastModule, SelectModule, FormsModule, TooltipModule,
    AppHeaderComponent, AgendaNavigatorComponent,
  ],
  templateUrl: './provider-layout.component.html',
  styleUrls: ['./provider-layout.component.scss'],
})
export class ProviderLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  readonly langService = inject(LanguageService);

  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  isMobile = signal(false);

  // On mobile the sidebar is always in expanded format — collapsed is desktop-only
  readonly effectivelyCollapsed = computed(() => this.sidebarCollapsed() && !this.isMobile());
  readonly darkMode = computed(() => this.themeService.darkMode);

  themeOptions = this.themeService.themeOptions;
  currentTheme = signal<ThemeName>(this.themeService.currentTheme);

  // ── Usuario autenticado (identidad visible en el chip del sidebar) ──────────
  readonly userName = computed(() => this.authService.user()?.name ?? '');
  readonly userRoleLabel = computed(() => {
    const role = this.authService.userRole();
    if (role === 'admin') return this.langService.t('ui.role.admin');
    if (role === 'provider') return this.langService.t('ui.role.provider');
    return '';
  });

  /** Menú operativo del profesional: agenda y disponibilidad (sin config/roles). */
  menuItems: MenuItem[] = [
    { label: 'nav.my_schedule', icon: 'pi pi-calendar', routerLink: '/provider', command: () => this.closeMenus() },
    { label: 'nav.availability', icon: 'pi pi-clock', routerLink: '/provider/availability', command: () => this.closeMenus() },
  ];

  constructor() {
    this.checkScreenSize();
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    const mobile = window.innerWidth < 992;
    this.isMobile.set(mobile);
    // Al volver a desktop (o al salir de mobile), el panel overlay nunca debe
    // quedar "abierto": sin esto, redimensionar de mobile→desktop dejaba un
    // overlay fantasma (ya que la sidebar colapsada es un estado distinto).
    if (!mobile && this.mobileMenuOpen()) {
      this.mobileMenuOpen.set(false);
    }
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileMenuOpen.update((v) => !v);
    } else {
      this.sidebarCollapsed.update((v) => !v);
    }
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  onThemeChange(themeName: ThemeName): void {
    this.themeService.setTheme(themeName);
    this.currentTheme.set(themeName);
  }

  onLangChange(lang: Language): void {
    this.langService.setLang(lang);
  }

  closeMenus(): void {
    this.mobileMenuOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
  }

  isActive(link: string): boolean {
    return this.router.url === link;
  }
}
