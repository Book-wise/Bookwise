import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LanguageService } from '@services/language.service';

interface NavItem {
  /** i18n key del label. */
  labelKey: string;
  /** Clase PrimeIcons (`pi pi-*`). */
  icon: string;
  link: string;
  /** `true` evita que el ítem quede activo en sus rutas hijas. */
  exact?: boolean;
}

interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

/**
 * Navegación lateral del área de cuenta/facturación, agrupada en **Pago** y
 * **Plan** (referencia visual: AgendaPro "Datos de facturación").
 *
 * Puramente presentacional: no consulta datos ni permisos. "Preguntas
 * frecuentes" no está porque la sección no existe.
 */
@Component({
  selector: 'bw-account-settings-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './account-settings-nav.component.html',
  styleUrls: ['./account-settings-nav.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSettingsNavComponent {
  readonly lang = inject(LanguageService);

  readonly groups: NavGroup[] = [
    {
      titleKey: 'billing.nav.group_payment',
      items: [
        { labelKey: 'billing.nav.account_status', icon: 'pi-credit-card', link: '/admin/facturacion', exact: true },
        { labelKey: 'billing.nav.payment_history', icon: 'pi-download', link: '/admin/facturacion/historial' },
        { labelKey: 'billing.nav.billing_data', icon: 'pi-user', link: '/admin/facturacion/datos' },
      ],
    },
    {
      titleKey: 'billing.nav.group_plan',
      items: [
        { labelKey: 'billing.nav.my_plan', icon: 'pi-file', link: '/admin/planes', exact: true },
        { labelKey: 'billing.nav.manage_plan', icon: 'pi-cog', link: '/admin/planes/administrar' },
      ],
    },
  ];
}
