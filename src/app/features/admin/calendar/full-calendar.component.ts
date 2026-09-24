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
import { ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DialogModule } from 'primeng/dialog';
import { PopoverModule, Popover } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { LocationsApiService } from '@services/api/locations-api.service';
import { ProvidersApiService } from '@services/api/providers-api.service';
import { BlockedSlotsApiService } from '@services/api/blocked-slots-api.service';
import { TimezoneService } from '@services/timezone.service';
import { Booking, BlockedSlot, Location, Provider } from '@models';
import { BookingFormDialogComponent } from '../bookings/booking-form-dialog/booking-form-dialog.component';
import { BlockTimeDialogComponent } from '../bookings/block-time-dialog/block-time-dialog.component';
import { BookingDetailDialogComponent } from '../bookings/booking-detail-dialog/booking-detail-dialog.component';
import { BOOKING_STATUSES, bookingStatusChipClass } from '../bookings/constants/booking-statuses';
import { BwCurrencyPipe } from '@shared/pipes/bw-currency.pipe';
import { LanguageService } from '@services/language.service';
import { AuthService } from '@services/auth.service';
import { CalendarPrefsService } from '@services/calendar-prefs.service';
import { CalendarNavigationService } from '@services/calendar-navigation.service';
import { TenantSwitchService } from '@services/tenant-switch.service';
import type { TenantSwitchResult } from '@services/tenant-switch.service';
import type { CalendarViewContext } from '@services/calendar-navigation.service';
import { BookingStore } from '@core/stores/booking.store';
import { hasAttentionRole } from '../roles/role-meta';
import { DateTime } from 'luxon';

import { HttpErrorService } from '@services/http-error.service';
import {
  Calendar,
  CalendarOptions,
  EventClickArg,
  DateSelectArg,
  EventContentArg,
  EventInput,
  EventSourceFuncArg,
  EventDropArg,
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
    DialogModule,
    SkeletonModule,
    BookingFormDialogComponent,
    PopoverModule,
    TooltipModule,
    BlockTimeDialogComponent,
    BookingDetailDialogComponent,
    BwCurrencyPipe,
  ],
  templateUrl: './full-calendar.component.html',
  styleUrls: ['./full-calendar.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FullCalendarComponent implements OnInit, OnDestroy, AfterViewInit {
  private locationsApi = inject(LocationsApiService);
  private providersApi = inject(ProvidersApiService);
  private blockedSlotsApi = inject(BlockedSlotsApiService);
  private messageService = inject(MessageService);
  private ngZone = inject(NgZone);
  readonly lang = inject(LanguageService);
  readonly store = inject(BookingStore);
  private httpError = inject(HttpErrorService);
  private calNav = inject(CalendarNavigationService);
  private route = inject(ActivatedRoute);
  private tzService = inject(TimezoneService);
  private readonly isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  private readonly auth = inject(AuthService);
  private readonly calendarPrefs = inject(CalendarPrefsService);
  private readonly tenantSwitch = inject(TenantSwitchService);

  /**
   * Last tenant-switch result applied by the effect below. Primed with the
   * coordinator's current value so mounting the agenda after a switch does not
   * re-apply it: the unmounted-agenda handoff is the tenant-scoped preferences,
   * restored by the default `loadLocations()` path (avoids a duplicate fetch).
   */
  private lastAppliedSwitch: TenantSwitchResult | null = this.tenantSwitch.lastSwitch();

  // ── Identidad "viendo como" (chip en la fila de herramientas junto a slots y guía) ──
  readonly userName = computed(() => this.auth.user()?.name ?? '');
  readonly userRoleLabel = computed(() => {
    const role = this.auth.userRole();
    if (role === 'admin') return this.lang.t('ui.role.admin');
    if (role === 'provider') return this.lang.t('ui.role.provider');
    return '';
  });

  private calendar: Calendar | null = null;
  private nowLabelInterval: ReturnType<typeof setInterval> | null = null;
  private refreshScheduled = false;
  private _dragMutPending = false;

  /** Metadata for the pending drag/event-move toast */
  private _dragToastMeta: {
    clientName: string;
    serviceName: string;
    oldStart: string;
    newStart: string;
    meta: string | null;
  } | null = null;

  /**
   * View/date requested by a pending navigation (dashboard "Pending
   * appointments" card). Set when consumePending() returns a view context and
   * applied one-shot once the FullCalendar instance exists — the locations HTTP
   * response and ngAfterViewInit/initCalendar can resolve in either order.
   */
  private pendingViewRequest: CalendarViewContext | null = null;

  @ViewChild('calendarContainer') calendarContainer!: ElementRef;
  @ViewChild('eventTooltip') eventTooltip!: Popover;
  @ViewChild('slotDurationPopover') slotDurationPopover!: Popover;
  @ViewChild(BookingFormDialogComponent) newBookingDialog!: BookingFormDialogComponent;
  @ViewChild(BlockTimeDialogComponent) blockTimeDialog!: BlockTimeDialogComponent;
  @ViewChild(BookingDetailDialogComponent) bookingDetailDialog!: BookingDetailDialogComponent;

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
    BOOKING_STATUSES.map((s) => ({
      label: this.lang.t(s.labelKey),
      value: s.value,
      color: s.color,
    })),
  );

  /** Leyenda de estados de reserva — dot color del token (fuente visual real). */
  readonly reservationStatusLegend = computed(() =>
    BOOKING_STATUSES.map((s) => ({
      label: this.lang.t(s.labelKey),
      cssVar: s.cssVar,
    })),
  );

  /** Leyenda de estados de pago — badge/token por estado. */
  /** Leyenda de estados de pago — colores alineados con los badges del evento en
   *  la agenda (ev-pay-badge--paid/partial en _calendar.scss), no con los tokens
   *  de chips, para que la guía coincida con lo que se ve en el calendario. */
  readonly paymentLegend = computed(() => [
    { label: this.lang.t('cal.legend.payment.unpaid'),   cssVar: 'var(--bw-payment-unpaid)', badge: '' },
    { label: this.lang.t('cal.legend.payment.partial'),  cssVar: '#65a30d',                   badge: 'A' },
    { label: this.lang.t('cal.legend.payment.paid'),     cssVar: '#16a34a',                   badge: '$' },
  ]);
  private previousLocationId: number | null = null;
  selectedDate: Date | null = null;
  selectedEndDate: Date | null = null;

  // Popover for slot selection
  showSlotMenu = signal(false);
  slotMenuAbove = signal(false);
  slotMenuPosition = { x: 0, y: 0 };
  selectedTimeStr = signal('');

  // Slot duration density selector — drives the visual grid density and the
  // click/drag selection snap (FullCalendar default: snap = slotDuration).
  readonly slotDurationOptions = [5, 10, 15, 20, 30, 40, 45, 60];
  slotDurationMinutes = signal(30);

  // Ephemeral hover preview (timeGrid): the day + time are resolved from the
  // pointer, then FullCalendar paints the highlight through select(). No state.
  private hoverEl: HTMLElement | null = null;
  private hoverBoundMove: (e: Event) => void = () => {};
  private hoverBoundLeave: (e: Event) => void = () => {};
  private lastHoverKey = '';

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
      week: this.lang.t('cal.week'),
      day: this.lang.t('cal.day'),
      list: this.lang.t('cal.list'),
    },
    nowIndicator: true,
    editable: true,
    selectable: true,
    selectMirror: true,
    unselectAuto: false,
    allDaySlot: false,
    dayMaxEvents: true,
    weekends: true,
    longPressDelay: this.isTouchDevice ? 0 : 150,
    eventLongPressDelay: this.isTouchDevice ? 0 : 150,
    selectLongPressDelay: this.isTouchDevice ? 0 : 150,
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
    // Sin snapDuration explícito: FullCalendar usa por defecto snap = slotDuration,
    // así la selección click/drag sigue la densidad del grid.
    contentHeight: this.getContentHeight(),
  };

  /** Sucursales seleccionables: solo activas (C1). La intención de navegación
   *  explícita hacia una sucursal inactiva se conserva igualmente (loadLocations). */
  locationOptions = computed(() =>
    this.locations()
      .filter((l) => l.active)
      .map((l) => ({ label: l.name, value: l.id })),
  );

  /** Profesionales seleccionables: solo activos con rol de atención (C2), usando
   *  la constante compartida ATTENTION_ROLES/hasAttentionRole (role-meta). */
  providerOptions = computed(() =>
    this.providers()
      .filter((p) => p.active && hasAttentionRole(p.roles))
      .map((p) => ({ label: `${p.first_name} ${p.last_name}`, value: p.id })),
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

        const meta = this._dragToastMeta;
        const mutErr = this.store.error().mutationError;

        if (mutErr) {
          this.messageService.add(this.httpError.toToastConfig(mutErr));
        } else if (meta) {
          this.messageService.add({
            severity: 'success',
            summary: meta.clientName,
            detail: `${meta.serviceName} · ${this.fmtDT(meta.oldStart)} → ${this.fmtDT(meta.newStart)}${meta.meta ? ` · ${meta.meta}` : ''}`,
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

    // A successful tenant switch publishes the selection the coordinator
    // resolved for the new tenant. The component's own lists still hold the
    // previous tenant's data, so the selection is re-applied through a fresh
    // fetch (see applyTenantSwitch). The priming guard makes this a
    // switch-while-mounted concern only.
    effect(() => {
      const result = this.tenantSwitch.lastSwitch();
      if (!result || result === this.lastAppliedSwitch) return;
      this.lastAppliedSwitch = result;
      this.applyTenantSwitch(result);
    });
  }

  ngOnInit(): void {
    this.checkViewport();
    this.loadLocations();
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
    // viewport minus fixed overhead: main-content padding + card header (filters) +
    // FullCalendar toolbar + column headers row + surrounding paddings
    return window.innerHeight - 250;
  }

  /**
   * Reacciona al `?date=YYYY-MM-DD` del widget de navegación, incluso cuando el
   * componente ya está montado (re-navegación sobre la misma ruta).
   */
  private watchDateQueryParam(): void {
    this.route.queryParamMap.subscribe((params) => {
      const date = params.get('date');
      if (date && this.calendar) {
        this.ngZone.runOutsideAngular(() => {
          this.calendar!.changeView('timeGridWeek', date);
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
        dateClick: (info) =>
          this.ngZone.run(() => {
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

            // timeGrid: la selección sigue la densidad del grid (snap = slotDuration);
            // handleDateSelect inyecta barra + menú cuando el select dispare.
            this.selectedTimeStr.set(this.fmt(info.dateStr));
          }),
        eventDrop: (info) =>
          this.ngZone.run(() => this.handleEventMove(info, info.event.startStr, info.event.endStr)),
        eventResize: (info) =>
          this.ngZone.run(() => this.handleEventMove(info, info.event.startStr, info.event.endStr)),
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
      // A pending navigation (dashboard card) may have requested a view/date
      // before the calendar existed — apply it now that render() completed.
      this.applyPendingView();
    });
  }

  ngOnDestroy(): void {
    if (this.nowLabelInterval) clearInterval(this.nowLabelInterval);
    this.destroyHoverSelect();
    if (this.calendar) this.calendar.destroy();
    // Never leave stale pending navigation behind if it was not consumed
    this.calNav.consumePending();
  }

  private updateCalendarI18n(): void {
    if (!this.calendar) return;
    this.ngZone.runOutsideAngular(() => {
      this.calendar!.setOption('locale', this.lang.lang() === 'en' ? 'en' : esLocale);
      this.calendar!.setOption('buttonText', {
        today: this.lang.t('cal.today'),
        month: this.lang.t('cal.month'),
        week: this.lang.t('cal.week'),
        day: this.lang.t('cal.day'),
        list: this.lang.t('cal.list'),
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
    const arrow = this.calendarContainer?.nativeElement?.querySelector(
      '.fc-timegrid-now-indicator-arrow',
    );
    arrow?.setAttribute('data-now', label);
  }

  loadLocations(): void {
    // Pending navigation pre-selection — consumed BEFORE the API call (one-shot,
    // transactional) so it is cleared even when the response is empty or the
    // component is destroyed before the request completes.
    const pending = this.calNav.consumePending();
    const pendingLocationId = pending.locationId;
    const pendingProviderId = pending.providerId;
    const pendingStatusIds = pending.statusIds;

    // View context is optional (e.g. the providers-list navigation sends none and
    // keeps the default week behaviour). Only a pending navigation requesting a
    // view sets pendingViewRequest — normal visits stay unaffected.
    const pendingViewContext: CalendarViewContext | null = pending.view
      ? {
          view: pending.view,
          gotoDate: pending.gotoDate ?? undefined,
          rangeEnd: pending.rangeEnd ?? undefined,
        }
      : null;
    if (pendingViewContext) {
      this.pendingViewRequest = pendingViewContext;
    }

    // Salto por URL (`?date=YYYY-MM-DD`) del widget de navegación: determinista.
    // Si viene la fecha por query, la usamos como gotoDate garantizado.
    const queryDate = this.route.snapshot.queryParamMap.get('date');
    if (queryDate) {
      this.pendingViewRequest = {
        view: pending.view ?? 'timeGridWeek',
        gotoDate: queryDate,
      };
    }

    // Status-only navigation (e.g. the dashboard "Pending appointments" card)
    // must apply the status filter even when the calendar loads a default/kept
    // location (statusIds may arrive alongside null location/provider).
    this.selectedStatusIds = [...pendingStatusIds];

    this.locationsApi.getLocations().subscribe({
      next: (data) => {
        this.locations.set(data);
        if (data.length === 0) return;

        if (pendingLocationId != null) {
          this.selectedLocationId = pendingLocationId;
          this.previousLocationId = pendingLocationId;
          // Provider pre-selection + filter sync happen in the providers callback
          this.loadProviders(pendingLocationId, pendingProviderId);
          // Status-only pending (no provider): sync the filter once here so the
          // status intent is applied without a provider pre-selection.
          if (pendingProviderId == null && pendingStatusIds.length) {
            this.onFilterChange();
          }
          return;
        }

        // Default sin intención de navegación: se honra la última sucursal
        // recordada por el usuario (solo si sigue existiendo y ACTIVA — C1),
        // con caída a la primera sucursal ACTIVA / primer item de la lista.
        const rememberedLocationId = this.calendarPrefs.getLastLocationId(
          this.auth.user()?.id ?? null,
          this.auth.user()?.tenant_id ?? null,
        );
        const rememberedLocation =
          rememberedLocationId != null
            ? data.find((l) => l.id === rememberedLocationId && l.active)
            : undefined;
        const defaultLocation = rememberedLocation ?? data.find((l) => l.active) ?? data[0];
        this.selectedLocationId = defaultLocation.id;
        this.previousLocationId = defaultLocation.id;
        // Provider memory (per user + tenant): restored when it still exists in
        // the loaded list; loadProviders reconciles a stale id to null (all).
        this.selectedProviderId = this.calendarPrefs.getLastProviderId(
          this.auth.user()?.id ?? null,
          this.auth.user()?.tenant_id ?? null,
        );
        this.loadProviders(defaultLocation.id);
        this.onFilterChange();
        // Status-only pending navigation (dashboard "Pending appointments" card):
        // one-shot toast explaining the active status filter, the location shown
        // and the view/range mirroring the dashboard's active range. locationId
        // stays null so the toast resolves the default first location itself; a
        // provider pre-selection (which toasts via loadProviders instead) must
        // suppress this.
        if (pendingStatusIds.length > 0 && pendingProviderId == null) {
          // Apply the requested view first (one-shot; no-op if already applied or
          // if the calendar instance does not exist yet — the request survives in
          // pendingViewRequest until initCalendar() completes).
          this.applyPendingView();
          this.showCalendarContextToast({
            statusIds: pendingStatusIds,
            locationId: null,
            providerId: null,
            viewContext: pendingViewContext,
            summaryKey: 'cal.pending_title',
            severity: 'info',
            life: 6000,
          });
        }
      },
      error: () => {
        this.locations.set([]);
      },
    });
  }

  loadProviders(locationId?: number | null, providerId?: number | null): void {
    this.providersLoading.set(true);
    const params = locationId ? { location_id: locationId } : undefined;
    this.providersApi.getProviders(params).subscribe({
      next: (data) => {
        this.providers.set(data);
        this.providersLoading.set(false);

        // Pre-selection from calendar navigation: apply the intent first, then
        // reconcile — a provider oculto por el filtro C2 se limpia abajo y NO
        // se confirma como activo.
        if (providerId != null) {
          this.selectedProviderId = providerId;
          this.onFilterChange();
        }
        this.reconcileProviderSelection();

        // Nav-intent toast solo si la selección SOBREVIVE el reconcile (el
        // provider sigue visible/selectable en providerOptions).
        if (providerId != null && this.selectedProviderId === providerId) {
          const provider = data.find((p) => p.id === providerId);
          this.showCalendarContextToast({
            statusIds: [],
            locationId: this.selectedLocationId,
            providerId,
            viewContext: null,
            summary: provider ? `${provider.first_name} ${provider.last_name}`.trim() : undefined,
            severity: 'success',
            life: 5000,
          });
        }
      },
      error: (err) => {
        this.providersLoading.set(false);
        if (providerId != null) {
          // Fallo de la pre-selección de navegación: NO se aplica el intent de
          // todas formas (drop del apply-intent-anyway) — solo se informa el error.
          this.httpError.handle(err, 'cargar profesionales');
        }
        this.reconcileProviderSelection();
      },
    });
  }

  /**
   * Re-applies, for the mounted agenda, the selection the coordinator resolved
   * after a tenant switch. The component's own location/provider lists still
   * hold the previous tenant's data, so they are re-fetched; the coordinator's
   * provider memory is then reconciled against the new tenant's list — a
   * provider that no longer exists (or is not selectable) falls back to `null`
   * (= all providers). No navigation toast is emitted: this is a switch, not a
   * navigation intent.
   */
  private applyTenantSwitch(result: TenantSwitchResult): void {
    this.locationsApi.getLocations().subscribe({
      next: (data) => {
        this.locations.set(data);
        const resolvedLocationId =
          result.locationId != null && data.some((l) => l.id === result.locationId)
            ? result.locationId
            : (data.find((l) => l.active)?.id ?? data[0]?.id ?? null);

        this.selectedLocationId = resolvedLocationId;
        this.previousLocationId = resolvedLocationId;

        if (resolvedLocationId == null) {
          this.providers.set([]);
          this.selectedProviderId = null;
          this.onFilterChange();
          return;
        }

        // The coordinator carries provider memory as-is (null = all); assigning
        // it before loadProviders lets reconcileProviderSelection() clear a
        // stale id against the new tenant's provider list.
        this.selectedProviderId = result.providerId;
        this.loadProviders(resolvedLocationId);
        this.onFilterChange();
      },
      error: () => {
        this.locations.set([]);
        this.providers.set([]);
        this.selectedProviderId = null;
        this.onFilterChange();
      },
    });
  }

  /**
   * C3 — Reconciliación de la selección de profesional tras (re)cargar la
   * lista: si `selectedProviderId` apunta a un provider excluido por el filtro
   * de visibilidad de providerOptions (C2: inactivo o sin rol de atención), la
   * selección se limpia a null ("todos los profesionales") y se re-sincronizan
   * los filtros para que el calendario no conserve un provider stale. Se invoca
   * al final de loadProviders (next y error). No-op sin selección o con
   * selección aún seleccionable.
   */
  private reconcileProviderSelection(): void {
    if (this.selectedProviderId == null) return;
    const stillSelectable = this.providerOptions().some(
      (o) => o.value === this.selectedProviderId,
    );
    if (!stillSelectable) {
      this.selectedProviderId = null;
      this.onFilterChange();
    }
  }

  /**
   * One-shot application of a pending view/date request (dashboard card). No-op
   * when no navigation requested a view, or when the FullCalendar instance does
   * not exist yet — in that case the request survives in pendingViewRequest until
   * initCalendar() finishes and calls this again. Never invoked before render().
   */
  private applyPendingView(): void {
    const request = this.pendingViewRequest;
    if (!request) return;
    const cal = this.calendar;
    if (!cal) return; // calendar not initialized yet — keep the request pending
    this.pendingViewRequest = null; // one-shot
    this.ngZone.runOutsideAngular(() => {
      // changeView(view, date) re-positions the calendar in a single call; the
      // ISO gotoDate is interpreted in the calendar's configured timezone.
      cal.changeView(request.view, request.gotoDate ?? undefined);
    });
  }

  /**
   * One-shot toast reporting the calendar context after a navigation with
   * pre-selected filters — the dashboard "Pending appointments" card (status
   * filter + optional view context) or the providers-list "Agenda" button
   * (location + provider). The detail always informs the client of the THREE
   * active filters — status(es), location and provider — plus, for
   * view-carrying navigations, the visible range (month/week/custom period).
   * A pre-selected provider that cannot be resolved in the loaded list is never
   * confirmed as active: the toast stays silent instead.
   */
  private showCalendarContextToast(opts: {
    statusIds: number[];
    /** null → resolve the default first location from locations() when present. */
    locationId: number | null;
    /** null → "all providers" placeholder. */
    providerId: number | null;
    viewContext: CalendarViewContext | null;
    /** Raw summary string (e.g. provider full name). Takes precedence over summaryKey. */
    summary?: string;
    /** i18n summary key (e.g. 'cal.pending_title'). Ignored when summary is set. */
    summaryKey?: string;
    severity?: 'success' | 'info';
    life?: number;
  }): void {
    const ctx = opts.viewContext;
    const provider = opts.providerId != null
      ? this.providers().find((p) => p.id === opts.providerId)
      : null;
    if (opts.providerId != null && !provider) return;

    // Helper labels: active statuses, resolved location and provider.
    const statuses = opts.statusIds.length
      ? opts.statusIds
          .map((id) => BOOKING_STATUSES.find((s) => s.value === id)?.labelKey)
          .filter((key): key is string => !!key)
          .map((key) => this.lang.t(key))
          .join(', ')
      : this.lang.t('cal.placeholder.all_statuses');
    const location =
      (opts.locationId != null
        ? this.locations().find((l) => l.id === opts.locationId)?.name
        : this.locations().length
          ? this.locations()[0].name
          : undefined) ?? this.lang.t('cal.placeholder.all_locations');
    const providerLabel = provider
      ? `${provider.first_name} ${provider.last_name}`.trim()
      : this.lang.t('cal.placeholder.all_providers');

    const locationLabel = this.lang.t('cal.toast.location_label');
    const providerLabelWord = this.lang.t('cal.toast.provider_label');

    let detail: string;
    if (ctx && ctx.view === 'dayGridMonth' && ctx.gotoDate) {
      detail = this.lang.t('cal.pending_context_mes', {
        month: this.monthLabel(ctx.gotoDate),
        statuses,
        location,
        provider: providerLabel,
        location_label: locationLabel,
        provider_label: providerLabelWord,
      });
    } else if (ctx && ctx.view === 'timeGridWeek' && ctx.gotoDate) {
      const visibleWeekEnd = this.addDays(ctx.gotoDate, 6);
      if (ctx.rangeEnd && ctx.rangeEnd > visibleWeekEnd) {
        // Custom/libre range wider than the visible week (e.g. spanning two
        // months): the calendar opens the week of the range start as a useful
        // fallback, and the toast describes the selected period itself.
        detail = this.lang.t('cal.pending_context_libre', {
          start: this.rangeDayLabel(ctx.gotoDate),
          end: this.rangeDayLabel(ctx.rangeEnd),
          statuses,
          location,
          provider: providerLabel,
          location_label: locationLabel,
          provider_label: providerLabelWord,
        });
      } else {
        detail = this.lang.t('cal.pending_context_semana', {
          start: this.rangeDayLabel(ctx.gotoDate),
          end: this.rangeDayLabel(ctx.rangeEnd ?? visibleWeekEnd),
          statuses,
          location,
          provider: providerLabel,
          location_label: locationLabel,
          provider_label: providerLabelWord,
        });
      }
    } else if (opts.providerId != null) {
      // Providers-list flow (location + provider pre-selected, no view context).
      detail = this.lang.t('cal.welcome_agenda_detail', {
        provider: providerLabel,
        location,
        filter_label: this.lang.t('cal.toast.filter_label'),
        statuses,
      });
    } else {
      // No view context (status-only navigation): default current-week view.
      detail = this.lang.t('cal.pending_context_toast', {
        statuses,
        location,
        provider: providerLabel,
        location_label: locationLabel,
        provider_label: providerLabelWord,
      });
    }

    this.messageService.add({
      severity: opts.severity ?? 'info',
      summary: opts.summary ?? (opts.summaryKey ? this.lang.t(opts.summaryKey) : ''),
      detail,
      key: 'global',
      life: opts.life ?? 6000,
    });
  }

  /** Localized "month year" label (e.g. "septiembre de 2026" / "September 2026"). */
  private monthLabel(iso: string): string {
    const lang = this.lang.lang();
    const locale = lang === 'es' ? 'es' : 'en';
    const format = lang === 'es' ? "LLLL 'de' yyyy" : 'LLLL yyyy';
    return DateTime.fromISO(iso, { zone: this.tzService.activeTimezone() })
      .setLocale(locale)
      .toFormat(format);
  }

  /** App-wide day label, matching the dashboard badge convention (dd/MM/yyyy). */
  private rangeDayLabel(iso: string): string {
    return DateTime.fromISO(iso, { zone: this.tzService.activeTimezone() }).toFormat(
      'dd/MM/yyyy',
    );
  }

  private addDays(iso: string, days: number): string {
    return DateTime.fromISO(iso, { zone: this.tzService.activeTimezone() })
      .plus({ days })
      .toISODate()!;
  }

  onLocationChange(): void {
    if (this.previousLocationId !== this.selectedLocationId) {
      this.previousLocationId = this.selectedLocationId;
      this.selectedProviderId = null;
      this.loadProviders(this.selectedLocationId);

      // Cambio intencional del usuario (dropdown de sucursales) → persiste la
      // última sucursal por usuario para abrir ahí la próxima visita a la agenda.
      this.calendarPrefs.setLastLocationId(
        this.auth.user()?.id ?? null,
        this.auth.user()?.tenant_id ?? null,
        this.selectedLocationId,
      );

      // Propagate location timezone to the centralized service
      const loc = this.locations().find((l) => l.id === this.selectedLocationId);
      if (loc?.timezone) {
        this.tzService.setTimezone(loc.timezone);
      }
    }
    this.onFilterChange();
  }

  /**
   * Provider dropdown change: syncs the filters and remembers the choice per
   * user + tenant. Clearing the selection persists `null` (= all providers),
   * so "cleared" is remembered as such instead of falling back to a provider.
   */
  onProviderChange(): void {
    this.calendarPrefs.setLastProviderId(
      this.auth.user()?.id ?? null,
      this.auth.user()?.tenant_id ?? null,
      this.selectedProviderId ?? null,
    );
    this.onFilterChange();
  }

  private fetchEventsForCalendar(
    fetchInfo: EventSourceFuncArg,
    successCallback: (events: EventInput[]) => void,
    _failureCallback: (error: Error) => void,
  ): void {
    this.loading.set(true);

    const dateFrom = fetchInfo.startStr.split('T')[0];
    const dateTo = fetchInfo.endStr.split('T')[0];

    // Only trigger store load if date range changed or a refresh is pending
    const storeRange = `[${this.store.dateFrom()}][${this.store.dateTo()}]`;
    const newRange = `[${dateFrom}][${dateTo}]`;

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

  /** Preview duration for the slot click/date preview — follows the slot density. */
  private getPreviewDuration(): number {
    return this.slotDurationMinutes() * 60_000;
  }

  /** Format minutes as a FullCalendar duration string 'HH:mm:00' (e.g. 40 → '00:40:00'). */
  private formatSlotDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${this.pad(h)}:${this.pad(m)}:00`;
  }

  /** Localized label for a slot-duration option, e.g. '40 minutos' / '40 minutes'. */
  slotDurationLabel(minutes: number): string {
    return this.lang.t('cal.slot_duration.minutes', { n: String(minutes) });
  }

  /** Apply a slot density: update the signal, source of truth and live grid. */
  applySlotDuration(minutes: number): void {
    this.slotDurationMinutes.set(minutes);
    const durationStr = this.formatSlotDuration(minutes);
    this.calendarOptions.slotDuration = durationStr;
    if (this.calendar) {
      this.ngZone.runOutsideAngular(() => this.calendar!.setOption('slotDuration', durationStr));
    }
    this.slotDurationPopover?.hide();
  }

  dismissSlotMenu(): void {
    this.showSlotMenu.set(false);
    this.clearHoverSelect();
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

  private pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  private buildEventContent(info: EventContentArg): { html: string } {
    if (info.event.extendedProps['isBlocked']) {
      const reason = info.event.title || 'Bloqueado';
      const start = this.fmt(info.event.startStr);
      const end = this.fmt(info.event.endStr);
      return {
        html: `<div class="ev-blocked"><i class="pi pi-lock ev-blocked__icon"></i><span class="ev-blocked__label">${reason} · ${start}–${end}</span></div>`,
      };
    }
    const booking: Booking | undefined = info.event.extendedProps['booking'];
    const payment = booking?.payment_status;
    const title = info.event.title.replace(
      /[&<>"']/g,
      (c: string) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
    );

    // Status color — used in the month view where the pastel fill is hard to
    // perceive: a leading status dot plus a soft tinted pill makes the state
    // readable at a glance.
    const statusColor =
      booking?.status?.color ??
      BOOKING_STATUSES.find((s) => s.value === booking?.status_id)?.color ??
      '';

    const badge =
      payment === 'paid'
        ? '<span class="ev-pay-badge ev-pay-badge--paid">$</span>'
        : payment === 'partial'
          ? '<span class="ev-pay-badge ev-pay-badge--partial">A</span>'
          : '';

    const isMonthView = info.view.type.startsWith('dayGrid');
    if (isMonthView && statusColor) {
      return {
        html: `<div class="ev-inner ev-inner--month" style="--ev-status-color:${statusColor}">${badge}<span class="ev-dot"></span><span class="ev-title">${title}</span></div>`,
      };
    }

    return { html: `<div class="ev-inner">${badge}<span class="ev-title">${title}</span></div>` };
  }

  private handleEventMove(
    info: EventDropArg | EventResizeDoneArg,
    newStart: string,
    newEnd: string,
  ): void {
    const isBlocked = info.event.extendedProps['isBlocked'];
    const oldStart = (info.oldEvent?.startStr ?? '') as string;

    // Guard: endStr puede ser null en eventos sin duración explícita
    const safeEnd = newEnd || newStart;

    const revert = () => {
      try {
        info.revert();
      } catch {
        /* vista ya cambió, ignorar */
      }
    };

    // startStr/endStr ya están en CLT con offset (-03:00) por timeZone: 'America/Santiago'

    if (isBlocked) {
      const slot = info.event.extendedProps['blockedSlot'] as BlockedSlot | undefined;
      if (!slot) {
        revert();
        return;
      }

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
      if (!booking) {
        revert();
        return;
      }

      const clientName =
        `${booking.client?.first_name ?? ''} ${booking.client?.last_name ?? ''}`.trim() ||
        'Cliente';
      const serviceName = booking.pack_session
        ? `Pack · sesión ${booking.pack_session.session_number}/${booking.pack_session.total_sessions}`
        : (booking.service?.name ?? 'Servicio');
      const providerName = booking.provider
        ? `${booking.provider.first_name} ${booking.provider.last_name}`.trim()
        : null;
      const locationName = booking.location?.name ?? null;
      const metaStr = [providerName, locationName].filter(Boolean).join(' · ');

      this._dragToastMeta = { clientName, serviceName, oldStart, newStart, meta: metaStr };
      this.refreshScheduled = true;
      this.store.updateBooking({
        id: booking.id,
        data: { start_time: newStart, end_time: safeEnd },
      });
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
    setTimeout(() => this.bookingDetailDialog.open(booking, 'reserva'), 100);
  }

  /** Triggered by auxiliary dialogs (new-booking, block-time) that mutate data outside the store */
  onBookingSaved(): void {
    this.refreshScheduled = true;
    if (this.calendar) {
      this.ngZone.runOutsideAngular(() => this.calendar!.refetchEvents());
    }
  }

  private handleDateSelect(selectInfo: DateSelectArg): void {
    const start = this.tzService.parseDate(selectInfo.startStr);
    const end = selectInfo.endStr ? this.tzService.parseDate(selectInfo.endStr) : null;
    this.selectedDate = start;
    this.selectedEndDate = end;

    const jsEvent = selectInfo.jsEvent;
    // Solo mostrar menú si la selección fue iniciada por el usuario (click/drag);
    // una selección programática no trae jsEvent.
    if (!jsEvent || !this.calendar) return;

    const isTimeGrid = this.calendar.view.type.startsWith('timeGrid');
    if (isTimeGrid) {
      this.selectedTimeStr.set(this.fmt(selectInfo.startStr));

      // A click pins the block: drop the ghost class so it gets the Bookwise
      // border, and keep the hour stamped on the highlight.
      this.calendarContainer?.nativeElement?.classList.remove('bw-slot-hovering');
      this.markHighlightTime(this.selectedTimeStr());

      // Anclar el menú justo debajo de la celda marcada. Se usa el bloque
      // `.fc-highlight` (que persiste) porque el mirror de selección se elimina
      // en cuanto se suelta el click.
      requestAnimationFrame(() => {
        if (!this.calendar) return;
        const cell = this.calendarContainer.nativeElement.querySelector(
          '.fc-highlight',
        ) as HTMLElement | null;
        if (cell) {
          const rect = cell.getBoundingClientRect();
          // slot menu: header (~32px) + 3 botones (a ~36px c/u) ≈ 140px → usamos 150 como margen seguro
          const MENU_HEIGHT_ESTIMATE = 150;
          const belowRoom = window.innerHeight - rect.bottom;
          if (belowRoom < MENU_HEIGHT_ESTIMATE) {
            // Sale de la pantalla → mostrar hacia arriba
            this.slotMenuPosition = { x: rect.left + rect.width / 2, y: rect.top };
            this.slotMenuAbove.set(true);
          } else {
            this.slotMenuPosition = { x: rect.left + rect.width / 2, y: rect.bottom };
            this.slotMenuAbove.set(false);
          }
        } else {
          this.slotMenuPosition = {
            x: jsEvent.clientX ?? 0,
            y: jsEvent.clientY ?? 0,
          };
        }
        // Re-assert the pinned look: a stray mousemove before the menu opens
        // must not flip the block back to the hover ghost.
        this.calendarContainer?.nativeElement?.classList.remove('bw-slot-hovering');
        this.showSlotMenu.set(true);
      });
    } else {
      // Vista mensual: menú en posición del mouse
      this.slotMenuPosition = { x: jsEvent.clientX, y: jsEvent.clientY };
      this.showSlotMenu.set(true);
    }
  }

  openNewBooking(): void {
    this.showSlotMenu.set(false);
    this.clearHoverSelect();
    const dateToUse = this.selectedDate || new Date();
    this.newBookingDialog.openNew(undefined, dateToUse, this.selectedLocationId);
  }

  openBlockTime(): void {
    this.showSlotMenu.set(false);
    this.clearHoverSelect();
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

  openBookingDetail(scrollToTxn = false): void {
    const booking = this.store.selectedBooking();
    if (!booking) return;
    this.showEventDialog.set(false);
    setTimeout(() => this.bookingDetailDialog.open(booking, 'pago', scrollToTxn), 100);
  }

  onBackToDetail(booking: Booking): void {
    this.store.setSelectedBookingId(booking.id);
    setTimeout(() => this.showEventDialog.set(true), 100);
  }

  getStatusChipClass(statusName?: string, statusId?: number): string {
    return bookingStatusChipClass(statusName, statusId);
  }
}
