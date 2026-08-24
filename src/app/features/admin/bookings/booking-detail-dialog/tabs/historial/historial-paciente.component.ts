import { Component, computed, inject, signal, effect, untracked, ElementRef, AfterViewInit, OnDestroy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { Booking } from '@models';
import { HistorialStore } from '@core/stores/historial.store';
import { TimezoneService } from '@services/timezone.service';
import { bookingStatusChipClass } from '../../../constants/booking-statuses';
import { PaginatedCounterComponent } from './paginated-counter.component';
import { ScrollTopButtonComponent } from './scroll-top-button.component';
import { LoadMoreButtonComponent } from './load-more-button.component';

@Component({
  selector: 'bw-historial-paciente',
  standalone: true,
  imports: [
    CommonModule,
    TabsModule,
    TableModule,
    SkeletonModule,
    PaginatedCounterComponent,
    ScrollTopButtonComponent,
    LoadMoreButtonComponent,
  ],
  templateUrl: './historial-paciente.component.html',
  styleUrl: './historial-paciente.component.scss',
})
export class HistorialPacienteComponent implements AfterViewInit, OnDestroy {
  private readonly historialStore = inject(HistorialStore);
  private readonly tzService      = inject(TimezoneService);

  /** Client ID — read from the store's active client. */
  readonly clientId = input.required<number>();

  readonly loadingBookingsPage = this.historialStore.loadingBookingsPage;
  readonly bookingsPagination = this.historialStore.bookingsPagination;
  readonly bookingsShowingCount = this.historialStore.bookingsShowingCount;
  readonly rawBookings = this.historialStore.paginatedBookings;

  formatCardDate(iso: string): string {
    return this.tzService.formatCardDate(iso);
  }

  readonly activeSubTab = signal<'atenciones' | 'creaciones'>('atenciones');

  /** Bookings with status_id === 3 (Asiste), newest first */
  readonly attendedBookings = computed(() =>
    this.rawBookings()
      .filter(b => b.status_id === 3)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
  );

  /** All bookings sorted by created_at desc */
  readonly createdBookings = computed(() =>
    this.rawBookings()
      .filter(b => b.created_at)
      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()),
  );

  readonly currentList = computed(() =>
    this.activeSubTab() === 'atenciones' ? this.attendedBookings() : this.createdBookings(),
  );

  /** Total count for the current sub-tab */
  readonly currentTotal = computed(() =>
    this.activeSubTab() === 'atenciones'
      ? this.bookingsPagination().total
      : this.bookingsPagination().total,
  );

  // ── Scroll-to-top ─────────────────────────────────────────────────────────
  readonly showScrollTop = signal(false);
  private scrollContainer: HTMLElement | null = null;

  // ── IntersectionObserver for infinite scroll ───────────────────────────────
  private observer: IntersectionObserver | null = null;
  private sentinelEl: HTMLElement | null = null;

  ngAfterViewInit(): void {
    // Find the scrollable parent (the dialog body)
    this.scrollContainer = document.querySelector('.p-dialog-content') as HTMLElement | null;

    if (this.scrollContainer) {
      this.scrollContainer.addEventListener('scroll', this.onScroll);
    }

    // Set up IntersectionObserver for infinite scroll
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
            untracked(() => this.historialStore.loadNextBookingsPage(id));
          }
        }
      },
      { threshold: 0.1 },
    );

    // Observe the sentinel element
    setTimeout(() => {
      this.sentinelEl = document.querySelector('.hp-sentinel');
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
      untracked(() => this.historialStore.loadNextBookingsPage(id));
    }
  }

  onTabChange(value: string | number | undefined): void {
    if (value === 'atenciones' || value === 'creaciones') {
      this.activeSubTab.set(value);
    }
  }

  providerLabel(booking: Booking): string {
    if (booking.provider) {
      return `${booking.provider.first_name} ${booking.provider.last_name}`;
    }
    return 'No tiene';
  }

  statusChipClass(booking: Booking): string {
    return bookingStatusChipClass(booking.status?.name, booking.status_id);
  }
}
