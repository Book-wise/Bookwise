import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Floating scroll-to-top button — emerald-600 color, smooth animation.
 * Parent controls visibility via the `visible` input signal.
 */
@Component({
  selector: 'bw-scroll-top-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible()) {
      <button
        type="button"
        class="bw-scroll-top"
        (click)="clicked.emit()"
        aria-label="Volver arriba"
      >
        <i class="pi pi-arrow-up"></i>
      </button>
    }
  `,
  styles: `
    .bw-scroll-top {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 50%;
      border: none;
      background: #059669;
      color: #fff;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35);
      z-index: 1000;
      opacity: 0;
      transform: translateY(1rem);
      transition: opacity 0.3s ease, transform 0.3s ease;
    }

    .bw-scroll-top {
      opacity: 1;
      transform: translateY(0);
    }
  `,
})
export class ScrollTopButtonComponent {
  /** Whether the button is visible. */
  readonly visible = input(false);

  /** Emitted when the button is clicked. */
  readonly clicked = output<void>();
}
