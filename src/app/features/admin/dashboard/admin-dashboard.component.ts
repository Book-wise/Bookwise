import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { forkJoin } from 'rxjs';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { AuthService } from '@services/auth.service';
import { Location, Provider } from '@models';

interface ChartDataset { data: number[]; backgroundColor?: string | string[]; borderColor?: string; fill?: boolean; tension?: number; label?: string }
interface DashboardChartData { labels: string[]; datasets: ChartDataset[] }
interface DashboardChartOptions {
  plugins?:             { legend?: { position?: string } };
  maintainAspectRatio?: boolean;
  aspectRatio?:         number;
  scales?:              Record<string, unknown>;
  cutout?:              string;
}

@Component({
  selector: 'bw-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CardModule, ChartModule, SkeletonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  private api       = inject(ApiService);
  private httpError = inject(HttpErrorService);
  private auth      = inject(AuthService);

  loading        = signal(true);
  locations      = signal<Location[]>([]);
  providers      = signal<Provider[]>([]);
  todayBookings  = signal(0);
  pendingBookings = signal(0);

  readonly userName = computed(() => this.auth.user()?.name ?? 'Usuario');

  locationChartData = signal<DashboardChartData | null>(null);
  weeklyChartData   = signal<DashboardChartData | null>(null);

  doughnutOptions = signal<DashboardChartOptions>({
    cutout: '60%',
    plugins: { legend: { position: 'bottom' } },
  });

  lineOptions = signal<DashboardChartOptions>({
    aspectRatio: 1.6,
    plugins: { legend: { position: 'bottom' } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true },
    },
  });

  ngOnInit(): void {
    this.loadData();
    this.initCharts();
  }

  loadData(): void {
    this.loading.set(true);
    forkJoin({
      locations: this.api.getLocations(),
      providers: this.api.getProviders(),
      bookings:  this.api.getBookings({ per_page: 100 }),
    }).subscribe({
      next: ({ locations, providers, bookings }) => {
        this.locations.set(locations);
        this.providers.set(providers);
        const list = bookings.data ?? [];
        const today = new Date().toISOString().split('T')[0];
        this.todayBookings.set(list.filter(b => b.start_time.startsWith(today)).length);
        this.pendingBookings.set(list.filter(b => b.status?.name === 'pending').length);
        this.loading.set(false);
      },
      error: (err) => {
        this.httpError.handle(err, 'cargar dashboard');
        this.loading.set(false);
      },
    });
  }

  private initCharts(): void {
    this.locationChartData.set({
      labels: ['Centro 1', 'Centro 2', 'Centro 3'],
      datasets: [{ data: [12, 8, 5], backgroundColor: ['#046af4', '#0b3d95', '#94a3b8'] }]
    });

    this.weeklyChartData.set({
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      datasets: [{
        label: 'Citas',
        data: [12, 19, 15, 17, 22, 8, 3],
        fill: true,
        borderColor: '#046af4',
        backgroundColor: 'rgba(4, 106, 244, 0.1)',
        tension: 0.4
      }]
    });
  }
}
