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
import { ClientDetailStore } from '@core/stores/client-detail.store';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { BookingStore } from '@core/stores/booking.store';
import { BOOKING_STATUSES } from '../constants/booking-statuses';
import { PaymentTabComponent } from './payment-tab.component';
import { ReservaTabComponent } from './reserva-tab.component';
import { HistorialTabComponent } from './historial-tab.component';

export type BookingTab = 'reserva' | 'pago' | 'recordatorios' | 'paciente' | 'ficha' | 'historial';

@Component({
  selector: 'bw-payment-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    TagModule,
    TabsModule,
    SkeletonModule,
    SelectModule,
    PaymentTabComponent,
    ReservaTabComponent,
    HistorialTabComponent,
  ],
  providers: [ClientDetailStore],
  templateUrl: './payment-detail-dialog.component.html',
  styleUrl: './payment-detail-dialog.component.scss',
})
export class PaymentDetailDialogComponent {
  private api = inject(ApiService);
  private httpError = inject(HttpErrorService);
  private messageService = inject(MessageService);
  readonly lang = inject(LanguageService);
  readonly store = inject(BookingStore);

  visible = signal(false);
  activeTab = signal<BookingTab>('pago');
  scrollToTxn = signal(false);
  selectedStatusId = signal<number>(0);

  readonly statusOptions = BOOKING_STATUSES.map((s) => ({
    label: s.label,
    value: s.value,
    color: s.color,
  }));

  readonly backToDetail = output<Booking>();

  readonly TABS: { value: BookingTab; label: string }[] = [
    { value: 'reserva', label: 'Reserva' },
    { value: 'pago', label: 'Pago' },
    { value: 'recordatorios', label: 'Recordatorios' },
    { value: 'paciente', label: 'Paciente' },
    { value: 'ficha', label: 'Ficha médica' },
    { value: 'historial', label: 'Historial' },
  ];

  readonly mobileTabTitle = computed(
    () => this.TABS.find((t) => t.value === this.activeTab())?.label ?? '',
  );

  readonly booking = computed(() => this.store.selectedBooking());

  readonly statusSeverity = computed(() => {
    const name = this.store.selectedBooking()?.status?.name?.toLowerCase();
    if (!name) return undefined as any;
    if (name.includes('confirm')) return 'success';
    if (name.includes('cancel')) return 'danger';
    if (name.includes('pendiente') || name.includes('espera')) return 'warn';
    if (name.includes('asiste') || name.includes('completa')) return 'info';
    return 'secondary';
  });

  open(booking: Booking, tab: BookingTab = 'pago', scrollToTxn = false): void {
    this.store.selectBooking(booking);
    this.activeTab.set(tab);
    this.scrollToTxn.set(scrollToTxn);
    this.selectedStatusId.set(booking.status_id ?? 0);
    this.visible.set(true);
  }

  onTabChange(value: string | number | undefined): void {
    if (value !== undefined) this.activeTab.set(value as BookingTab);
  }

  // onStatusChange(newStatusId: number): void {
  //   const booking = this.store.selectedBooking();
  //   if (!booking?.id) return;

  //   const previousId = this.selectedStatusId();
  //   this.selectedStatusId.set(newStatusId);

  //   this.api.updateBooking(booking.id, { status_id: newStatusId }).subscribe({
  //     next: (updated) => {
  //       // Merge updated booking back into store
  //       this.store.mergeBooking(updated);
  //       this.messageService.add({
  //         severity: 'success',
  //         summary: this.lang.t('toast.booking_updated.summary'),
  //         detail:  this.lang.t('toast.booking_updated.detail'),
  //         life: 3000,
  //       });
  //     },
  //     error: (err) => {
  //       this.selectedStatusId.set(previousId);
  //       this.httpError.handle(err, 'actualizar estado');
  //     },
  //   });
  // }

  onStatusChange(newStatusId: number): void {
    const booking = this.store.selectedBooking();
    if (!booking?.id) return;

    const previousId = this.selectedStatusId();
    this.selectedStatusId.set(newStatusId);

    // Tipamos la respuesta como 'any' o creas una interfaz contenedora
    this.api.updateBooking(booking.id, { status_id: newStatusId }).subscribe({
      next: (response: any) => {
        // 🔥 EL CAMBIO CRÍTICO: Extraemos la reserva real desde .data
        const updatedBooking = response.data as Booking;

        // Ahora el Store sí recibirá el objeto con el id correcto y sus nuevos colores
        this.store.mergeBooking(updatedBooking);

        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('toast.booking_updated.summary'),
          detail: this.lang.t('toast.booking_updated.detail'),
          life: 3000,
        });
      },
      error: (err) => {
        this.selectedStatusId.set(previousId);
        this.httpError.handle(err, 'actualizar estado');
      },
    });
  }

  deleteBooking(): void {
    const booking = this.booking();
    if (!booking?.id) return;

    const confirmed = confirm(
      `¿Eliminar la reserva de ${booking.client?.first_name ?? ''} ${booking.client?.last_name ?? ''}?\n` +
        'Los pagos registrados no se verán afectados.',
    );
    if (!confirmed) return;

    this.store.deleteBooking(booking.id);

    // Show confirmation toast
    this.messageService.add({
      severity: 'success',
      summary: this.lang.t('toast.booking_cancelled.summary'),
      detail: this.lang.t('toast.booking_cancelled.detail'),
      life: 3000,
    });

    this.close();
  }

  private _skipCloseCleanup = false;

  goBack(): void {
    this._skipCloseCleanup = true;
    const booking = this.store.selectedBooking();
    this.visible.set(false);
    this.scrollToTxn.set(false);
    if (booking) this.backToDetail.emit(booking);
  }

  close(): void {
    this.visible.set(false);
    if (!this._skipCloseCleanup) {
      this.store.setSelectedBookingId(null);
      this.scrollToTxn.set(false);
    }
    this._skipCloseCleanup = false;
  }
}
