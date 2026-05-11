import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { ApiService } from '../../../core/services/api.service';
import { HttpErrorService } from '../../../core/services/http-error.service';
import { AuthService } from '../../../core/services/auth.service';
import { Location, Provider } from '../../../core/models';

interface ChartDataset { data: number[]; backgroundColor?: string | string[]; borderColor?: string; fill?: boolean; tension?: number; label?: string }
interface DashboardChartData { labels: string[]; datasets: ChartDataset[] }
interface DashboardChartOptions { plugins?: { legend?: { position?: string } } }

@Component({
  selector: 'bw-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CardModule, ChartModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  private api       = inject(ApiService);
  private httpError = inject(HttpErrorService);
  private auth      = inject(AuthService);

  locations      = signal<Location[]>([]);
  providers      = signal<Provider[]>([]);
  todayBookings  = signal(0);
  pendingBookings = signal(0);

  readonly userName = computed(() => this.auth.user()?.name ?? 'Usuario');

  locationChartData  = signal<DashboardChartData | null>(null);
  weeklyChartData    = signal<DashboardChartData | null>(null);
  chartOptions       = signal<DashboardChartOptions>({ plugins: { legend: { position: 'bottom' } } });

  ngOnInit(): void {
    this.loadData();
    this.initCharts();
  }

  loadData(): void {
    this.api.getLocations().subscribe({
      next: (data) => this.locations.set(data),
      error: (err) => { this.locations.set([]); this.httpError.handle(err, 'cargar locations'); }
    });

    this.api.getProviders().subscribe({
      next: (data) => this.providers.set(data),
      error: (err) => { this.providers.set([]); this.httpError.handle(err, 'cargar providers'); }
    });

    this.api.getBookings({ per_page: 100 }).subscribe({
      next: (response) => {
        const bookings = response.data;
        const today = new Date().toISOString().split('T')[0];
        this.todayBookings.set(bookings.filter(b => b.start_time.startsWith(today)).length);
        this.pendingBookings.set(bookings.filter(b => b.status?.name === 'pending').length);
      },
      error: (err) => this.httpError.handle(err, 'cargar reservas'),
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
