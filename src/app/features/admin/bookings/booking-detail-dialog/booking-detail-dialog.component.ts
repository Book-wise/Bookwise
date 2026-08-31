import { AfterViewInit, Component, computed, inject, OnDestroy, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { Booking } from '@models';
import { ClientDetailStore } from '@core/stores/client-detail.store';
import { BookingDialogStore } from '@core/stores/booking-dialog.store';
import { PatientDetailContentComponent } from '@shared/components/patient-card/patient-detail-content.component';
import { PatientTab } from '@core/stores/client-detail.store';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { ClientsApiService } from '@services/api/clients-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { LanguageService } from '@services/language.service';
import { BookingStore } from '@core/stores/booking.store';
import { BOOKING_STATUSES } from '../constants/booking-statuses';
import { PaymentTabComponent } from './tabs/payment/payment-tab.component';
import { ReservaTabComponent } from './tabs/reserva/reserva-tab.component';
import { HistorialTabComponent } from './tabs/historial/historial-tab.component';

export type BookingTab = 'reserva' | 'pago' | 'recordatorios' | 'paciente' | 'ficha' | 'historial';

@Component({
  selector: 'bw-booking-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    TabsModule,
    SkeletonModule,
    SelectModule,
    PaymentTabComponent,
    ReservaTabComponent,
    HistorialTabComponent,
    PatientDetailContentComponent,
  ],
  providers: [ClientDetailStore, BookingDialogStore],
  templateUrl: './booking-detail-dialog.component.html',
  styleUrl: './booking-detail-dialog.component.scss',
})
export class BookingDetailDialogComponent implements AfterViewInit, OnDestroy {
  private bookingsApi = inject(BookingsApiService);
  private clientsApi = inject(ClientsApiService);
  private httpError = inject(HttpErrorService);
  private messageService = inject(MessageService);
  readonly lang = inject(LanguageService);
  readonly store = inject(BookingStore);
  readonly detailStore = inject(ClientDetailStore);
  readonly dialogStore = inject(BookingDialogStore);

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
    { value: 'ficha', label: 'Ficha' },
    { value: 'historial', label: 'Historial' },
  ];

  private readonly mobileTabsOnly = new Set<BookingTab>(['reserva', 'pago', 'ficha']);
  private readonly breakpointQuery = window.matchMedia('(max-width: 768px)');
  readonly isMobile = signal(this.breakpointQuery.matches);

  readonly visibleTabs = computed(() =>
    this.isMobile()
      ? this.TABS.filter(t => this.mobileTabsOnly.has(t.value))
      : this.TABS
  );

  ngAfterViewInit(): void {
    this.breakpointQuery.addEventListener('change', this.onBreakpointChange);
  }

  ngOnDestroy(): void {
    this.breakpointQuery.removeEventListener('change', this.onBreakpointChange);
  }

  private onBreakpointChange = (e: MediaQueryListEvent): void => {
    this.isMobile.set(e.matches);
  };

  readonly mobileTabTitle = computed(
    () => this.TABS.find((t) => t.value === this.activeTab())?.label ?? '',
  );

  readonly booking = this.dialogStore.booking;

  /** Narrowed patient tab currently filling the content area (safe when `activeView() !== 'reserva'`). */
  readonly activeDetailTab = computed<PatientTab>(() => {
    const view = this.detailStore.activeView();
    return view === 'reserva' ? 'planes' : view;
  });

  open(booking: Booking, tab: BookingTab = 'pago', scrollToTxn = false): void {
    this.store.selectBooking(booking);
    this.dialogStore.open(booking);
    if (booking.client?.id) {
      // Enrich the dialog copy with the full client (list payloads may carry a
      // partial `client` without email/phone), then load fresh detail data.
      this.clientsApi.getClient(booking.client.id).subscribe({
        next: (fullClient) => {
          const enriched = { ...booking, client: fullClient };
          this.dialogStore.replaceBooking(enriched);
          this.detailStore.initialize(fullClient);
          this.store.mergeBooking(enriched);
          this.loadDetailData(fullClient.id);
        },
        error: () => {
          this.detailStore.initialize(booking.client!);
          this.loadDetailData(booking.client!.id);
        },
      });
    } else {
      this.detailStore.reset();
    }
    this.activeTab.set(tab);
    this.scrollToTxn.set(scrollToTxn);
    this.selectedStatusId.set(booking.status_id ?? 0);
    this.visible.set(true);
  }

  /** Eagerly reload the patient detail domains so sub-tab disabled state is correct before first click. */
  private loadDetailData(clientId: number): void {
    this.detailStore.loadPacks(clientId);
    this.detailStore.loadSales(clientId);
    this.detailStore.loadRecent(clientId);
  }

  onTabChange(value: string | number | undefined): void {
    if (value !== undefined) {
      this.activeTab.set(value as BookingTab);
      this.detailStore.returnToReservation();
    }
  }

  onPatientTabSelected(tab: PatientTab): void {
    this.detailStore.selectTab(tab);
  }

  returnToReservation(): void {
    this.detailStore.returnToReservation();
    document.querySelector<HTMLElement>('.bw-booking-detail-dialog .p-dialog-content')?.scrollTo({ top: 0 });
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
    this.bookingsApi.updateBooking(booking.id, { status_id: newStatusId }).subscribe({
      next: (response: any) => {
        // 🔥 EL CAMBIO CRÍTICO: Extraemos la reserva real desde .data
        const updatedBooking = response.data as Booking;

        // Ahora el Store sí recibirá el objeto con el id correcto y sus nuevos colores
        this.store.mergeBooking(updatedBooking);
        this.dialogStore.replaceBooking(updatedBooking);

        this.messageService.add({
          severity: 'success',
          summary: this.lang.t('toast.booking_updated.summary'),
          detail: this.lang.t('toast.booking_updated.detail'),
          key: 'global',
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
      key: 'global',
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
    this.dialogStore.reset();
    this.detailStore.reset();
    if (!this._skipCloseCleanup) {
      this.store.setSelectedBookingId(null);
      this.scrollToTxn.set(false);
    }
    this._skipCloseCleanup = false;
  }
}
