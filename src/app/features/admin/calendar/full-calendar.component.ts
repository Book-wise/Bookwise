import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
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
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { PopoverModule, Popover } from 'primeng/popover';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../core/services/api.service';
import { Booking, Location, Provider } from '../../../core/models';
import { BookingDialogComponent } from '../bookings/booking-dialog/booking-dialog.component';
import { BookingFormDialogComponent } from '../bookings/booking-form-dialog/booking-form-dialog.component';
import { BlockTimeDialogComponent } from '../bookings/block-time-dialog/block-time-dialog.component';
import { STATUS_COLOR_MAP } from '../bookings/constants/booking-statuses';
import { Calendar, CalendarOptions, EventClickArg, DateSelectArg } from '@fullcalendar/core';
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
  selector: 'app-full-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    SelectModule,
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
  providers: [MessageService],
})
export class FullCalendarComponent implements OnInit, OnDestroy, AfterViewInit {
  private api = inject(ApiService);
  private messageService = inject(MessageService);
  private ngZone = inject(NgZone);
  private calendar: Calendar | null = null;

  @ViewChild('calendarContainer') calendarContainer!: ElementRef;
  @ViewChild('eventTooltip') eventTooltip!: Popover;
  @ViewChild(BookingDialogComponent) bookingDialog!: BookingDialogComponent;
  @ViewChild(BookingFormDialogComponent) newBookingDialog!: BookingFormDialogComponent;
  @ViewChild(BlockTimeDialogComponent) blockTimeDialog!: BlockTimeDialogComponent;

  loading = signal(true);
  hoveredBooking = signal<Booking | null>(null);
  private tooltipHideTimer?: ReturnType<typeof setTimeout>;
  bookings = signal<Booking[]>([]);
  locations = signal<Location[]>([]);
  providers = signal<Provider[]>([]);

  selectedLocationId: number | null = null;
  selectedProviderId: number | null = null;
  selectedDate: Date | null = null;
  selectedEndDate: Date | null = null;

  // Popover for slot selection
  showSlotMenu = signal(false);
  slotMenuPosition = { x: 0, y: 0 };

  // Signal para detectar viewport
  isMobile = signal(false);

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin, listPlugin, timeGridPlugin],
    initialView: 'timeGridWeek',
    slotMinTime: '09:00:00',
    slotMaxTime: '21:00:00',
    locale: esLocale,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      day: 'Día',
      list: 'Lista',
    },
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    weekends: true,
    events: (fetchInfo: any, successCallback: any, failureCallback: any) => {
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

  ngOnInit(): void {
    this.checkViewport();
    this.loadLocations();
    this.loadProviders();
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
          clearTimeout(this.tooltipHideTimer);
          const booking = info.event.extendedProps['booking'] as Booking | undefined;
          if (!booking) return;
          this.ngZone.run(() => {
            this.hoveredBooking.set(booking);
            setTimeout(() => this.eventTooltip?.show(info.jsEvent, info.el), 0);
          });
        },
        eventMouseLeave: () => {
          this.tooltipHideTimer = setTimeout(() => {
            this.ngZone.run(() => {
              this.eventTooltip?.hide();
              this.hoveredBooking.set(null);
            });
          }, 120);
        },
        dateClick: (info) => this.ngZone.run(() => {
          this.selectedDate = info.date;
          this.selectedEndDate = new Date(info.date.getTime() + 30 * 60 * 1000);
          this.slotMenuPosition = { x: info.jsEvent.clientX, y: info.jsEvent.clientY };
          this.showSlotMenu.set(true);
        }),
      });
      this.calendar.render();
    });
  }

  ngOnDestroy(): void {
    if (this.calendar) {
      this.calendar.destroy();
    }
  }

  loadLocations(): void {
    this.api.getLocations().subscribe({
      next: (data) => this.locations.set(data),
      error: () => {},
    });
  }

  loadProviders(): void {
    this.api.getProviders().subscribe({
      next: (data) => this.providers.set(data),
      error: () => {},
    });
  }

  private fetchEventsForCalendar(
    fetchInfo: { startStr: string; endStr: string },
    successCallback: (events: CalendarEvent[]) => void,
    failureCallback: () => void
  ): void {
    this.ngZone.run(() => this.loading.set(true));

    const params: any = {
      date_from: fetchInfo.startStr.split('T')[0],
      date_to: fetchInfo.endStr.split('T')[0],
      per_page: 500,
    };
    if (this.selectedLocationId) params.location_id = this.selectedLocationId;
    if (this.selectedProviderId) params.provider_id = this.selectedProviderId;

    this.api.getBookings(params).subscribe({
      next: (response: any) => {
        const data = response.data || response;
        const bookings: Booking[] = Array.isArray(data) ? data : [];
        const events: CalendarEvent[] = bookings.map((booking) => ({
          id: booking.id.toString(),
          title: `${booking.service?.name || 'Servicio'} - ${booking.client?.first_name || ''} ${booking.client?.last_name || ''}`.trim(),
          start: booking.start_time,
          end: booking.end_time,
          backgroundColor: booking.status?.color ?? STATUS_COLOR_MAP[booking.status_id] ?? this.getStatusColor(booking.status?.name),
          borderColor: booking.status?.color ?? STATUS_COLOR_MAP[booking.status_id] ?? this.getStatusColor(booking.status?.name),
          extendedProps: { booking },
        }));
        successCallback(events);
        this.ngZone.run(() => {
          this.bookings.set(bookings);
          this.loading.set(false);
        });
      },
      error: () => {
        failureCallback();
        this.ngZone.run(() => this.loading.set(false));
      },
    });
  }

  formatTooltipTime(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  private buildEventContent(info: any): { html: string } {
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

  private getStatusColor(status?: string): string {
    const colorMap: Record<string, string> = {
      confirmed: '#22c55e',
      pending: '#f59e0b',
      cancelled: '#ef4444',
      completed: '#3b82f6',
      pending_confirmation: '#8b5cf6',
    };
    return colorMap[status?.toLowerCase() || ''] || '#6b7280';
  }

  onFilterChange(): void {
    if (this.calendar) {
      this.ngZone.runOutsideAngular(() => this.calendar!.refetchEvents());
    }
  }

  private handleEventClick(clickInfo: EventClickArg): void {
    const event = clickInfo.event;
    const booking = event.extendedProps['booking'] as Booking;
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
    const dateToUse = this.selectedDate || new Date();
    this.newBookingDialog.openNew(undefined, dateToUse);
  }

  openBlockTime(): void {
    this.showSlotMenu.set(false);
    this.blockTimeDialog.open(
      this.selectedDate || new Date(),
      this.selectedEndDate || this.selectedDate || new Date(),
    );
  }

  closeDialog(): void {
    this.showEventDialog.set(false);
    this.selectedBooking.set(null);
  }

  getStatusSeverity(
    status?: string,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const statusMap: Record<string, 'success' | 'info' | 'warn' | 'danger'> = {
      confirmed: 'success',
      pending: 'warn',
      cancelled: 'danger',
      completed: 'info',
    };
    return statusMap[status?.toLowerCase() || ''] || 'info';
  }
}
