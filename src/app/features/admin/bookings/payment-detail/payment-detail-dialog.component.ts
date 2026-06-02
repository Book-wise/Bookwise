import { Component, computed, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { Booking } from '@models';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { BookingUpdateService } from '@services/booking-update.service';
import { BOOKING_STATUSES } from '../constants/booking-statuses';
import { PaymentTabComponent } from './payment-tab.component';
import { ReservaTabComponent } from './reserva-tab.component';

export type BookingTab = 'reserva' | 'pago' | 'recordatorios' | 'paciente' | 'ficha' | 'historial';

@Component({
  selector: 'bw-payment-detail-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, TagModule, TabsModule, SkeletonModule, SelectModule, PaymentTabComponent, ReservaTabComponent],
  templateUrl: './payment-detail-dialog.component.html',
  styleUrl: './payment-detail-dialog.component.scss',
})
export class PaymentDetailDialogComponent {
  private api            = inject(ApiService);
  private httpError      = inject(HttpErrorService);
  private messageService = inject(MessageService);
  readonly lang          = inject(LanguageService);
  private bookingUpdate  = inject(BookingUpdateService);

  visible           = signal(false);
  booking           = signal<Booking | null>(null);
  activeTab         = signal<BookingTab>('pago');
  scrollToTxn       = signal(false);
  selectedStatusId  = signal<number>(0);

  readonly statusOptions = BOOKING_STATUSES.map(s => ({ label: s.label, value: s.value, color: s.color }));

  readonly backToDetail = output<Booking>();

  readonly TABS: { value: BookingTab; label: string }[] = [
    { value: 'reserva',       label: 'Reserva' },
    { value: 'pago',          label: 'Pago' },
    { value: 'recordatorios', label: 'Recordatorios' },
    { value: 'paciente',      label: 'Paciente' },
    { value: 'ficha',         label: 'Ficha médica' },
    { value: 'historial',     label: 'Historial' },
  ];

  readonly mobileTabTitle = computed(() =>
    this.TABS.find(t => t.value === this.activeTab())?.label ?? ''
  );

  readonly statusSeverity = computed(() => {
    const name = this.booking()?.status?.name?.toLowerCase();
    if (!name) return undefined as any;
    if (name.includes('confirm'))  return 'success';
    if (name.includes('cancel'))   return 'danger';
    if (name.includes('pendiente') || name.includes('espera')) return 'warn';
    if (name.includes('asiste') || name.includes('completa')) return 'info';
    return 'secondary';
  });

  open(booking: Booking, tab: BookingTab = 'pago', scrollToTxn = false): void {
    this.booking.set(booking);
    this.activeTab.set(tab);
    this.scrollToTxn.set(scrollToTxn);
    this.selectedStatusId.set(booking.status_id ?? 0);
    this.visible.set(true);
  }

  onTabChange(value: string | number | undefined): void {
    if (value !== undefined) this.activeTab.set(value as BookingTab);
  }

  onBookingUpdated(updated: Booking): void {
    this.booking.set(updated);
    this.selectedStatusId.set(updated.status_id ?? 0);
  }

  onStatusChange(newStatusId: number): void {
    const booking = this.booking();
    if (!booking?.id) return;

    const previousId = this.selectedStatusId();
    this.selectedStatusId.set(newStatusId);

    this.api.updateBooking(booking.id, { status_id: newStatusId }).subscribe({
      next: (updated) => {
        const current = this.booking();
        if (current) {
          this.booking.set({ ...current, status_id: updated.status_id, status: updated.status });
          this.bookingUpdate.notify({ ...current, status_id: updated.status_id, status: updated.status });
        }
        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('toast.booking_updated.summary'),
          detail:  this.lang.t('toast.booking_updated.detail'),
          life: 3000,
        });
      },
      error: (err) => {
        this.selectedStatusId.set(previousId);
        this.httpError.handle(err, 'actualizar estado');
      },
    });
  }

  goBack(): void {
    const booking = this.booking();
    this.visible.set(false);
    this.booking.set(null);
    this.scrollToTxn.set(false);
    if (booking) this.backToDetail.emit(booking);
  }

  close(): void {
    this.visible.set(false);
    this.booking.set(null);
    this.scrollToTxn.set(false);
  }
}
