import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Popover, PopoverModule } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';

/** Item del menú de cuenta. `logout` marca el cierre de sesión; si no, se navega a `route`. */
interface AccountMenuItem {
  icon: string;
  label: string;
  route?: string;
  logout?: boolean;
}

/**
 * Chip de usuario + menú de cuenta (popover) con ítems adaptados al rol de sesión.
 *
 * Reutilizado por el layout admin y el del profesional:
 *  - provider: solo lo que el profesional necesita (Mi perfil + Cerrar sesión).
 *  - admin:    Mi perfil + Información del negocio + Roles + Cerrar sesión.
 *
 * El encabezado del popover lleva la identidad (avatar + nombre + rol) y el
 * ítem de logout siempre está disponible, aunque la sidebar esté colapsada.
 */
@Component({
  selector: 'bw-account-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PopoverModule, ButtonModule, UserAvatarComponent],
  templateUrl: './account-menu.component.html',
  styleUrls: ['./account-menu.component.scss'],
})
export class AccountMenuComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly lang = inject(LanguageService);

  /** True cuando la sidebar está colapsada → se muestra el chip solo con avatar. */
  collapsed = input(false);

  readonly userName = computed(() => this.auth.user()?.name ?? '');
  readonly userRoleLabel = computed(() => {
    const role = this.auth.userRole();
    if (role === 'admin') return this.lang.t('ui.role.admin');
    if (role === 'provider') return this.lang.t('ui.role.provider');
    return '';
  });

  /** Negocio del usuario (para admin): nombre + RUT, visible en el popover. */
  readonly business = computed(() => this.auth.me()?.business ?? null);
  readonly businessMonogram = computed(() =>
    (this.business()?.name ?? 'B').trim().charAt(0).toUpperCase(),
  );

  /** Ítems según el rol de sesión (capas separadas de los roles de negocio). */
  readonly items = computed<AccountMenuItem[]>(() => {
    if (this.auth.userRole() === 'provider') {
      return [
        { icon: 'pi pi-id-card', label: this.lang.t('nav.profile'), route: '/provider/profile' },
        { icon: 'pi pi-cog', label: this.lang.t('nav.settings'), route: '/provider/configuraciones' },
        { icon: 'pi pi-sign-out', label: this.lang.t('ui.logout'), logout: true },
      ];
    }

    return [
      { icon: 'pi pi-id-card', label: this.lang.t('nav.profile'), route: '/admin/profile' },
      { icon: 'pi pi-building', label: this.lang.t('account.business_primary'), route: '/admin/profile' },
      { icon: 'pi pi-shield', label: this.lang.t('nav.roles'), route: '/admin/roles' },
      { icon: 'pi pi-cog', label: this.lang.t('nav.settings'), route: '/admin/configuraciones' },
      { icon: 'pi pi-sign-out', label: this.lang.t('ui.logout'), logout: true },
    ];
  });

  /** Cierra el popover y ejecuta la acción (logout o navegación). */
  onItemClick(item: AccountMenuItem, popover: Popover): void {
    popover.hide();
    if (item.logout) {
      this.auth.logout();
    } else if (item.route) {
      this.router.navigate([item.route]);
    }
  }
}
