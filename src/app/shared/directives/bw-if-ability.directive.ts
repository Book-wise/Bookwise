import {
  Directive,
  effect,
  inject,
  input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { AuthService } from '@services/auth.service';

/**
 * Directiva estructural que remueve un elemento del DOM cuando el usuario NO
 * posee el permission key indicado en el tenant activo.
 *
 *   <button *bwIfAbility="ABILITIES.locationsManage">Nueva sucursal</button>
 *
 * Es la frontera de UX para ocultar acciones/páginas enteras. El backend sigue
 * siendo la autoridad final: si algo escapa al ocultado, el 403
 * `permission_required` lo deniega. No es un control de seguridad.
 *
 * Semántica del input: `string` (un key) o `string[]` (requiere TODOS).
 */
@Directive({
  selector: '[bwIfAbility]',
  standalone: true,
})
export class BwIfAbilityDirective {
  private readonly auth = inject(AuthService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  readonly bwIfAbility = input.required<string | string[]>();

  private rendered = false;

  constructor() {
    // Re-evalúa ante cualquier cambio del input o de la lista de permissions.
    effect(() => {
      const required = this.bwIfAbility();
      const keys = Array.isArray(required) ? required : [required];
      const granted = this.auth.hasAllPermissions(...keys);

      if (granted && !this.rendered) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.rendered = true;
      } else if (!granted && this.rendered) {
        this.viewContainer.clear();
        this.rendered = false;
      }
    });
  }
}
