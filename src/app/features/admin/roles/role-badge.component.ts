import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { roleMeta } from './role-meta';
import { ROLE_ICON_PROVIDERS } from './role-icons';

export type RoleBadgeSize = 'sm' | 'md' | 'lg';

/** Box + glyph pixel sizes per variant (kept in sync with the legacy badges). */
const SIZES: Record<RoleBadgeSize, { box: number; glyph: number }> = {
  sm: { box: 18, glyph: 12 },
  md: { box: 22, glyph: 14 },
  lg: { box: 40, glyph: 18 },
};

/**
 * Single renderer for a role identity: a circular badge filled with the role
 * color holding its white Lucide glyph.
 *
 * Everything derives from {@link roleMeta}, so the slug → color + icon mapping
 * lives in exactly one place and every surface (cards, checkbox lists, selects,
 * provider chips) renders it identically. Registering its own icon provider
 * keeps the component self-contained wherever it is used.
 */
@Component({
  selector: 'bw-role-badge',
  standalone: true,
  imports: [LucideAngularModule],
  providers: [...ROLE_ICON_PROVIDERS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<lucide-icon [name]="meta().icon" [size]="dims().glyph" />`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      color: #fff;
      flex-shrink: 0;
    }

    lucide-icon {
      display: inline-flex;
    }
  `,
  host: {
    '[style.background]': 'meta().color',
    '[style.width.px]': 'dims().box',
    '[style.height.px]': 'dims().box',
  },
})
export class RoleBadgeComponent {
  /** Role slug (see `Role.slug`); drives both the color and the icon. */
  readonly slug = input.required<string>();

  /** Visual variant: `sm` for inline rows, `md` for selects, `lg` for cards. */
  readonly size = input<RoleBadgeSize>('md');

  protected readonly meta = computed(() => roleMeta(this.slug()));
  protected readonly dims = computed(() => SIZES[this.size()]);
}
