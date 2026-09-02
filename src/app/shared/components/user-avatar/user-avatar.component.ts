import { Component, computed, input } from '@angular/core';

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
}
