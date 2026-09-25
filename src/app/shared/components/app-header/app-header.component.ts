import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Popover, PopoverModule } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { Appearance, APPEARANCE_OPTIONS, ThemeService } from '@services/theme.service';
import { TenantSwitchService } from '@services/tenant-switch.service';
import { Business } from '@models';
import { AccountMenuComponent } from '@shared/components/account-menu/account-menu.component';
import { UserAvatarComponent } from '@shared/components/user-avatar/user-avatar.component';
import { switchTenantErrorKey } from '@shared/utils/switch-tenant-error.util';

/**
 * Barra superior de la app: muestra el negocio en uso (multi-tenant) con selector
 * para admin_general, el selector de apariencia (claro / oscuro / Kinesilk) y el
 * menú de usuario. Aligera el sidebar (que queda solo con navegación).
 */
@Component({
  selector: 'bw-app-header',
  standalone: true,
  imports: [
    CommonModule, FormsModule, AccountMenuComponent, UserAvatarComponent,
    PopoverModule, ButtonModule, SelectModule,
  ],
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.scss'],
})
export class AppHeaderComponent {
  private auth = inject(AuthService);
  private themeService = inject(ThemeService);
  private tenantSwitch = inject(TenantSwitchService);
  private messageService = inject(MessageService);
  readonly lang = inject(LanguageService);

  readonly business = computed(() => this.auth.me()?.business ?? null);
  readonly businesses = computed(() => this.auth.me()?.businesses ?? []);
  readonly businessMonogram = computed(() =>
    (this.business()?.name || 'B').trim().charAt(0).toUpperCase(),
  );
  /** Logo del negocio activo, o null → el componente cae al monograma. */
  readonly businessLogo = computed(() => this.business()?.logo_url ?? null);
  readonly currentBusinessId = computed(() => this.business()?.id ?? null);

  /** Solo admin_general con varios negocios puede alternar; provider es lectura. */
  readonly canSwitch = computed(() => this.businesses().length > 1);

  readonly appearance = computed(() => this.themeService.appearance);

  /** 3-option selector labels resolved through i18n (reactive to language changes). */
  readonly appearanceOptions = computed(() =>
    APPEARANCE_OPTIONS.map((opt) => ({ label: this.lang.t(opt.labelKey), value: opt.value })),
  );

  /** True cuando la sidebar está abierta en mobile (cambia hamburguesa ↔ ✕). */
  readonly mobileMenuOpen = input(false);

  /** Callback para abrir/cerrar la sidebar en mobile (lo provee el layout). */
  readonly onToggleMenu = input<() => void>(() => {});

  constructor() {
    // Garantiza /auth/me cargado (para el indicador de empresa en admin y provider).
    if (!this.auth.meLoaded()) {
      this.auth.loadMe().subscribe();
    }
  }

  onAppearanceChange(mode: Appearance): void {
    this.themeService.setAppearance(mode);
  }

  /** Cambia de negocio (admin_general) delegando en el coordinador del switch. */
  switchTo(biz: Business): void {
    this.tenantSwitch.switchTenant(biz.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('biz.switched_to', { name: biz.name }),
          key: 'global',
          life: 3500,
        });
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.lang.t('ui.error'),
          detail: this.lang.t(switchTenantErrorKey(err)),
          key: 'global',
          life: 4000,
        });
      },
    });
  }
}
