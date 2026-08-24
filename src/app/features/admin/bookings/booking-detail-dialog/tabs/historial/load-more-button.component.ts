import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

/**
 * "Ver más" button with loading state for paginated lists.
 * Hidden when there are no more pages.
 */
@Component({
  selector: 'bw-load-more-button',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  template: `
    @if (hasMore()) {
      <div class="bw-load-more">
        <button
          pButton
          type="button"
          label="Ver más"
          icon="pi pi-refresh"
          [loading]="loading()"
          [disabled]="loading()"
          class="p-button-text p-button-sm bw-load-more__btn"
          (click)="loadMore.emit()"
        ></button>
      </div>
    }
  `,
  styles: `
    .bw-load-more {
      display: flex;
      justify-content: center;
      padding: 0.75rem 0;
    }

    .bw-load-more__btn {
      color: var(--bw-300, #046af4) !important;
      font-weight: var(--bw-weight-semibold, 600);
      font-size: var(--bw-font-table, 0.8125rem);
    }
  `,
})
export class LoadMoreButtonComponent {
  /** Whether there are more pages to load. */
  readonly hasMore = input(false);

  /** Whether a page is currently loading. */
  readonly loading = input(false);

  /** Emitted when the user clicks "Ver más". */
  readonly loadMore = output<void>();
}
