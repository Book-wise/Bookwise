import { Component, signal, inject, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  isMobile = signal(false);
  darkMode = signal<boolean>(this.getInitialDarkMode());

  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'pi pi-home', routerLink: '/admin', command: () => this.closeMenus() },
    { label: 'Locations', icon: 'pi pi-building', routerLink: '/admin/locations', command: () => this.closeMenus() },
    { label: 'Profesionales', icon: 'pi pi-users', routerLink: '/admin/providers', command: () => this.closeMenus() },
    { label: 'Agenda', icon: 'pi pi-calendar', routerLink: '/admin/calendar', command: () => this.closeMenus() },
    { label: 'Clientes', icon: 'pi pi-user', routerLink: '/admin/clients', command: () => this.closeMenus() },
    { label: 'Packs', icon: 'pi pi-box', routerLink: '/admin/packs', command: () => this.closeMenus() },
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