import { Component, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MenuItem } from 'primeng/api';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { ABILITIES } from '@shared/config/abilities.config';
import { AppHeaderComponent } from '@shared/components/app-header/app-header.component';
import { AgendaNavigatorComponent } from '@shared/components/agenda-navigator/agenda-navigator.component';
import { SubscriptionInactiveDialogComponent } from '@shared/components/subscription-inactive-dialog/subscription-inactive-dialog.component';

@Component({
  selector: 'bw-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastModule, AppHeaderComponent, AgendaNavigatorComponent, SubscriptionInactiveDialogComponent],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  readonly langService = inject(LanguageService);

  /** Drawer abierto en mobile (≤991px). Lo consume el header y el scrim. */
  readonly mobileMenuOpen = signal(false);
  /**
   * Panel abierto en desktop (>991px): empuja el contenido, sin scrim.
   * Arranca ABIERTO: hoy el sidebar siempre está visible, así que cerrarlo por
   * defecto dejaría al usuario sin navegación hasta que descubra la hamburguesa.
   */
  readonly desktopPanelOpen = signal(true);
  readonly isMobile = signal(false);

  /**
   * Estado abierto del panel, sin importar el viewport. Es la única fuente que
   * consume la hamburguesa de `bw-app-header` y el CSS del layout: en desktop
   * empuja el contenido y en mobile abre el drawer con scrim.
   */
  readonly panelOpen = computed(() =>
    this.isMobile() ? this.mobileMenuOpen() : this.desktopPanelOpen(),
  );

  /** Ítems crudos del menú: cada uno declara el permission key requerido.
   *  `ability` null = siempre visible (dashboard). */
  private readonly allMenuItems: (MenuItem & { ability?: string })[] = [
    { label: 'nav.dashboard', icon: 'pi pi-home',     routerLink: '/admin' },
    { label: 'nav.locations', icon: 'pi pi-building',  routerLink: '/admin/locations', ability: ABILITIES.locationsView, command: () => this.closeMenus() },
    { label: 'nav.providers', icon: 'pi pi-users',     routerLink: '/admin/providers', ability: ABILITIES.providersView, command: () => this.closeMenus() },
    { label: 'nav.calendar',  icon: 'pi pi-calendar',  routerLink: '/admin/calendar',  ability: ABILITIES.bookingsView, command: () => this.closeMenus() },
    { label: 'nav.clients',   icon: 'pi pi-user',      routerLink: '/admin/clients',   ability: ABILITIES.clientsView, command: () => this.closeMenus() },
    { label: 'nav.packs',     icon: 'pi pi-box',       routerLink: '/admin/packs',     command: () => this.closeMenus() },
  ];

  /** Ítems visibles: filtra por permission key del tenant activo. */
  readonly menuItems = computed(() =>
    this.allMenuItems.filter((item) => !item.ability || this.authService.hasPermission(item.ability)),
  );

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
    // Al cambiar de breakpoint el panel nunca queda "abierto" en el modo que ya
    // no corresponde: un drawer abierto al pasar a desktop dejaría el panel
    // empujado sin haberse pedido y viceversa.
    if (!mobile && this.mobileMenuOpen()) {
      this.mobileMenuOpen.set(false);
    }
    if (mobile && this.desktopPanelOpen()) {
      this.desktopPanelOpen.set(false);
    }
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileMenuOpen.update((v) => !v);
    } else {
      this.desktopPanelOpen.update((v) => !v);
    }
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