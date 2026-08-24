import { Component, inject, signal, AfterViewInit, OnDestroy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { Booking } from '@models';
import { HistorialStore } from '@core/stores/historial.store';
import { TimezoneService } from '@services/timezone.service';
import { bookingStatusChipClass } from '../../../constants/booking-statuses';
import { PaginatedCounterComponent } from './paginated-counter.component';
import { ScrollTopButtonComponent } from './scroll-top-button.component';
import { LoadMoreButtonComponent } from './load-more-button.component';

@Component({
  selector: 'bw-historial-reserva',
  standalone: true,
  imports: [
    CommonModule,
    SkeletonModule,
    PaginatedCounterComponent,
    ScrollTopButtonComponent,
    LoadMoreButtonComponent,
  ],
  templateUrl: './historial-reserva.component.html',
  styleUrl: './historial-reserva.component.scss',
})
export class HistorialReservaComponent implements AfterViewInit, OnDestroy {
  private readonly historialStore = inject(HistorialStore);
  private readonly tzService      = inject(TimezoneService);

  /** Client ID — read from the store's active client. */
  readonly clientId = input.required<number>();

  readonly loadingBookingsPage = this.historialStore.loadingBookingsPage;
  readonly bookings = this.historialStore.paginatedBookings;
  readonly bookingsPagination = this.historialStore.bookingsPagination;
  readonly bookingsShowingCount = this.historialStore.bookingsShowingCount;

  // ── Scroll-to-top ─────────────────────────────────────────────────────────
  readonly showScrollTop = signal(false);
  private scrollContainer: HTMLElement | null = null;

  // ── IntersectionObserver for infinite scroll ───────────────────────────────
  private observer: IntersectionObserver | null = null;
  private sentinelEl: HTMLElement | null = null;

  ngAfterViewInit(): void {
    this.scrollContainer = document.querySelector('.p-dialog-content') as HTMLElement | null;

    if (this.scrollContainer) {
      this.scrollContainer.addEventListener('scroll', this.onScroll);
    }

    this.setupObserver();
  }

  ngOnDestroy(): void {
    this.scrollContainer?.removeEventListener('scroll', this.onScroll);
    this.observer?.disconnect();
  }

  private setupObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !this.loadingBookingsPage() && this.bookingsPagination().hasMore) {
          const id = this.clientId();
          if (id) {
            this.historialStore.loadNextBookingsPage(id);
          }
        }
      },
      { threshold: 0.1 },
    );

    setTimeout(() => {
      this.sentinelEl = document.querySelector('.hr-sentinel');
      if (this.sentinelEl) {
        this.observer?.observe(this.sentinelEl);
      }
    });
  }

  onScroll = (): void => {
    if (this.scrollContainer) {
      this.showScrollTop.set(this.scrollContainer.scrollTop > 300);
    }
  };

  scrollToTop(): void {
    this.scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
    this.showScrollTop.set(false);
  }

  onLoadMore(): void {
    const id = this.clientId();
    if (id) {
      this.historialStore.loadNextBookingsPage(id);
    }
  }

  formatDateTime(iso: string): string {
    return this.tzService.formatCardDate(iso);
  }

  formatCreatedAt(iso: string | undefined): string {
    return iso ? this.tzService.formatCardDate(iso) : '—';
  }

  statusChipClass(statusName: string | undefined, statusId?: number): string {
    return bookingStatusChipClass(statusName, statusId);
  }

  actionLabel(booking: Booking): string {
    const via = booking.last_modified_via && booking.last_modified_via !== booking.created_via
      ? booking.last_modified_via
      : null;

    if (via) {
      switch (via) {
        case 'admin_calendar': return 'Modificada por Calendario';
        case 'agent':          return 'Modificada por Asistente';
      }
    }

    switch (booking.created_via) {
      case 'admin_calendar': return 'Creada por Calendario';
      case 'agent':          return 'Creada por Asistente';
      case 'online_webhook': return 'Creada Online';
      default:               return '—';
    }
  }
}
