import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { DateTime } from 'luxon';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import type { Context } from 'chartjs-plugin-datalabels';
import { BookingsApiService } from '@services/api/bookings-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { AuthService } from '@services/auth.service';
import { TimezoneService } from '@services/timezone.service';
import { LanguageService } from '@services/language.service';
import { CalendarNavigationService } from '@services/calendar-navigation.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { MessageService } from 'primeng/api';
import { Booking } from '@models';
import { BOOKING_STATUSES } from '@features/admin/bookings/constants/booking-statuses';

interface ChartDataset { data: number[]; backgroundColor?: string | string[]; borderColor?: string; fill?: boolean; tension?: number; label?: string }
interface DashboardChartData { labels: string[]; datasets: ChartDataset[] }
interface DashboardChartOptions {
  responsive?:          boolean;
  resizeDelay?:         number;
  plugins?:             Record<string, unknown>;
  maintainAspectRatio?: boolean;
  aspectRatio?:         number;
  scales?:              Record<string, unknown>;
  cutout?:              string;
}

interface LocationStat {
  name: string;
  count: number;
  color: string;
}

interface DailyStat {
  dayLabel: string;
  count: number;
}

interface DashboardData {
  todayCount: number;
  pendingCount: number;
  locationStats: LocationStat[];
  weeklyStats: DailyStat[];
  weekBookings: Booking[];
}

interface LocationOption {
  label: string;
  value: number | null;
}

type RangeMode = 'mes' | 'semana' | 'libre';

interface RangeOption {
  label: string;
  value: RangeMode;
}

const CHART_COLORS = ['#046af4', '#0b3d95', '#94a3b8', '#fcd34d', '#86efac', '#fb923c', '#a78bfa', '#ec4899'];
const PRIMARY_COLOR = CHART_COLORS[0];
const DAY_LABELS    = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const PENDING_STATUS_ID = BOOKING_STATUSES.find((s) => s.label === 'Pendiente')!.value;

/** Normalize API response: may be a plain array or { data: [...] } */
function normalizeBookings(res: unknown): Booking[] {
  return Array.isArray(res) ? res : (res as any)?.data ?? [];
}

/** Week labels index — used to keep the "week" select stable across months. */
function mondayOf(iso: string, tz: string): DateTime {
  return DateTime.fromISO(iso, { zone: tz }).startOf('week');
}

@Component({
  selector: 'bw-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CardModule, ChartModule, SelectModule, SkeletonModule, DatePickerModule, ButtonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent {
  private bookingsApi = inject(BookingsApiService);
  private httpError   = inject(HttpErrorService);
  private auth        = inject(AuthService);
  private tzService = inject(TimezoneService);
  readonly lang = inject(LanguageService);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private calNav = inject(CalendarNavigationService);

  /** ReferenceStore: datos maestros reactivos */
  private refStore  = inject(ReferenceStore);

  /** ── signals reactivas desde ReferenceStore ── */
  readonly locations = this.refStore.locations;
  readonly providers = this.refStore.providers;

  readonly userName = computed(() => this.auth.user()?.name ?? 'Usuario');

  /** ── Filtro de location ── */
  readonly selectedLocationId = signal<number | null>(null);

  /** ── Selector de rango de fechas ── */
  readonly rangeMode = signal<RangeMode>('mes');
  readonly selectedMonth = signal<number>(DateTime.now().setZone(this.tzService.activeTimezone()).month);
  readonly selectedWeekStart = signal<string>(
    DateTime.now().setZone(this.tzService.activeTimezone()).startOf('week').toISODate()!,
  );
  readonly customStart = signal<Date | null>(null);
  readonly customEnd = signal<Date | null>(null);

  readonly chartPlugins = [ChartDataLabels];

  readonly locationOptions = computed<LocationOption[]>(() => [
    { label: 'Todas las sucursales', value: null },
    ...this.locations().map(l => ({ label: l.name, value: l.id })),
  ]);

  /** ── opciones del selector de rango ── */
  readonly rangeModeOptions = computed<RangeOption[]>(() => [
    { label: this.lang.t('dashboard.range.mode.mes'), value: 'mes' },
    { label: this.lang.t('dashboard.range.mode.semana'), value: 'semana' },
    { label: this.lang.t('dashboard.range.mode.libre'), value: 'libre' },
  ]);

  readonly monthOptions = computed(() =>
    Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
      label: this.lang.t(`dashboard.range.month.${m}`),
      value: m,
    })),
  );

  /** Weeks of the month that owns the currently-selected week (Semana 1..5). */
  readonly weekOptions = computed(() => {
    const tz = this.tzService.activeTimezone();
    const selWeek = mondayOf(this.selectedWeekStart(), tz);
    let monday = selWeek.startOf('month').startOf('week');
    const weeks: { label: string; value: string }[] = [];
    for (let i = 1; i <= 5; i++) {
      weeks.push({
        label: this.lang.t('dashboard.range.week', { n: String(i) }),
        value: monday.toISODate()!,
      });
      monday = monday.plus({ weeks: 1 });
    }
    return weeks;
  });

  /** ── rango resuelto (start/end/anchor) según el modo activo ── */
  readonly rangeDetails = computed<{ start: DateTime; end: DateTime; anchor: DateTime }>(() => {
    const tz  = this.tzService.activeTimezone();
    const now = DateTime.now().setZone(tz);
    const today = now.startOf('day');
    const mode = this.rangeMode();

    let start: DateTime;
    let end: DateTime;

    if (mode === 'mes') {
      const month = this.selectedMonth();
      start = now.set({ month, day: 1 }).startOf('day');
      end = start.endOf('month');
      if (month === now.month) end = today; // mes actual → hoy
    } else if (mode === 'semana') {
      start = mondayOf(this.selectedWeekStart(), tz).startOf('day');
      end = start.endOf('week'); // lunes → domingo
    } else {
      // Modo libre: dos datepickers Desde/Hasta
      const startDt = this.customStart()
        ? DateTime.fromJSDate(this.customStart()!, { zone: tz }).startOf('day') : null;
      const endDt = this.customEnd()
        ? DateTime.fromJSDate(this.customEnd()!, { zone: tz }).startOf('day') : null;
      if (startDt && endDt) {
        const [early, late] = startDt <= endDt ? [startDt, endDt] : [endDt, startDt];
        start = early;
        end = late;
      } else {
        // Rango incompleto → vuelve al estándar (mes actual → hoy)
        start = now.startOf('month');
        end = today;
      }
    }

    // "Hoy": día actual si cae dentro del rango; si no, el primer día del rango.
    const anchor = (today >= start && today <= end) ? today : start;
    return { start, end, anchor };
  });

  /** Params para el rxResource (ISODate) */
  readonly rangeParams = computed(() => {
    const { start, end, anchor } = this.rangeDetails();
    return {
      start: start.toISODate()!,
      end: end.toISODate()!,
      anchor: anchor.toISODate()!,
    };
  });

  /** Texto del badge que muestra el rango activo (estándar o elegido). */
  readonly rangeBadgeText = computed<string>(() => {
    const tz  = this.tzService.activeTimezone();
    const now = DateTime.now().setZone(tz);
    const { start, end } = this.rangeDetails();
    const isStandard = this.rangeMode() === 'mes' && this.selectedMonth() === now.month;
    if (isStandard) return this.lang.t('dashboard.range.standard');
    return `${start.toFormat('dd/MM/yyyy')} – ${end.toFormat('dd/MM/yyyy')}`;
  });

  /** ── rxResource: carga reactiva del dashboard ── */
  readonly dashboardStats = rxResource<DashboardData, void>({
    stream: () => {
      const tz  = this.tzService.activeTimezone();
      const now = DateTime.now().setZone(tz);
      const today     = now.toISODate()!;
      const { start, end, anchor } = this.rangeParams();

      return forkJoin({
        today:   this.bookingsApi.getBookings({ date_from: anchor, date_to: anchor, per_page: 200 }),
        pending: this.bookingsApi.getBookings({ status_id: PENDING_STATUS_ID, date_from: start, date_to: end, per_page: 200 }),
        week:    this.bookingsApi.getBookings({ date_from: start, date_to: end, per_page: 500 }),
      }).pipe(
        map(({ today, pending, week }) => {
          const todayList   = normalizeBookings(today);
          const pendingList = normalizeBookings(pending);
          const weekList    = normalizeBookings(week);
          return {
            todayCount:    todayList.length,
            pendingCount:  pendingList.length,
            locationStats: this.computeLocationStats(weekList),
            weeklyStats:   this.computeWeeklyStats(weekList),
            weekBookings:  weekList,
          };
        }),
      );
    },
  });

  /** ── señales derivadas para el template ── */
  readonly loading         = computed(() => this.dashboardStats.isLoading() && !this.dashboardStats.hasValue());
  readonly todayBookings   = computed(() => this.dashboardStats.value()?.todayCount   ?? 0);
  readonly pendingBookings = computed(() => this.dashboardStats.value()?.pendingCount ?? 0);

  /** Weekly stats filtrados por location */
  readonly filteredWeeklyStats = computed<DailyStat[]>(() => {
    const data   = this.dashboardStats.value();
    const locId  = this.selectedLocationId();
    if (!data) return [];
    const filtered = locId ? data.weekBookings.filter(b => b.location?.id === locId) : data.weekBookings;
    return this.computeWeeklyStats(filtered);
  });

  readonly locationChartData = computed<DashboardChartData | null>(() => {
    const stats = this.dashboardStats.value();
    if (!stats?.locationStats.length) return null;
    return {
      labels:   stats.locationStats.map(s => s.name),
      datasets: [{ data: stats.locationStats.map(s => s.count), backgroundColor: stats.locationStats.map(s => s.color) }],
    };
  });

  readonly weeklyChartData = computed<DashboardChartData>(() => {
    const stats = this.filteredWeeklyStats();
    return {
      labels: DAY_LABELS,
      datasets: [{
        label: 'Citas',
        data: stats.map(s => s.count),
        fill: true,
        borderColor: PRIMARY_COLOR,
        backgroundColor: 'rgba(4, 106, 244, 0.1)',
        tension: 0.4,
      }],
    };
  });

  /** ── opciones de charts ── */
  readonly doughnutOptions = signal<DashboardChartOptions>({
    responsive: true,
    resizeDelay: 0,
    maintainAspectRatio: true,
    cutout: '60%',
    plugins: {
      legend: { position: 'bottom' },
      datalabels: {
        display: (ctx: Context) => {
          const data = ctx.dataset.data;
          const total = (data as number[]).reduce((a: number, b: number) => a + b, 0);
          return total > 0;
        },
        color: '#fff',
        font: { weight: 'bold' as const, size: 13 },
        formatter: (_value: number, ctx: Context) => {
          const data = ctx.dataset.data;
          const total = (data as number[]).reduce((a: number, b: number) => a + b, 0);
          const pct = total > 0 ? ((_value / total) * 100).toFixed(0) + '%' : '';
          return `${_value}\n${pct}`;
        },
        textAlign: 'center',
        offset: 2,
      },
    },
  });

  readonly lineOptions = signal<DashboardChartOptions>({
    responsive: true,
    resizeDelay: 0,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true },
    },
  });

  /** ── efecto para mostrar errores de carga ── */
  private errorEffect = effect(() => {
    const err = this.dashboardStats.error();
    if (err instanceof HttpErrorResponse) {
      this.httpError.handle(err, 'cargar dashboard');
    }
  });

  // ── selectores de rango ─────────────────────────────────────

  /** Card "Citas Pendientes": link al calendario filtrado + toast. */
  onPendingCardClick(): void {
    this.calNav.navigateToCalendar(null, null, [PENDING_STATUS_ID], this.router);
    this.messageService.add({
      severity: 'info',
      summary: this.lang.t('dashboard.pending.title'),
      detail: this.lang.t('dashboard.pending.toast'),
      key: 'global',
      life: 5000,
    });
  }

  /** Desplaza la semana seleccionada ±1 (modo semana). */
  shiftWeek(delta: number): void {
    const tz = this.tzService.activeTimezone();
    const base = mondayOf(this.selectedWeekStart(), tz);
    this.selectedWeekStart.set(base.plus({ weeks: delta }).toISODate()!);
  }

  /** Vuelve al rango estándar (mes actual → hoy). */
  clearFilters(): void {
    const tz  = this.tzService.activeTimezone();
    const now = DateTime.now().setZone(tz);
    this.rangeMode.set('mes');
    this.selectedMonth.set(now.month);
    this.selectedWeekStart.set(now.startOf('week').toISODate()!);
    this.customStart.set(null);
    this.customEnd.set(null);
  }

  // ── helpers ─────────────────────────────────────────

  private computeLocationStats(bookings: Booking[]): LocationStat[] {
    const locationMap = new Map<string, number>();

    for (const b of bookings) {
      const name = b.location?.name ?? 'Sin ubicación';
      locationMap.set(name, (locationMap.get(name) ?? 0) + 1);
    }

    return Array.from(locationMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({
        name,
        count,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }

  private computeWeeklyStats(bookings: Booking[]): DailyStat[] {
    const dayCounts = new Array(7).fill(0) as number[];

    for (const b of bookings) {
      const bDt = DateTime.fromISO(b.start_time, { zone: this.tzService.activeTimezone() });
      if (bDt.isValid) {
        const dayIdx = bDt.weekday - 1; // 0=Mon, 6=Sun
        dayCounts[dayIdx]++;
      }
    }

    return DAY_LABELS.map((label, i) => ({
      dayLabel: label,
      count: dayCounts[i],
    }));
  }
}
