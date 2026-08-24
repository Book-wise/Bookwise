import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * "Mostrando X de Y" counter for paginated lists.
 */
@Component({
  selector: 'bw-paginated-counter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bw-counter">
      <span class="bw-counter__text">
        Mostrando <strong>{{ showing() }}</strong> de <strong>{{ total() }}</strong> {{ label() }}
        @if (filterBadge()) {
          <span class="bw-counter__badge">{{ filterBadge() }}</span>
        }
      </span>
    </div>
  `,
  styles: `
    .bw-counter {
      font-size: var(--bw-font-caption, 0.75rem);
      color: var(--text-color-secondary, #6b7280);
      padding: 0 0 0.5rem 0;
    }

    .bw-counter__text strong {
      font-weight: var(--bw-weight-semibold, 600);
      color: var(--text-color, #111827);
    }

    .bw-counter__badge {
      display: inline-flex;
      align-items: center;
      margin-left: 0.375rem;
      padding: 0.05rem 0.4rem;
      font-size: 0.6875rem;
      font-weight: var(--bw-weight-semibold, 600);
      color: #fff;
      background: #1FB27C;
      border-radius: var(--bw-radius-sm, 4px);
      vertical-align: middle;
    }
  `,
})
export class PaginatedCounterComponent {
  /** Number of items currently shown. */
  readonly showing = input(0);

  /** Total number of items available. */
  readonly total = input(0);

  /** Label for the item type — e.g., "reservaciones", "pagos". */
  readonly label = input('reservaciones');

  /** Optional filter badge — e.g., "Asiste", "Confirmado". */
  readonly filterBadge = input<string | null>(null);
}
