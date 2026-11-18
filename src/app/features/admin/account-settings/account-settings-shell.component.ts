import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AccountSettingsNavComponent } from '@shared/components/account-settings-nav/account-settings-nav.component';

/**
 * Layout del área de cuenta: sidebar agrupado (Pago / Plan) + contenido.
 *
 * Se monta como padre de ruta de `/admin/facturacion/**` y `/admin/planes/**`
 * para que la navegación viva en un solo lugar y las URLs no cambien.
 */
@Component({
  selector: 'bw-account-settings-shell',
  standalone: true,
  imports: [RouterOutlet, AccountSettingsNavComponent],
  template: `
    <div class="as-shell">
      <bw-account-settings-nav class="as-shell__nav" />
      <div class="as-shell__content">
        <router-outlet />
      </div>
    </div>
  `,
  styles: [
    `
      .as-shell {
        display: grid;
        grid-template-columns: 15rem minmax(0, 1fr);
        gap: 1.5rem;
        align-items: start;
      }

      .as-shell__nav {
        position: sticky;
        top: 1rem;
      }

      .as-shell__content {
        min-width: 0;
      }

      @media (max-width: 1023px) {
        .as-shell {
          grid-template-columns: minmax(0, 1fr);
        }

        .as-shell__nav {
          position: static;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSettingsShellComponent {}
