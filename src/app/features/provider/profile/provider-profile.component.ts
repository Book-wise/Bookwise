import { Component } from '@angular/core';
import { ProfileComponent } from '../../admin/profile/profile.component';

/**
 * Perfil del profesional: reutiliza `bw-profile` pero con la sección
 * "Información del negocio" oculta (`showBusiness=false`), ya que el
 * profesional no gestiona el negocio.
 */
@Component({
  selector: 'bw-provider-profile',
  standalone: true,
  imports: [ProfileComponent],
  template: `<bw-profile [showBusiness]="false" />`,
})
export class ProviderProfileComponent {}
