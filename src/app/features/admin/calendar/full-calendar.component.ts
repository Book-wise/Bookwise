import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  ViewChild,
  AfterViewInit,
  HostListener,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { PopoverModule, Popover } from 'primeng/popover';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { ApiService } from '@services/api.service';
import { TimezoneService } from '@services/timezone.service';
import { Booking, BlockedSlot, Location, Provider } from '@models';
import { BookingDialogComponent } from '../bookings/booking-dialog/booking-dialog.component';
import { BookingFormDialogComponent } from '../bookings/booking-form-dialog/booking-form-dialog.component';
import { BlockTimeDialogComponent } from '../bookings/block-time-dialog/block-time-dialog.component';
import { PaymentDetailDialogComponent } from '../bookings/payment-detail/payment-detail-dialog.component';
import { BOOKING_STATUSES } from '../bookings/constants/booking-statuses';
import { BwCurrencyPipe } from '@shared/pipes/bw-currency.pipe';
import { LanguageService } from '@services/language.service';
import { BookingStore } from '@core/stores/booking.store';

import { HttpErrorService } from '@services/http-error.service';
import {
  Calendar, CalendarOptions, EventClickArg, DateSelectArg,
  EventContentArg, EventInput, EventSourceFuncArg, EventDropArg,
} from '@fullcalendar/core';
import { EventResizeDoneArg } from '@fullcalendar/interaction';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import esLocale from '@fullcalendar/core/locales/es';
import luxonPlugin from '@fullcalendar/luxon';

@Component({
  selector: 'bw-full-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    SelectModule,
    MultiSelectModule,
    TagModule,
    DialogModule,
    SkeletonModule,
    BookingDialogComponent,
    BookingFormDialogComponent,
    PopoverModule,
    BlockTimeDialogComponent,
    PaymentDetailDialogComponent,
    BwCurrencyPipe,
  ],
  templateUrl: './full-calendar.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FullCalendarComponent implements OnInit, OnDestroy, AfterViewInit {
  private api            = inject(ApiService);
  private messageService = inject(MessageService);
  private ngZone         = inject(NgZone);
  readonly lang          = inject(LanguageService);
  readonly store         = inject(BookingStore);
  private httpError      = inject(HttpErrorService);
  private tzService      = inject(TimezoneService);
  private calendar: Calendar | null = null;
  private nowLabelInterval: ReturnType<typeof setInterval> | null = null;
  private refreshScheduled = false;
  private _dragMutPending = false;

  /** Metadata for the pending drag/event-move toast */
  private _dragToastMeta: {
    clientName: string; serviceName: string;
    oldStart: string; newStart: string;
    meta: string | null;
  } | null = null;

  @ViewChild('calendarContainer') calendarContainer!: ElementRef;
  @ViewChild('eventTooltip') eventTooltip!: Popover;
  @ViewChild(BookingDialogComponent) bookingDialog!: BookingDialogComponent;
  @ViewChild(BookingFormDialogComponent) newBookingDialog!: BookingFormDialogComponent;
  @ViewChild(BlockTimeDialogComponent)   blockTimeDialog!: BlockTimeDialogComponent;
  @ViewChild(PaymentDetailDialogComponent) paymentDialog!: PaymentDetailDialogComponent;

  loading = signal(true);
  providersLoading = signal(false);
  hoveredBooking = signal<Booking | null>(null);
  locations = signal<Location[]>([]);
  providers = signal<Provider[]>([]);

  // Local filter state — synced to BookingStore via onFilterChange
  selectedLocationId: number | null = null;
  selectedProviderId: number | null = null;
  selectedStatusIds: number[] = [];

  statusFilterOptions = computed(() =>
    BOOKING_STATUSES.map(s => ({ label: this.lang.t(s.labelKey), value: s.value, color: s.color }))
  );
  private previousLocationId: number | null = null;
  selectedDate: Date | null = null;
  selectedEndDate: Date | null = null;

  // Popover for slot selection
  showSlotMenu = signal(false);
  slotMenuPosition = { x: 0, y: 0 };
  private readonly SLOT_PREVIEW_ID = 'bw-slot-preview';

  // Signal para detectar viewport
  isMobile = signal(false);

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin, listPlugin, timeGridPlugin, luxonPlugin],
    initialView: 'timeGridWeek',
    slotMinTime: '09:00:00',
    slotMaxTime: '21:00:00',
    locale: this.lang.lang() === 'en' ? 'en' : esLocale,
    // Timezone desde servicio centralizado
    timeZone: this.tzService.activeTimezone(),
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'bwNewBooking bwBlockTime dayGridMonth,timeGridWeek,timeGridDay',
    },
    buttonText: {
      today: this.lang.t('cal.today'),
      month: this.lang.t('cal.month'),
      week:  this.lang.t('cal.week'),
      day:   this.lang.t('cal.day'),
      list:  this.lang.t('cal.list'),
    },
    nowIndicator: true,
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    weekends: true,
    longPressDelay: 300,
    eventLongPressDelay: 300,
    selectLongPressDelay: 300,
    events: (
      fetchInfo: EventSourceFuncArg,
      successCallback: (events: EventInput[]) => void,
      failureCallback: (error: Error) => void,
    ) => {
      this.fetchEventsForCalendar(fetchInfo, successCallback, failureCallback);
    },
    eventClick: this.handleEventClick.bind(this),
    select: this.handleDateSelect.bind(this),
    // Formato de hora 24h
    slotLabelFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
    // Duración de slots en minutos
    slotDuration: '00:30:00',
    // Snapping del drag & drop independiente de la grilla visual
    snapDuration: '00:15:00',
    contentHeight: this.getContentHeight(),
  };

  locationOptions = computed(() => this.locations().map((l) => ({ label: l.name, value: l.id })));

  providerOptions = computed(() =>
    this.providers().map((p) => ({ label: `${p.first_name} ${p.last_name}`, value: p.id })),
  );

  showEventDialog = signal(false);

  constructor() {
    effect(() => {
      void this.lang.lang();
      this.updateCalendarI18n();
    });

    // Sync FullCalendar timezone when it changes (e.g. on location switch)
    effect(() => {
      const tz = this.tzService.activeTimezone();
      if (this.calendar) {
        this.ngZone.runOutsideAngular(() => this.calendar!.setOption('timeZone', tz));
      }
    });

    // Watch store state to manage loading visual and refresh calendar
    // Auto-refetches FullCalendar whenever eventsForCalendar changes (new load, mutation, mergeBooking)
    effect(() => {
      this.store.eventsForCalendar(); // track reactivity
      const loading = this.store.anyLoading();

      if (!this.calendar) return;

      if (!loading) {
        this.loading.set(false);
        this.ngZone.runOutsideAngular(() => this.calendar!.refetchEvents());
      }
    });

    // Watch mutation completion → success/error toast after drag/event-move
    effect(() => {
      const mutLoading = this.store.loading().mutation;

      if (this._dragMutPending && !mutLoading) {
        this._dragMutPending = false;

        const meta      = this._dragToastMeta;
        const mutErr    = this.store.error().mutationError;

        if (mutErr) {
          this.messageService.add(this.httpError.toToastConfig(mutErr));
        } else if (meta) {
          this.messageService.add({
            severity: 'success',
            summary: meta.clientName,
            detail: `${meta.serviceName} · ${this.fmtDT(meta.oldStart)} → ${this.fmtDT(meta.newStart)}${meta.meta ? ` · ${meta.meta}` : ''}`,
            life: 5000,
          });
        }

        this._dragToastMeta = null;
      }

      if (mutLoading) {
        this._dragMutPending = true;
      }
    });
  }

  ngOnInit(): void {
    this.checkViewport();
    this.loadLocations();
  }

  ngAfterViewInit(): void {
    this.initCalendar();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkViewport();
    if (this.calendar) {
      this.calendar.setOption('contentHeight', this.getContentHeight());
      this.calendar.updateSize();
    }
  }

  private getContentHeight(): number {
    // viewport minus fixed overhead: main-content padding + card header (filters) +
    // FullCalendar toolbar + column headers row + surrounding paddings
    return window.innerHeight - 250;
  }

  private checkViewport(): void {
    this.isMobile.set(window.innerWidth < 768);
  }

  private initCalendar(): void {
    this.ngZone.runOutsideAngular(() => {
      this.calendar = new Calendar(this.calendarContainer.nativeElement, {
        ...this.calendarOptions,
        eventClick: (info) => this.ngZone.run(() => this.handleEventClick(info)),
        select: (info) => this.ngZone.run(() => this.handleDateSelect(info)),
        eventContent: (info) => this.buildEventContent(info),
        eventMouseEnter: (info) => {
          if (info.event.extendedProps['isBlocked']) return;
          const booking = info.event.extendedProps['booking'] as Booking | undefined;
          if (!booking) return;
          this.ngZone.run(() => {
            this.hoveredBooking.set(booking);
            this.eventTooltip?.show(info.jsEvent, info.el);
          });
        },
        eventMouseLeave: () => {
          this.ngZone.run(() => {
            this.eventTooltip?.hide();
            this.hoveredBooking.set(null);
          });
        },
        dateClick: (info) => this.ngZone.run(() => {
          this.removeSlotPreview();

          // info.dateStr is ISO8601 with CLT offset (e.g. "2026-06-27T13:00:00-04:00")
          // info.date is a "stripped" Date whose local wall clock matches CLT display
          // but whose absolute timestamp is NOT adjusted for timezone.
          // We parse dateStr for correct absolute timestamps (dialogs/formatters need these)
          // and keep info.date for the preview event (FullCalendar renders by local wall clock).
          const previewMs = this.getPreviewDuration();
          const start = this.tzService.parseDate(info.dateStr);
          const end = new Date(start.getTime() + previewMs);

          this.selectedDate = start;
          this.selectedEndDate = end;

          const isTimeGrid = (this.calendar?.view.type ?? '').startsWith('timeGrid');
          if (!isTimeGrid) {
            this.slotMenuPosition = { x: info.jsEvent.clientX, y: info.jsEvent.clientY };
            this.showSlotMenu.set(true);
            return;
          }

          this.ngZone.runOutsideAngular(() => {
            this.calendar!.addEvent({
              id: this.SLOT_PREVIEW_ID,
              start: info.date,
              end: new Date(info.date.getTime() + previewMs),
              classNames: ['bw-slot-preview'],
              editable: false,
            });

            requestAnimationFrame(() => {
              this.ngZone.run(() => {
                const el = this.calendarContainer.nativeElement
                  .querySelector('.bw-slot-preview');
                if (el) {
                  const rect = el.getBoundingClientRect();
                  this.slotMenuPosition = {
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  };
                } else {
                  this.slotMenuPosition = { x: info.jsEvent.clientX, y: info.jsEvent.clientY };
                }
                this.showSlotMenu.set(true);
              });
            });
          });
        }),
        eventDrop:   (info) => this.ngZone.run(() => this.handleEventMove(info, info.event.startStr, info.event.endStr)),
        eventResize: (info) => this.ngZone.run(() => this.handleEventMove(info, info.event.startStr, info.event.endStr)),
        customButtons: {
          bwNewBooking: {
            text: this.lang.t('cal.new_booking'),
            click: () => this.ngZone.run(() => this.openNewBooking()),
          },
          bwBlockTime: {
            text: this.lang.t('cal.block_time'),
            click: () => this.ngZone.run(() => this.openBlockTime()),
          },
        },
      });
      this.calendar.render();
      this.startNowLabel();
    });
  }

  ngOnDestroy(): void {
    if (this.nowLabelInterval) clearInterval(this.nowLabelInterval);
    if (this.calendar) this.calendar.destroy();
  }

  private updateCalendarI18n(): void {
    if (!this.calendar) return;
    this.ngZone.runOutsideAngular(() => {
      this.calendar!.setOption('locale', this.lang.lang() === 'en' ? 'en' : esLocale);
      this.calendar!.setOption('buttonText', {
        today: this.lang.t('cal.today'),
        month: this.lang.t('cal.month'),
        week:  this.lang.t('cal.week'),
        day:   this.lang.t('cal.day'),
        list:  this.lang.t('cal.list'),
      });
      this.calendar!.setOption('customButtons', {
        bwNewBooking: {
          text: this.lang.t('cal.new_booking'),
          click: () => this.ngZone.run(() => this.openNewBooking()),
        },
        bwBlockTime: {
          text: this.lang.t('cal.block_time'),
          click: () => this.ngZone.run(() => this.openBlockTime()),
        },
      });
    });
  }

  private startNowLabel(): void {
    this.updateNowLabel();
    this.nowLabelInterval = setInterval(() => this.updateNowLabel(), 60_000);
  }

  private updateNowLabel(): void {
    const now = new Date();
    const label = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const arrow = this.calendarContainer?.nativeElement?.querySelector('.fc-timegrid-now-indicator-arrow');
    arrow?.setAttribute('data-now', label);
  }

  loadLocations(): void {
    this.api.getLocations().subscribe({
      next: (data) => {
        this.locations.set(data);
        if (data.length > 0) {
          this.selectedLocationId = data[0].id;
          this.previousLocationId = data[0].id;
          this.loadProviders(data[0].id);
          this.onFilterChange();
        }
      },
      error: () => { this.locations.set([]); },
    });
  }

  loadProviders(locationId?: number | null): void {
    this.providersLoading.set(true);
    const params = locationId ? { location_id: locationId } : undefined;
    this.api.getProviders(params).subscribe({
      next: (data) => {
        this.providers.set(data);
        this.providersLoading.set(false);
      },
      error: () => this.providersLoading.set(false),
    });
  }

  onLocationChange(): void {
    if (this.previousLocationId !== this.selectedLocationId) {
      this.previousLocationId = this.selectedLocationId;
      this.selectedProviderId = null;
      this.loadProviders(this.selectedLocationId);

      // Propagate location timezone to the centralized service
      const loc = this.locations().find(l => l.id === this.selectedLocationId);
      if (loc?.timezone) {
        this.tzService.setTimezone(loc.timezone);
      }
    }
    this.onFilterChange();
  }

  private fetchEventsForCalendar(
    fetchInfo: EventSourceFuncArg,
    successCallback: (events: EventInput[]) => void,
    _failureCallback: (error: Error) => void,
  ): void {
    this.loading.set(true);

    const dateFrom = fetchInfo.startStr.split('T')[0];
    const dateTo   = fetchInfo.endStr.split('T')[0];

    // Only trigger store load if date range changed or a refresh is pending
    const storeRange = `[${this.store.dateFrom()}][${this.store.dateTo()}]`;
    const newRange   = `[${dateFrom}][${dateTo}]`;

    if (storeRange !== newRange || this.refreshScheduled) {
      this.refreshScheduled = false;
      this.store.loadEvents({ dateFrom, dateTo });
      // loading(false) handled by the effect when store load completes
    } else {
      // Already have current data — no async load needed
      this.loading.set(false);
    }

    successCallback(this.store.eventsForCalendar());
  }

  formatTooltipTime(iso: string): string {
    return this.tzService.formatTime(iso);
  }

  private fmt(iso: string): string {
    return this.tzService.formatTime(iso);
  }

  private getPreviewDuration(): number {
    const raw = (this.calendarOptions.slotDuration as string) ?? '00:30:00';
    const [h, m] = raw.split(':').map(Number);
    const slotMs = (h * 60 + m) * 60 * 1000;
    return slotMs * 2; // 2 slots ≈ 1 hora visual
  }

  private removeSlotPreview(): void {
    this.ngZone.runOutsideAngular(() => {
      this.calendar?.getEventById(this.SLOT_PREVIEW_ID)?.remove();
    });
  }

  dismissSlotMenu(): void {
    this.showSlotMenu.set(false);
    this.removeSlotPreview();
  }

  private buildEventContent(info: EventContentArg): { html: string } {
    if (info.event.id === this.SLOT_PREVIEW_ID) {
      return { html: '<div class="bw-slot-preview-inner"></div>' };
    }
    if (info.event.extendedProps['isBlocked']) {
      const reason = info.event.title || 'Bloqueado';
      const start  = this.fmt(info.event.startStr);
      const end    = this.fmt(info.event.endStr);
      return { html: `<div class="ev-blocked"><i class="pi pi-lock ev-blocked__icon"></i><span class="ev-blocked__label">${reason} · ${start}–${end}</span></div>` };
    }
    const booking: Booking | undefined = info.event.extendedProps['booking'];
    const payment = booking?.payment_status;
    const title = info.event.title.replace(/[&<>"']/g, (c: string) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c
    );

    const badge =
      payment === 'paid'    ? '<span class="ev-pay-badge ev-pay-badge--paid">$</span>' :
      payment === 'partial' ? '<span class="ev-pay-badge ev-pay-badge--partial">A</span>' :
      '';

    return { html: `<div class="ev-inner">${badge}<span class="ev-title">${title}</span></div>` };
  }

  private handleEventMove(info: EventDropArg | EventResizeDoneArg, newStart: string, newEnd: string): void {
    const isBlocked = info.event.extendedProps['isBlocked'];
    const oldStart  = (info.oldEvent?.startStr ?? '') as string;

    // Guard: endStr puede ser null en eventos sin duración explícita
    const safeEnd = newEnd || newStart;

    const revert = () => {
      try { info.revert(); } catch { /* vista ya cambió, ignorar */ }
    };

    // startStr/endStr ya están en CLT con offset (-03:00) por timeZone: 'America/Santiago'

    if (isBlocked) {
      const slot = info.event.extendedProps['blockedSlot'] as BlockedSlot | undefined;
      if (!slot) { revert(); return; }

      this.api.updateBlockedSlot(slot.id, { start_time: newStart, end_time: safeEnd }).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'info',
            summary: this.lang.t('toast.block_moved.summary'),
            detail: `${slot.reason || this.lang.t('toast.block_moved.summary')} · ${this.fmtDT(oldStart)} → ${this.fmtDT(newStart)}`,
            life: 5000,
          });
          this.refreshScheduled = true;
          this.store.loadEvents({ dateFrom: this.store.dateFrom(), dateTo: this.store.dateTo() });
        },
        error: (err) => {
          revert();
          this.messageService.add(this.httpError.toToastConfig(err));
        },
      });

    } else {
      const booking = info.event.extendedProps['booking'] as Booking | undefined;
      if (!booking) { revert(); return; }

      const clientName   = `${booking.client?.first_name ?? ''} ${booking.client?.last_name ?? ''}`.trim() || 'Cliente';
      const serviceName  = booking.pack_session
        ? `Pack · sesión ${booking.pack_session.session_number}/${booking.pack_session.total_sessions}`
        : (booking.service?.name ?? 'Servicio');
      const providerName = booking.provider
        ? `${booking.provider.first_name} ${booking.provider.last_name}`.trim()
        : null;
      const locationName = booking.location?.name ?? null;
      const metaStr      = [providerName, locationName].filter(Boolean).join(' · ');

      this._dragToastMeta = { clientName, serviceName, oldStart, newStart, meta: metaStr };
      this.refreshScheduled = true;
      this.store.updateBooking({ id: booking.id, data: { start_time: newStart, end_time: safeEnd } });
    }
  }

  private fmtDT(iso: string): string {
    return this.tzService.formatDT(iso);
  }

  /** Sync local filter state to BookingStore and refresh the calendar. */
  onFilterChange(): void {
    this.store.setFilters({
      selectedLocationId: this.selectedLocationId ?? null,
      selectedProviderId: this.selectedProviderId ?? null,
      selectedStatusIds: this.selectedStatusIds ?? [],
    });
    this.refreshScheduled = true;
    if (this.calendar) {
      this.ngZone.runOutsideAngular(() => this.calendar!.refetchEvents());
    }
  }

  private handleEventClick(clickInfo: EventClickArg): void {
    // Dismiss tooltip on click — same-element click is not "outside" for PrimeNG dismissable
    this.eventTooltip?.hide();
    this.hoveredBooking.set(null);

    if (clickInfo.event.id === this.SLOT_PREVIEW_ID) return;
    if (clickInfo.event.extendedProps['isBlocked']) {
      const slot = clickInfo.event.extendedProps['blockedSlot'];
      if (slot) this.blockTimeDialog.openForEdit(slot);
      return;
    }
    const booking = clickInfo.event.extendedProps['booking'] as Booking;
    this.store.setSelectedBookingId(booking.id);
    this.showEventDialog.set(true);
  }

  editBooking(): void {
    const booking = this.store.selectedBooking();
    if (!booking) return;
    this.showEventDialog.set(false);
    setTimeout(() => this.paymentDialog.open(booking, 'reserva'), 100);
  }

  /** Triggered by auxiliary dialogs (new-booking, block-time) that mutate data outside the store */
  onBookingSaved(): void {
    this.refreshScheduled = true;
    if (this.calendar) {
      this.ngZone.runOutsideAngular(() => this.calendar!.refetchEvents());
    }
  }

  private handleDateSelect(selectInfo: DateSelectArg): void {
    this.selectedDate = this.tzService.parseDate(selectInfo.startStr);
    this.selectedEndDate = selectInfo.endStr ? this.tzService.parseDate(selectInfo.endStr) : null;
    // Mostrar el menú de opciones
    if (selectInfo.jsEvent) {
      this.slotMenuPosition = { x: selectInfo.jsEvent.clientX, y: selectInfo.jsEvent.clientY };
      this.showSlotMenu.set(true);
    }
  }

  // Show slot action menu
  showSlotActions(event: MouseEvent, dateInfo?: { start: Date; end?: Date }): void {
    if (dateInfo) {
      this.selectedDate = dateInfo.start;
      this.selectedEndDate = dateInfo.end || dateInfo.start;
    }
    this.slotMenuPosition = { x: event.clientX, y: event.clientY };
    this.showSlotMenu.set(true);
  }

  openNewBooking(): void {
    this.showSlotMenu.set(false);
    this.removeSlotPreview();
    const dateToUse = this.selectedDate || new Date();
    this.newBookingDialog.openNew(undefined, dateToUse, this.selectedLocationId);
  }

  openBlockTime(): void {
    this.showSlotMenu.set(false);
    this.removeSlotPreview();
    this.blockTimeDialog.open(
      this.selectedDate || new Date(),
      this.selectedEndDate || this.selectedDate || new Date(),
      this.selectedLocationId,
      this.selectedProviderId,
    );
  }

  closeDialog(): void {
    this.showEventDialog.set(false);
    this.store.setSelectedBookingId(null);
  }

  openPaymentDetail(scrollToTxn = false): void {
    const booking = this.store.selectedBooking();
    if (!booking) return;
    this.showEventDialog.set(false);
    setTimeout(() => this.paymentDialog.open(booking, 'pago', scrollToTxn), 100);
  }

  onBackToDetail(booking: Booking): void {
    this.store.setSelectedBookingId(booking.id);
    setTimeout(() => this.showEventDialog.set(true), 100);
  }

  getStatusSeverity(
    statusName?: string,
    statusId?: number,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | undefined {
    // Primero buscar por status_id (más confiable)
    if (statusId) {
      const status = BOOKING_STATUSES.find((s) => s.value === statusId);
      if (status) {
        // Mapear 'help' a 'warn' ya que PrimeNG no soporta 'help'
        return status.severity === 'help' ? 'warn' : status.severity;
      }
    }
    // Fallback por nombre
    const status = BOOKING_STATUSES.find(
      (s) => s.label.toLowerCase() === statusName?.toLowerCase()
    );
    if (status) {
      return status.severity === 'help' ? 'warn' : status.severity;
    }
    return 'info';
  }
}
