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
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { DialogModule } from 'primeng/dialog';
import { PopoverModule, Popover } from 'primeng/popover';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { BlockedSlotsApiService } from '@services/api/blocked-slots-api.service';
import { TimezoneService } from '@services/timezone.service';
import { AuthService } from '@services/auth.service';
import { Booking, BlockedSlot } from '@models';
import { BookingFormDialogComponent } from '@features/admin/bookings/booking-form-dialog/booking-form-dialog.component';
import { BlockTimeDialogComponent } from '@features/admin/bookings/block-time-dialog/block-time-dialog.component';
import { BOOKING_STATUSES, bookingStatusChipClass } from '@features/admin/bookings/constants/booking-statuses';
import { BwCurrencyPipe } from '@shared/pipes/bw-currency.pipe';
import { LanguageService } from '@services/language.service';
import { BookingStore } from '@core/stores/booking.store';

import { HttpErrorService } from '@services/http-error.service';
import {
  Calendar, CalendarOptions, EventClickArg, DateSelectArg,
  EventContentArg, EventInput, EventSourceFuncArg, EventDropArg,
} from '@fullcalendar/core';
import interactionPlugin, { EventResizeDoneArg } from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import esLocale from '@fullcalendar/core/locales/es';
import luxonPlugin from '@fullcalendar/luxon';

@Component({
  selector: 'bw-provider-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    MultiSelectModule,
    DialogModule,
    SkeletonModule,
    BookingFormDialogComponent,
    PopoverModule,
    BlockTimeDialogComponent,
    BwCurrencyPipe,
  ],
  templateUrl: './provider-calendar.component.html',
  styleUrls: ['./provider-calendar.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ProviderCalendarComponent implements OnInit, OnDestroy, AfterViewInit {
  private blockedSlotsApi = inject(BlockedSlotsApiService);
  private auth           = inject(AuthService);
  private messageService = inject(MessageService);
  private ngZone         = inject(NgZone);
  readonly lang          = inject(LanguageService);
  readonly store         = inject(BookingStore);
  private httpError      = inject(HttpErrorService);
  private tzService      = inject(TimezoneService);
  private route          = inject(ActivatedRoute);
  private calendar: Calendar | null = null;
  private nowLabelInterval: ReturnType<typeof setInterval> | null = null;
  private refreshScheduled = false;
  private _dragMutPending = false;

  /** Metadata for the pending drag/event-move toast */
  private _dragToastMeta: {
    clientName: string; serviceName: string;
    oldStart: string; newStart: string;
  } | null = null;

  @ViewChild('calendarContainer') calendarContainer!: ElementRef;
  @ViewChild('eventTooltip') eventTooltip!: Popover;
  @ViewChild(BookingFormDialogComponent) newBookingDialog!: BookingFormDialogComponent;
  @ViewChild(BlockTimeDialogComponent) blockTimeDialog!: BlockTimeDialogComponent;

  // Identidad del provider — fija durante toda la sesión
  readonly lockedProviderId: number | null = this.auth.user()?.provider_id ?? null;
  readonly lockedLocationId: number | null = this.auth.user()?.location_ids?.[0] ?? null;

  loading = signal(true);
  hoveredBooking = signal<Booking | null>(null);

  selectedStatusIds: number[] = [];

  statusFilterOptions = computed(() =>
    BOOKING_STATUSES.map(s => ({ label: this.lang.t(s.labelKey), value: s.value, color: s.color }))
  );

  /** Leyenda de estados de reserva — dot del token. */
  readonly reservationStatusLegend = computed(() =>
    BOOKING_STATUSES.map((s) => ({
      label: this.lang.t(s.labelKey),
      cssVar: s.cssVar,
    })),
  );

  /** Leyenda de estados de pago — colores alineados con los badges del evento. */
  readonly paymentLegend = computed(() => [
    { label: this.lang.t('cal.legend.payment.unpaid'),   cssVar: 'var(--bw-payment-unpaid)', badge: '' },
    { label: this.lang.t('cal.legend.payment.partial'),  cssVar: '#65a30d',                   badge: 'A' },
    { label: this.lang.t('cal.legend.payment.paid'),     cssVar: '#16a34a',                   badge: '$' },
  ]);

  selectedDate: Date | null = null;
  selectedEndDate: Date | null = null;

  showSlotMenu = signal(false);
  slotMenuPosition = { x: 0, y: 0 };
  slotMenuAbove = signal(false);
  private readonly SLOT_PREVIEW_ID = 'bw-slot-preview';
  private readonly isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Ephemeral hover preview (timeGrid): the day + time are resolved from the
  // pointer, then FullCalendar paints the highlight through select(). No state.
  private hoverEl: HTMLElement | null = null;
  private hoverBoundMove: (e: Event) => void = () => {};
  private hoverBoundLeave: (e: Event) => void = () => {};
  private lastHoverKey = '';

  isMobile = signal(false);

  showEventDialog = signal(false);

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
    unselectAuto: false,
    allDaySlot: false,
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

    // Sync FullCalendar timezone when it changes
    effect(() => {
      const tz = this.tzService.activeTimezone();
      if (this.calendar) {
        this.ngZone.runOutsideAngular(() => this.calendar!.setOption('timeZone', tz));
      }
    });

    // Watch store state to manage loading visual and refresh calendar
    // Auto-refetches FullCalendar whenever eventsForCalendar changes
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
            detail: `${meta.serviceName} · ${this.fmtDT(meta.oldStart)} → ${this.fmtDT(meta.newStart)}`,
            key: 'global',
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
  }

  ngAfterViewInit(): void {
    this.initCalendar();
    this.watchDateQueryParam();
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

  /** Reacciona al `?date=` del widget de navegación (incluso si ya está montado). */
  private watchDateQueryParam(): void {
    this.route.queryParamMap.subscribe((params) => {
      const date = params.get('date');
      if (date && this.calendar) {
        this.ngZone.runOutsideAngular(() => {
          this.calendar!.gotoDate(date);
        });
      }
    });
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
          // Month view only: events listed inside FullCalendar's day popover
          // ("+N más") must not raise our hover tooltip on top of that popover.
          // That popover only exists in dayGrid/month, so this is month-scoped.
          if (info.el.closest('.fc-popover')) return;
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

          // info.dateStr is ISO8601 with CLT offset; parse for correct absolute timestamps.
          // Keep info.date (stripped) for preview rendering — FullCalendar renders by local wall clock.
          const previewMs = this.getPreviewDuration();
          const start = this.tzService.parseDate(info.dateStr);
          const end = new Date(start.getTime() + previewMs);

          this.selectedDate = start;
          this.selectedEndDate = end;

          const isTimeGrid = (this.calendar?.view.type ?? '').startsWith('timeGrid');
          if (!isTimeGrid) {
            this.slotMenuPosition = { x: info.jsEvent.clientX, y: info.jsEvent.clientY };
            this.slotMenuAbove.set(window.innerHeight - info.jsEvent.clientY < 200);
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
                this.positionSlotMenu(info.jsEvent.clientX, info.jsEvent.clientY);
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
      this.setupHoverSelect();

      // Salto por URL (`?date=YYYY-MM-DD`) desde el widget de navegación del sidebar.
      const qDate = this.route.snapshot.queryParamMap.get('date');
      if (qDate && this.calendar) {
        this.calendar.gotoDate(qDate);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.nowLabelInterval) clearInterval(this.nowLabelInterval);
    this.destroyHoverSelect();
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

  /** Preview duration for the slot click preview — follows the slot density. */
  private getPreviewDuration(): number {
    const raw = (this.calendarOptions.slotDuration as string) ?? '00:30:00';
    const [h, m] = raw.split(':').map(Number);
    return (h * 60 + m) * 60 * 1000;
  }

  private removeSlotPreview(): void {
    this.ngZone.runOutsideAngular(() => {
      this.calendar?.getEventById(this.SLOT_PREVIEW_ID)?.remove();
    });
  }

  dismissSlotMenu(): void {
    this.showSlotMenu.set(false);
    this.clearHoverSelect();
    this.removeSlotPreview();
  }

  // ── Hover preview (timeGrid) ──────────────────────────────────────────────
  // FullCalendar renders ONE full-width slat lane per time row and separate
  // per-day column overlays, so a pure-CSS row hover cannot isolate a day. The
  // day is read from the column header cell and the time from the slat lane,
  // then select() paints the exact day+time cell as `.fc-highlight`.

  private setupHoverSelect(): void {
    this.hoverEl = this.calendarContainer?.nativeElement ?? null;
    if (!this.hoverEl) return;
    // On touch devices the compatibility mouse events fight with tap-to-select.
    if (this.isTouchDevice) return;

    this.hoverBoundMove = (e: Event) => this.onHoverMove(e as MouseEvent);
    this.hoverBoundLeave = () => this.clearHoverSelect();

    this.ngZone.runOutsideAngular(() => {
      this.hoverEl!.addEventListener('mousemove', this.hoverBoundMove);
      this.hoverEl!.addEventListener('mouseleave', this.hoverBoundLeave);
    });
  }

  private destroyHoverSelect(): void {
    if (!this.hoverEl) return;
    this.hoverEl.removeEventListener('mousemove', this.hoverBoundMove);
    this.hoverEl.removeEventListener('mouseleave', this.hoverBoundLeave);
    this.hoverEl = null;
  }

  private onHoverMove(event: MouseEvent): void {
    if (!this.calendar) return;
    if (!this.calendar.view.type.startsWith('timeGrid')) return;
    if (this.showSlotMenu()) return; // menu owns the highlight while open
    if (event.buttons !== 0) return; // do not fight an in-progress drag-select

    const target = event.target as HTMLElement;
    if (target.closest('.fc-event') || target.closest('.fc-more-link')) {
      this.clearHoverSelect();
      return;
    }

    const dateStr = this.resolveHoverDate(event.clientX);
    const timeStr = this.resolveHoverTime(event.clientY);
    if (!dateStr || !timeStr) {
      this.clearHoverSelect();
      return;
    }

    const start = this.tzService.parseDate(`${dateStr}T${timeStr}`);
    const key = `${start.getTime()}`;
    if (key === this.lastHoverKey) return;
    this.lastHoverKey = key;

    const end = new Date(start.getTime() + this.getPreviewDuration());
    this.ngZone.runOutsideAngular(() => this.calendar!.select(start, end));

    // Ghost state until a click pins it (Bookwise border); the menu-close path
    // removes the class and the selection together.
    this.calendarContainer?.nativeElement?.classList.add('bw-slot-hovering');
    this.markHighlightTime(timeStr);
  }

  /** Stamp the hour onto FullCalendar's highlight node (rendered after select()). */
  private markHighlightTime(timeStr: string): void {
    const label = timeStr.slice(0, 5);
    requestAnimationFrame(() => {
      const hl = this.calendarContainer?.nativeElement?.querySelector('.fc-highlight');
      if (hl) (hl as HTMLElement).setAttribute('data-bw-time', label);
    });
  }

  /** Day (YYYY-MM-DD) of the column under the pointer, from the header cell. */
  private resolveHoverDate(clientX: number): string | null {
    const root = this.calendarContainer.nativeElement as HTMLElement;
    const cells = root.querySelectorAll<HTMLElement>('.fc-col-header-cell[data-date]');
    for (const cell of cells) {
      const rect = cell.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        return cell.getAttribute('data-date');
      }
    }
    return null;
  }

  /** Slot time (HH:mm:ss) of the slat row under the pointer. */
  private resolveHoverTime(clientY: number): string | null {
    const root = this.calendarContainer.nativeElement as HTMLElement;
    const lanes = root.querySelectorAll<HTMLElement>('.fc-timegrid-slot-lane[data-time]');
    for (const lane of lanes) {
      const rect = lane.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return lane.getAttribute('data-time');
      }
    }
    return null;
  }

  private clearHoverSelect(): void {
    this.calendarContainer?.nativeElement?.classList.remove('bw-slot-hovering');
    this.lastHoverKey = '';
    // Keep the pinned block while the slot menu is open (a click persists it).
    if (this.calendar && !this.showSlotMenu()) {
      this.ngZone.runOutsideAngular(() => this.calendar!.unselect());
    }
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
    // Status color — used in the month view where the pastel fill is hard to
    // perceive: a leading status dot plus a soft tinted pill makes the state
    // readable at a glance (igual que el full calendar de admin).
    const statusColor =
      booking?.status?.color ??
      BOOKING_STATUSES.find((s) => s.value === booking?.status_id)?.color ??
      '';
    const badge =
      payment === 'paid'    ? '<span class="ev-pay-badge ev-pay-badge--paid">$</span>' :
      payment === 'partial' ? '<span class="ev-pay-badge ev-pay-badge--partial">A</span>' :
      '';
    const isMonthView = info.view.type.startsWith('dayGrid');
    if (isMonthView && statusColor) {
      return { html: `<div class="ev-inner ev-inner--month" style="--ev-status-color:${statusColor}">${badge}<span class="ev-dot"></span><span class="ev-title">${title}</span></div>` };
    }
    return { html: `<div class="ev-inner">${badge}<span class="ev-title">${title}</span></div>` };
  }

  private handleEventMove(info: EventDropArg | EventResizeDoneArg, newStart: string, newEnd: string): void {
    const isBlocked = info.event.extendedProps['isBlocked'];
    const oldStart  = (info.oldEvent?.startStr ?? '') as string;
    const safeEnd   = newEnd || newStart;
    const revert    = () => { try { info.revert(); } catch { /* ignore */ } };

    if (isBlocked) {
      const slot = info.event.extendedProps['blockedSlot'] as BlockedSlot | undefined;
      if (!slot) { revert(); return; }
      this.blockedSlotsApi.updateBlockedSlot(slot.id, { start_time: newStart, end_time: safeEnd }).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'info',
            summary: this.lang.t('toast.block_moved.summary'),
            detail: `${slot.reason || this.lang.t('toast.block_moved.summary')} · ${this.fmtDT(oldStart)} → ${this.fmtDT(newStart)}`,
            key: 'global',
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
      const clientName  = `${booking.client?.first_name ?? ''} ${booking.client?.last_name ?? ''}`.trim() || 'Cliente';
      const serviceName = booking.pack_session
        ? `Pack · sesión ${booking.pack_session.session_number}/${booking.pack_session.total_sessions}`
        : (booking.service?.name ?? 'Servicio');

      this._dragToastMeta = { clientName, serviceName, oldStart, newStart };
      this.refreshScheduled = true;
      this.store.updateBooking({ id: booking.id, data: { start_time: newStart, end_time: safeEnd } });
    }
  }

  private fmtDT(iso: string): string {
    return this.tzService.formatDT(iso);
  }

  onFilterChange(): void {
    this.store.setFilters({
      selectedStatusIds: this.selectedStatusIds ?? [],
      // Keep location/provider locked for provider role
      selectedLocationId: this.lockedLocationId ?? null,
      selectedProviderId: this.lockedProviderId ?? null,
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
    setTimeout(() => {
      this.newBookingDialog.openNew(booking);
    }, 100);
  }

  onBookingSaved(): void {
    this.refreshScheduled = true;
    if (this.calendar) {
      this.ngZone.runOutsideAngular(() => this.calendar!.refetchEvents());
    }
  }

  /**
   * Anchor the slot menu just below the marked cell, flipping above it when
   * there is not enough room under the viewport. Uses `.fc-highlight` (which
   * persists) instead of the transient selection mirror.
   */
  private positionSlotMenu(fallbackX: number, fallbackY: number): void {
    const root = this.calendarContainer.nativeElement as HTMLElement;
    const cell =
      (root.querySelector('.fc-highlight') as HTMLElement | null) ??
      (root.querySelector('.bw-slot-preview') as HTMLElement | null);
    if (!cell) {
      this.slotMenuPosition = { x: fallbackX, y: fallbackY };
      return;
    }
    const rect = cell.getBoundingClientRect();
    const MENU_HEIGHT_ESTIMATE = 150;
    if (window.innerHeight - rect.bottom < MENU_HEIGHT_ESTIMATE) {
      this.slotMenuPosition = { x: rect.left + rect.width / 2, y: rect.top };
      this.slotMenuAbove.set(true);
    } else {
      this.slotMenuPosition = { x: rect.left + rect.width / 2, y: rect.bottom };
      this.slotMenuAbove.set(false);
    }
  }

  private handleDateSelect(selectInfo: DateSelectArg): void {
    this.selectedDate = this.tzService.parseDate(selectInfo.startStr);
    this.selectedEndDate = selectInfo.endStr ? this.tzService.parseDate(selectInfo.endStr) : null;
    const jsEvent = selectInfo.jsEvent;
    if (!jsEvent) return;
    // A click pins the block: drop the ghost class (Bookwise border) and keep
    // the hour stamped on the highlight.
    this.calendarContainer?.nativeElement?.classList.remove('bw-slot-hovering');
    this.markHighlightTime(this.fmt(selectInfo.startStr));
    requestAnimationFrame(() => {
      this.ngZone.run(() => {
        this.positionSlotMenu(jsEvent.clientX, jsEvent.clientY);
        this.showSlotMenu.set(true);
      });
    });
  }

  openNewBooking(): void {
    this.showSlotMenu.set(false);
    this.clearHoverSelect();
    this.removeSlotPreview();
    const dateToUse = this.selectedDate || new Date();
    this.newBookingDialog.openNew(undefined, dateToUse, this.lockedLocationId);
  }

  openBlockTime(): void {
    this.showSlotMenu.set(false);
    this.clearHoverSelect();
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
    this.store.setSelectedBookingId(null);
  }

  getStatusChipClass(statusName?: string, statusId?: number): string {
    return bookingStatusChipClass(statusName, statusId);
  }
}
