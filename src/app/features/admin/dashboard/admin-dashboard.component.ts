import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { DateTime } from 'luxon';
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
  plugins?:             { legend?: { position?: string } };
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
}

const CHART_COLORS = ['#046af4', '#0b3d95', '#94a3b8', '#fcd34d', '#86efac', '#fb923c', '#a78bfa', '#ec4899'];
const PRIMARY_COLOR = CHART_COLORS[0];
const DAY_LABELS    = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

@Component({
  selector: 'bw-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CardModule, ChartModule, SkeletonModule],
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

  /** ── rango de fechas mostrado (formateado en timezone activo) ── */
  readonly dateRangeText = computed(() => {
    const tz  = this.tzService.activeTimezone();
    const now = DateTime.now().setZone(tz);
    const today    = now.toFormat("dd/MM/yyyy");
    const weekFrom = now.startOf('week').toFormat("dd/MM");
    const weekTo   = now.endOf('week').toFormat("dd/MM/yyyy");
    return `Hoy ${today} · Semana del ${weekFrom} al ${weekTo}`;
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
          const todayList = today.data;
          const pendingList = pending.data;
          const weekList = week.data;
          return {
            todayCount:    todayList.length,
            pendingCount:  pendingList.length,
            locationStats: this.computeLocationStats(weekList),
            weeklyStats:   this.computeWeeklyStats(weekList),
          };
        }),
      );
    },
  });

  /** ── señales derivadas para el template ── */
  readonly loading        = computed(() => this.dashboardStats.isLoading() && !this.dashboardStats.hasValue());
  readonly todayBookings  = computed(() => this.dashboardStats.value()?.todayCount   ?? 0);
  readonly pendingBookings = computed(() => this.dashboardStats.value()?.pendingCount ?? 0);

  readonly locationChartData = computed<DashboardChartData | null>(() => {
    const stats = this.dashboardStats.value();
    if (!stats?.locationStats.length) return null;
    return {
      labels:   stats.locationStats.map(s => s.name),
      datasets: [{ data: stats.locationStats.map(s => s.count), backgroundColor: stats.locationStats.map(s => s.color) }],
    };
  });

  readonly weeklyChartData = computed<DashboardChartData>(() => {
    const stats = this.dashboardStats.value();
    return {
      labels: DAY_LABELS,
      datasets: [{
        label: 'Citas',
        data: stats?.weeklyStats.map(s => s.count) ?? [0, 0, 0, 0, 0, 0, 0],
        fill: true,
        borderColor: PRIMARY_COLOR,
        backgroundColor: 'rgba(4, 106, 244, 0.1)',
        tension: 0.4,
      }],
    };
  });

  /** ── opciones de charts (estáticas) ── */
  readonly doughnutOptions = signal<DashboardChartOptions>({
    cutout: '60%',
    plugins: { legend: { position: 'bottom' } },
  });

  readonly lineOptions = signal<DashboardChartOptions>({
    aspectRatio: 1.6,
    plugins: { legend: { position: 'bottom' } },
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
