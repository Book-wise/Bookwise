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
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../core/services/api.service';
import { HttpErrorService } from '../../../core/services/http-error.service';
import { Booking, BlockedSlot, Location, Provider } from '../../../core/models';
import { BookingDialogComponent } from '../bookings/booking-dialog/booking-dialog.component';
import { BookingFormDialogComponent } from '../bookings/booking-form-dialog/booking-form-dialog.component';
import { BlockTimeDialogComponent } from '../bookings/block-time-dialog/block-time-dialog.component';
import { STATUS_COLOR_MAP, BOOKING_STATUSES } from '../bookings/constants/booking-statuses';
import { LanguageService } from '../../../core/services/language.service';
import { forkJoin } from 'rxjs';
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


interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
  borderColor?: string;
  extendedProps?: {
    booking: Booking;
  };
}

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
    ProgressSpinnerModule,
    BookingDialogComponent,
    BookingFormDialogComponent,
    PopoverModule,
    BlockTimeDialogComponent,
  ],
  templateUrl: './full-calendar.component.html',
  styleUrls: ['./full-calendar.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FullCalendarComponent implements OnInit, OnDestroy, AfterViewInit {
  private api        = inject(ApiService);
  private httpError  = inject(HttpErrorService);
  private messageService = inject(MessageService);
  private ngZone     = inject(NgZone);
  readonly lang      = inject(LanguageService);
  private calendar: Calendar | null = null;
  private nowLabelInterval: ReturnType<typeof setInterval> | null = null;

  @ViewChild('calendarContainer') calendarContainer!: ElementRef;
  @ViewChild('eventTooltip') eventTooltip!: Popover;
  @ViewChild(BookingDialogComponent) bookingDialog!: BookingDialogComponent;
  @ViewChild(BookingFormDialogComponent) newBookingDialog!: BookingFormDialogComponent;
  @ViewChild(BlockTimeDialogComponent) blockTimeDialog!: BlockTimeDialogComponent;

  loading = signal(true);
  providersLoading = signal(false);
  hoveredBooking = signal<Booking | null>(null);
  bookings = signal<Booking[]>([]);
  locations = signal<Location[]>([]);
  providers = signal<Provider[]>([]);

  selectedLocationId: number | null = null;
  selectedProviderId: number | null = null;
  selectedStatusIds: number[] = [];

  statusFilterOptions = computed(() =>
    BOOKING_STATUSES.map(s => ({ label: this.lang.t(s.labelKey), value: s.value, color: s.color }))
  );
  // Track previous location to detect changes
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
    plugins: [dayGridPlugin, interactionPlugin, listPlugin, timeGridPlugin],
    initialView: 'timeGridWeek',
    slotMinTime: '09:00:00',
    slotMaxTime: '21:00:00',
    locale: this.lang.lang() === 'en' ? 'en' : esLocale,
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
    contentHeight: this.getContentHeight(),
  };

  locationOptions = computed(() => this.locations().map((l) => ({ label: l.name, value: l.id })));

  providerOptions = computed(() =>
    this.providers().map((p) => ({ label: `${p.first_name} ${p.last_name}`, value: p.id })),
  );

  selectedBooking = signal<Booking | null>(null);
  showEventDialog = signal(false);

  constructor() {
    effect(() => {
      void this.lang.lang();
      this.updateCalendarI18n();
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

          const start = info.date;
          const previewMs = this.getPreviewDuration();
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
              start,
              end,
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
          this.onLocationChange();
        }
      },
      error: (err) => { this.locations.set([]); this.httpError.handle(err, 'cargar locations'); },
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
    // Only reload providers if location actually changed
    if (this.previousLocationId !== this.selectedLocationId) {
      this.previousLocationId = this.selectedLocationId;
      // Clear provider selection when location changes
      this.selectedProviderId = null;
      this.loadProviders(this.selectedLocationId);
    }
    // Always refresh calendar when location changes
    this.onFilterChange();
  }

  private fetchEventsForCalendar(
    fetchInfo: EventSourceFuncArg,
    successCallback: (events: EventInput[]) => void,
    failureCallback: (error: Error) => void,
  ): void {
    this.ngZone.run(() => this.loading.set(true));

    const dateFrom = fetchInfo.startStr.split('T')[0];
    const dateTo   = fetchInfo.endStr.split('T')[0];

    const bookingParams: any = { date_from: dateFrom, date_to: dateTo, per_page: 500 };
    const slotParams: any    = { date_from: dateFrom, date_to: dateTo };
    if (this.selectedLocationId) { bookingParams.location_id = this.selectedLocationId; slotParams.location_id = this.selectedLocationId; }
    if (this.selectedProviderId) { bookingParams.provider_id = this.selectedProviderId; slotParams.provider_id = this.selectedProviderId; }

    forkJoin({
      bookingsRes:      this.api.getBookings(bookingParams),
      blockedSlotsRes:  this.api.getBlockedSlots(slotParams),
    }).subscribe({
      next: ({ bookingsRes, blockedSlotsRes }) => {
        const data     = (bookingsRes as any).data || bookingsRes;
        const bookings: Booking[] = Array.isArray(data) ? data : [];

        const visibleBookings = this.selectedStatusIds.length > 0
          ? bookings.filter(b => this.selectedStatusIds.includes(b.status_id))
          : bookings;

        const bookingEvents: CalendarEvent[] = visibleBookings.map((booking) => ({
          id: booking.id.toString(),
          title: `${booking.client?.first_name || ''} ${booking.client?.last_name || ''} · ${booking.service?.name || 'Servicio'}`.trim(),
          start: booking.start_time,
          end: booking.end_time,
          backgroundColor: booking.status?.color ?? STATUS_COLOR_MAP[booking.status_id] ?? this.getStatusColor(booking.status?.name),
          borderColor: booking.status?.color ?? STATUS_COLOR_MAP[booking.status_id] ?? this.getStatusColor(booking.status?.name),
          textColor: '#000',
          extendedProps: { booking },
        }));

        const blockedSlots: BlockedSlot[] = blockedSlotsRes?.data ?? [];
        const blockedEvents: CalendarEvent[] = blockedSlots.map((slot) => ({
          id: `blocked-${slot.id}`,
          title: slot.reason || 'Bloqueado',
          start: slot.start_time,
          end: slot.end_time,
          classNames: ['fc-blocked-slot'],
          extendedProps: { isBlocked: true, blockedSlot: slot },
        } as any));

        successCallback([...bookingEvents, ...blockedEvents]);
        this.ngZone.run(() => {
          this.bookings.set(bookings);
          this.loading.set(false);
        });
      },
      error: () => {
        failureCallback(new Error('Failed to load calendar events'));
        this.ngZone.run(() => this.loading.set(false));
      },
    });
  }

  formatTooltipTime(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  private fmt(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
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

  getStatusColor(statusName?: string): string {
    // Usar BOOKING_STATUSES para obtener el color
    const status = BOOKING_STATUSES.find(
      (s) => s.label.toLowerCase() === statusName?.toLowerCase()
    );
    return status?.color || '#6b7280';
  }

  private handleEventMove(info: EventDropArg | EventResizeDoneArg, newStart: string, newEnd: string): void {
    const isBlocked = info.event.extendedProps['isBlocked'];
    const oldStart  = (info.oldEvent?.startStr ?? '') as string;

    // Guard: endStr puede ser null en eventos sin duración explícita
    const safeEnd = newEnd || newStart;

    const revert = () => {
      try { info.revert(); } catch { /* vista ya cambió, ignorar */ }
    };

    if (isBlocked) {
      const slot = info.event.extendedProps['blockedSlot'] as BlockedSlot | undefined;
      if (!slot) { revert(); return; }

      this.api.updateBlockedSlot(slot.id, { start_time: newStart, end_time: safeEnd }).subscribe({
        next: () => this.messageService.add({
          severity: 'info',
          summary: this.lang.t('toast.block_moved.summary'),
          detail: `${slot.reason || this.lang.t('toast.block_moved.summary')} · ${this.fmtDT(oldStart)} → ${this.fmtDT(newStart)}`,
          life: 5000,
        }),
        error: (err) => {
          revert();
          this.httpError.handle(err, 'mover bloqueo');
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
      const meta         = [providerName, locationName].filter(Boolean).join(' · ');

      this.api.updateBooking(booking.id, { start_time: newStart, end_time: safeEnd }).subscribe({
        next: () => this.messageService.add({
          severity: 'success',
          summary: clientName,
          detail: `${serviceName} · ${this.fmtDT(oldStart)} → ${this.fmtDT(newStart)}${meta ? ` · ${meta}` : ''}`,
          life: 5000,
        }),
        error: (err) => {
          revert();
          this.httpError.handle(err, clientName);
        },
      });
    }
  }

  private fmtDT(iso: string): string {
    if (!iso) return '—';
    const d    = new Date(iso);
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const hh   = String(d.getHours()).padStart(2, '0');
    const mm   = String(d.getMinutes()).padStart(2, '0');
    return `${days[d.getDay()]} ${hh}:${mm}`;
  }

  onFilterChange(): void {
    if (this.calendar) {
      this.ngZone.runOutsideAngular(() => this.calendar!.refetchEvents());
    }
  }

  private handleEventClick(clickInfo: EventClickArg): void {
    if (clickInfo.event.id === this.SLOT_PREVIEW_ID) return;
    if (clickInfo.event.extendedProps['isBlocked']) {
      const slot = clickInfo.event.extendedProps['blockedSlot'];
      if (slot) this.blockTimeDialog.openForEdit(slot);
      return;
    }
    const booking = clickInfo.event.extendedProps['booking'] as Booking;
    this.selectedBooking.set(booking);
    this.showEventDialog.set(true);
  }

  editBooking(): void {
    const booking = this.selectedBooking();
    if (!booking) return;

    this.showEventDialog.set(false);
    // Delay para que cierre el dialog primero
    setTimeout(() => {
      this.newBookingDialog.openNew(booking);
    }, 100);
  }

  onBookingSaved(): void {
    if (this.calendar) {
      this.ngZone.runOutsideAngular(() => this.calendar!.refetchEvents());
    }
  }

  onBookingCancelled(): void {
    this.onBookingSaved();
  }

  private handleDateSelect(selectInfo: DateSelectArg): void {
    this.selectedDate = selectInfo.start;
    this.selectedEndDate = selectInfo.end;
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
    this.selectedBooking.set(null);
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
