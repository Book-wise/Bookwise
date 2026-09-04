import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Popover, PopoverModule } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { ThemeService } from '@services/theme.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Business } from '@models';
import { AccountMenuComponent } from '@shared/components/account-menu/account-menu.component';

/**
 * Barra superior de la app: muestra el negocio en uso (multi-tenant) con selector
 * para admin_general, acciones (modo oscuro → futuro: notificaciones) y el menú
 * de usuario. Aligera el sidebar (que queda solo con navegación).
 */
@Component({
  selector: 'bw-app-header',
  standalone: true,
  imports: [CommonModule, AccountMenuComponent, PopoverModule, ButtonModule],
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.scss'],
})
export class AppHeaderComponent {
  private auth = inject(AuthService);
  private themeService = inject(ThemeService);
  private refStore = inject(ReferenceStore);
  private messageService = inject(MessageService);
  readonly lang = inject(LanguageService);

  readonly business = computed(() => this.auth.me()?.business ?? null);
  readonly businesses = computed(() => this.auth.me()?.businesses ?? []);
  readonly businessMonogram = computed(() =>
    (this.business()?.name || 'B').trim().charAt(0).toUpperCase(),
  );
  readonly currentBusinessId = computed(() => this.business()?.id ?? null);

  /** Solo admin_general con varios negocios puede alternar; provider es lectura. */
  readonly canSwitch = computed(() => this.businesses().length > 1);

  readonly darkMode = computed(() => this.themeService.darkMode);

  constructor() {
    // Garantiza /auth/me cargado (para el indicador de empresa en admin y provider).
    if (!this.auth.meLoaded()) {
      this.auth.loadMe().subscribe();
    }
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  /** Cambia de negocio (admin_general) y recarga datos del nuevo tenant. */
  switchTo(biz: Business): void {
    this.auth.switchTenant(biz.id).subscribe({
      next: () => {
        this.refStore.loadLocations();
        this.refStore.loadProviders();
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('settings.business'),
          detail: `${this.lang.t('settings.business')}: ${biz.name}`,
          key: 'global',
          life: 3500,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.lang.t('ui.error'),
          detail: this.lang.t('auth.switch_tenant_error'),
          key: 'global',
          life: 4000,
        });
      },
    });
  }
}
