import { Component, computed, input } from '@angular/core';
import { resolveApiUrl } from '@shared/utils/api-url.util';

@Component({
  selector: 'bw-user-avatar',
  standalone: true,
  templateUrl: './user-avatar.component.html',
  styleUrl: './user-avatar.component.scss',
})
export class UserAvatarComponent {
  readonly name = input<string | null | undefined>(undefined);
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  /**
   * Imagen opcional (avatar de usuario o logo de negocio). Si viene una URL se
   * muestra la `<img>`; si no, cae a las iniciales/monograma. Permite que un
   * único componente sirva a personas y negocios con su fallback por nombre.
   */
  readonly image = input<string | null | undefined>(undefined);

  /**
   * URL ya resuelta contra la base de la API. El backend devuelve rutas
   * relativas (/storage/…); este computado las convierte en absolutas usando
   * `environment.apiUrl`, así el asset carga en cualquier entorno.
   */
  readonly resolvedImage = computed(() => resolveApiUrl(this.image()));

  /**
   * Forma del marco. `circle` (defecto) para avatares de persona; `square`
   * (redondeado) para logos de negocio, que se ven mejor encuadrados.
   */
  readonly shape = input<'circle' | 'square'>('circle');

  readonly hasImage = computed(() => !!this.resolvedImage()?.trim());

  /**
   * Iniciales a partir del nombre completo: primera letra del primer y del
   * último token no vacío. Un solo token → su primera letra. Sin nombre → '?'.
   * Ej.: 'Beatriz González' → 'BG', 'Sebastian' → 'S'.
   */
  readonly initials = computed(() => {
    const name = this.name()?.trim() ?? '';
    if (!name) return '?';

    const tokens = name.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return '?';
    if (tokens.length === 1) return tokens[0][0].toUpperCase();

    return `${tokens[0][0]}${tokens[tokens.length - 1][0]}`.toUpperCase();
  });

  /**
   * Monograma de una letra para logos de negocio sin imagen (nombre corto).
   */
  readonly monogram = computed(() => (this.name()?.trim().charAt(0) ?? 'B').toUpperCase());
}
