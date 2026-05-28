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
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { PopoverModule, Popover } from 'primeng/popover';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../core/services/api.service';
import { HttpErrorService } from '../../../core/services/http-error.service';
import { AuthService } from '../../../core/services/auth.service';
import { Booking, BlockedSlot } from '../../../core/models';
import { BookingFormDialogComponent } from '../../admin/bookings/booking-form-dialog/booking-form-dialog.component';
import { BlockTimeDialogComponent } from '../../admin/bookings/block-time-dialog/block-time-dialog.component';
import { STATUS_COLOR_MAP, BOOKING_STATUSES } from '../../admin/bookings/constants/booking-statuses';
import { LanguageService } from '../../../core/services/language.service';
import { forkJoin } from 'rxjs';
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
  selector: 'bw-provider-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    MultiSelectModule,
    TagModule,
    DialogModule,
    ProgressSpinnerModule,
    BookingFormDialogComponent,
    PopoverModule,
    BlockTimeDialogComponent,
  ],
  templateUrl: './provider-calendar.component.html',
  styleUrls: ['./provider-calendar.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ProviderCalendarComponent implements OnInit, OnDestroy, AfterViewInit {
  private api        = inject(ApiService);
  private httpError  = inject(HttpErrorService);
  private auth       = inject(AuthService);
  private messageService = inject(MessageService);
  private ngZone     = inject(NgZone);
  readonly lang      = inject(LanguageService);
  private calendar: Calendar | null = null;
  private nowLabelInterval: ReturnType<typeof setInterval> | null = null;

  @ViewChild('calendarContainer') calendarContainer!: ElementRef;
  @ViewChild('eventTooltip') eventTooltip!: Popover;
  @ViewChild(BookingFormDialogComponent) newBookingDialog!: BookingFormDialogComponent;
  @ViewChild(BlockTimeDialogComponent) blockTimeDialog!: BlockTimeDialogComponent;

  // Identidad del provider — fija durante toda la sesión
  readonly lockedProviderId: number | null = this.auth.user()?.provider_id ?? null;
  readonly lockedLocationId: number | null = this.auth.user()?.location_ids?.[0] ?? null;

  loading = signal(true);
  hoveredBooking = signal<Booking | null>(null);
  bookings = signal<Booking[]>([]);

  selectedStatusIds: number[] = [];

  statusFilterOptions = computed(() =>
    BOOKING_STATUSES.map(s => ({ label: this.lang.t(s.labelKey), value: s.value, color: s.color }))
  );

  selectedDate: Date | null = null;
  selectedEndDate: Date | null = null;

  showSlotMenu = signal(false);
  slotMenuPosition = { x: 0, y: 0 };
  private readonly SLOT_PREVIEW_ID = 'bw-slot-preview';

  isMobile = signal(false);

  selectedBooking = signal<Booking | null>(null);
  showEventDialog = signal(false);

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
    events: (fetchInfo: any, successCallback: any, failureCallback: any) => {
      this.fetchEventsForCalendar(fetchInfo, successCallback, failureCallback);
    },
    eventClick: this.handleEventClick.bind(this),
    select: this.handleDateSelect.bind(this),
    slotLabelFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
    slotDuration: '00:30:00',
    contentHeight: this.getContentHeight(),
  };

  constructor() {
    effect(() => {
      void this.lang.lang();
      this.updateCalendarI18n();
    });
  }

  ngOnInit(): void {
    this.checkViewport();
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

  private fetchEventsForCalendar(
    fetchInfo: { startStr: string; endStr: string },
    successCallback: (events: CalendarEvent[]) => void,
    failureCallback: () => void
  ): void {
    this.ngZone.run(() => this.loading.set(true));

    const dateFrom = fetchInfo.startStr.split('T')[0];
    const dateTo   = fetchInfo.endStr.split('T')[0];

    const slotParams: { date_from: string; date_to: string; location_id?: number; provider_id?: number } = {
      date_from: dateFrom,
      date_to: dateTo,
      ...(this.lockedProviderId  ? { provider_id: this.lockedProviderId }  : {}),
      ...(this.lockedLocationId  ? { location_id: this.lockedLocationId }  : {}),
    };

    const bookingParams: { date_from: string; date_to: string; per_page: number; location_id?: number; provider_id?: number } = {
      date_from: dateFrom,
      date_to: dateTo,
      per_page: 500,
      ...(this.lockedProviderId  ? { provider_id: this.lockedProviderId }  : {}),
      ...(this.lockedLocationId  ? { location_id: this.lockedLocationId }  : {}),
    };

    forkJoin({
      bookingsRes:     this.api.getBookings(bookingParams),
      blockedSlotsRes: this.api.getBlockedSlots(slotParams),
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
        failureCallback();
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
    return (h * 60 + m) * 60 * 1000 * 2;
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

  private buildEventContent(info: any): { html: string } {
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
    const status = BOOKING_STATUSES.find(
      (s) => s.label.toLowerCase() === statusName?.toLowerCase()
    );
    return status?.color || '#6b7280';
  }

  private handleEventMove(info: any, newStart: string, newEnd: string): void {
    const isBlocked = info.event.extendedProps['isBlocked'];
    const oldStart  = (info.oldEvent?.startStr ?? info.prevEvent?.startStr ?? '') as string;
    const safeEnd   = newEnd || newStart;
    const revert    = () => { try { info.revert(); } catch { /* ignore */ } };

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
        error: (err) => { revert(); this.httpError.handle(err, 'mover bloqueo'); },
      });
    } else {
      const booking = info.event.extendedProps['booking'] as Booking | undefined;
      if (!booking) { revert(); return; }
      const clientName  = `${booking.client?.first_name ?? ''} ${booking.client?.last_name ?? ''}`.trim() || 'Cliente';
      const serviceName = booking.pack_session
        ? `Pack · sesión ${booking.pack_session.session_number}/${booking.pack_session.total_sessions}`
        : (booking.service?.name ?? 'Servicio');
      this.api.updateBooking(booking.id, { start_time: newStart, end_time: safeEnd }).subscribe({
        next: () => this.messageService.add({
          severity: 'success',
          summary: clientName,
          detail: `${serviceName} · ${this.fmtDT(oldStart)} → ${this.fmtDT(newStart)}`,
          life: 5000,
        }),
        error: (err) => { revert(); this.httpError.handle(err, clientName); },
      });
    }
  }

  private fmtDT(iso: string): string {
    if (!iso) return '—';
    const d    = new Date(iso);
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${days[d.getDay()]} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
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
    setTimeout(() => {
      this.newBookingDialog.openNew(booking);
    }, 100);
  }

  onBookingSaved(): void {
    if (this.calendar) {
      this.ngZone.runOutsideAngular(() => this.calendar!.refetchEvents());
    }
  }

  private handleDateSelect(selectInfo: DateSelectArg): void {
    this.selectedDate = selectInfo.start;
    this.selectedEndDate = selectInfo.end;
    if (selectInfo.jsEvent) {
      this.slotMenuPosition = { x: selectInfo.jsEvent.clientX, y: selectInfo.jsEvent.clientY };
      this.showSlotMenu.set(true);
    }
  }

  openNewBooking(): void {
    this.showSlotMenu.set(false);
    this.removeSlotPreview();
    const dateToUse = this.selectedDate || new Date();
    this.newBookingDialog.openNew(undefined, dateToUse, this.lockedLocationId);
  }

  openBlockTime(): void {
    this.showSlotMenu.set(false);
    this.removeSlotPreview();
    this.blockTimeDialog.open(
      this.selectedDate || new Date(),
      this.selectedEndDate || this.selectedDate || new Date(),
      this.lockedLocationId,
      this.lockedProviderId,
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
    if (statusId) {
      const status = BOOKING_STATUSES.find((s) => s.value === statusId);
      if (status) return status.severity === 'help' ? 'warn' : status.severity;
    }
    const status = BOOKING_STATUSES.find(
      (s) => s.label.toLowerCase() === statusName?.toLowerCase()
    );
    if (status) return status.severity === 'help' ? 'warn' : status.severity;
    return 'info';
  }
}
