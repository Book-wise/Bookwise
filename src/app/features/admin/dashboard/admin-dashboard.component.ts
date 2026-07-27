import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { DateTime } from 'luxon';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import type { Context } from 'chartjs-plugin-datalabels';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { AuthService } from '@services/auth.service';
import { TimezoneService } from '@services/timezone.service';
import { ReferenceStore } from '@core/stores/reference.store';
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

const CHART_COLORS = ['#046af4', '#0b3d95', '#94a3b8', '#fcd34d', '#86efac', '#fb923c', '#a78bfa', '#ec4899'];
const PRIMARY_COLOR = CHART_COLORS[0];
const DAY_LABELS    = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Normalize API response: may be a plain array or { data: [...] } */
function normalizeBookings(res: unknown): Booking[] {
  return Array.isArray(res) ? res : (res as any)?.data ?? [];
}

@Component({
  selector: 'bw-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CardModule, ChartModule, SelectModule, SkeletonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent {
  private api       = inject(ApiService);
  private httpError = inject(HttpErrorService);
  private auth      = inject(AuthService);
  private tzService = inject(TimezoneService);

  /** ReferenceStore: datos maestros reactivos */
  private refStore  = inject(ReferenceStore);

  /** ── signals reactivas desde ReferenceStore ── */
  readonly locations = this.refStore.locations;
  readonly providers = this.refStore.providers;

  readonly userName = computed(() => this.auth.user()?.name ?? 'Usuario');

  /** ── Filtro de location ── */
  readonly selectedLocationId = signal<number | null>(null);

  readonly chartPlugins = [ChartDataLabels];

  readonly locationOptions = computed<LocationOption[]>(() => [
    { label: 'Todas las sucursales', value: null },
    ...this.locations().map(l => ({ label: l.name, value: l.id })),
  ]);

  /** ── rango de fechas mostrado (formateado en timezone activo) ── */
  readonly dateRangeText = computed(() => {
    const tz  = this.tzService.activeTimezone();
    const now = DateTime.now().setZone(tz);
    const today    = now.toFormat("dd/MM/yyyy");
    const weekFrom = now.startOf('week').toFormat("dd/MM");
    const weekTo   = now.endOf('week').toFormat("dd/MM/yyyy");
    return `Hoy ${today} · Semana del ${weekFrom} al ${weekTo}`;
  });

  /** Texto de periodo para la card de Citas por Día */
  readonly weekPeriodText = computed(() => {
    const tz       = this.tzService.activeTimezone();
    const now      = DateTime.now().setZone(tz);
    const weekFrom = now.startOf('week').toFormat("dd/MM");
    const weekTo   = now.endOf('week').toFormat("dd/MM/yyyy");
    return `Semana ${weekFrom} → ${weekTo}`;
  });

  /** ── rxResource: carga reactiva del dashboard ── */
  readonly dashboardStats = rxResource<DashboardData, void>({
    stream: () => {
      const tz  = this.tzService.activeTimezone();
      const now = DateTime.now().setZone(tz);
      const today     = now.toISODate()!;
      const weekStart = now.startOf('week').toISODate()!;
      const weekEnd   = now.endOf('week').toISODate()!;
      const pendingStatusId = BOOKING_STATUSES.find(s => s.label === 'Pendiente')!.value;

      return forkJoin({
        today:   this.api.getBookings({ date_from: today, date_to: today,       per_page: 200 }),
        pending: this.api.getBookings({ status_id: pendingStatusId,              per_page: 200 }),
        week:    this.api.getBookings({ date_from: weekStart, date_to: weekEnd, per_page: 500 }),
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
