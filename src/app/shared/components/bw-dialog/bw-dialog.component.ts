import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  booleanAttribute,
  computed,
  input,
  model,
  output,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';

/**
 * `bw-dialog` — fachada del design system sobre `<p-dialog>`.
 *
 * Primer piloto de la etapa 2: el estado lo posee la app (signals), no
 * PrimeNG. El consumidor usa `[(visible)]` y `(dismissed)`; nunca
 * `[visible]` + `(visibleChange)` ni `pTemplate`. Si algún día cambia
 * PrimeNG (o se va), este archivo es el único que se toca.
 *
 * Qué expone PrimeNG a través de la fachada (sin filtrarse al consumidor):
 * - `[visible]` + `(visibleChange)` → `visible = model()` + `dismissed`.
 *   `visibleChange` significa "el usuario pidió cerrar" (X, ESC, máscara),
 *   así que `dismissed` solo se emite por esa vía; un cierre programático del
 *   padre no lo dispara.
 * - `[header]` (string) → mismo input, con el título ya traducido por el
 *   consumidor.
 * - `[footerTemplate]` → `footer` con un `TemplateRef` del consumidor.
 * - Tamaño (`[style]`) → `width` / `maxWidth`.
 */
@Component({
  selector: 'bw-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule],
  templateUrl: './bw-dialog.component.html',
  styleUrl: './bw-dialog.component.scss',
})
export class BwDialogComponent {
  /** Estado de apertura, dos vías: `[(visible)]`. */
  readonly visible = model(false);

  /** Título plano del diálogo (ya traducido por el consumidor). */
  readonly header = input('');

  readonly width = input('480px');
  readonly maxWidth = input('95vw');
  readonly modal = input(true, { transform: booleanAttribute });
  readonly closable = input(true, { transform: booleanAttribute });
  readonly dismissableMask = input(true, { transform: booleanAttribute });

  /**
   * Acciones del pie. Sin template no reserva altura: PrimeNG no renderiza el
   * contenedor de footer.
   */
  readonly footer = input<TemplateRef<void> | undefined>(undefined);

  /** El usuario pidió cerrar: X, ESC o click en la máscara. */
  readonly dismissed = output<void>();

  readonly dialogStyle = computed(() => ({
    width: this.width(),
    maxWidth: this.maxWidth(),
  }));

  onVisibleChange(visible: boolean): void {
    this.visible.set(visible);
    if (!visible) {
      this.dismissed.emit();
    }
  }
}
