import { Component, signal, computed, inject, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { MenuItem } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@services/auth.service';
import { ThemeService, ThemeName } from '@services/theme.service';
import { LanguageService, Language } from '@services/language.service';
import { UserAvatarComponent } from '@shared/components/user-avatar/user-avatar.component';

@Component({
  selector: 'bw-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, ToastModule, SelectModule, FormsModule, UserAvatarComponent],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  readonly langService = inject(LanguageService);

  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  isMobile = signal(false);

  // On mobile the sidebar is always in expanded format — collapsed is desktop-only
  readonly effectivelyCollapsed = computed(() => this.sidebarCollapsed() && !this.isMobile());
  darkMode = signal<boolean>(this.getInitialDarkMode());
  
  themeOptions = this.themeService.themeOptions;
  currentTheme = signal<ThemeName>(this.themeService.currentTheme);

  // ── Usuario autenticado (identidad visible en el footer del sidebar) ────────
  readonly userName = computed(() => this.authService.user()?.name ?? '');
  readonly userRoleLabel = computed(() => this.roleLabel(this.authService.userRole()));

  menuItems: MenuItem[] = [
    { label: 'nav.dashboard', icon: 'pi pi-home',     routerLink: '/admin',           command: () => this.closeMenus() },
    { label: 'nav.locations', icon: 'pi pi-building',  routerLink: '/admin/locations', command: () => this.closeMenus() },
    { label: 'nav.providers', icon: 'pi pi-users',     routerLink: '/admin/providers', command: () => this.closeMenus() },
    { label: 'nav.calendar',  icon: 'pi pi-calendar',  routerLink: '/admin/calendar',  command: () => this.closeMenus() },
    { label: 'nav.clients',   icon: 'pi pi-user',      routerLink: '/admin/clients',   command: () => this.closeMenus() },
    { label: 'nav.packs',     icon: 'pi pi-box',       routerLink: '/admin/packs',     command: () => this.closeMenus() },
    { label: 'nav.profile',   icon: 'pi pi-id-card',   routerLink: '/admin/profile',   command: () => this.closeMenus() },
    { label: 'nav.roles',     icon: 'pi pi-shield',    routerLink: '/admin/roles',     command: () => this.closeMenus() },
  ];

  constructor() {
    this.checkScreenSize();
    this.applyDarkMode();
    
    effect(() => {
      this.applyDarkMode();
      localStorage.setItem('darkMode', this.darkMode() ? 'true' : 'false');
    });
  }

  private getInitialDarkMode(): boolean {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  }

  private applyDarkMode(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dark-theme', this.darkMode());
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    this.isMobile.set(window.innerWidth < 992);
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileMenuOpen.update(v => !v);
    } else {
      this.sidebarCollapsed.update(v => !v);
    }
  }

  toggleDarkMode(): void {
    this.darkMode.update(v => !v);
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

  /** Etiqueta i18n del rol de sesión (`admin`/`provider`), distinta del rol de negocio. */
  private roleLabel(role: string | null): string {
    if (role === 'admin') return this.langService.t('ui.role.admin');
    if (role === 'provider') return this.langService.t('ui.role.provider');
    return '';
  }

  isActive(link: string): boolean {
    return this.router.url === link;
  }
}