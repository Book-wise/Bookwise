import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { ApiService } from '../../../core/services/api.service';
import { HttpErrorService } from '../../../core/services/http-error.service';
import { AuthService } from '../../../core/services/auth.service';
import { Location, Provider } from '../../../core/models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private httpError = inject(HttpErrorService);
  private auth = inject(AuthService);
  
  locations: Location[] = [];
  providers: Provider[] = [];
  todayBookings = 0;
  pendingBookings = 0;
  
  userName = this.auth.user()?.name || 'Usuario';

  locationChartData: any;
  weeklyChartData: any;
  chartOptions: any;

  ngOnInit(): void {
    this.loadData();
    this.initCharts();
  }

  loadData(): void {
    this.api.getLocations().subscribe({
      next: (data) => this.locations = data,
      error: (err) => { this.locations = []; this.httpError.handle(err, 'cargar locations'); }
    });

    this.api.getProviders().subscribe({
      next: (data) => this.providers = data,
      error: (err) => { this.providers = []; this.httpError.handle(err, 'cargar providers'); }
    });

    this.api.getBookings({ per_page: 100 }).subscribe({
      next: (response) => {
        const bookings = response.data;
        const today = new Date().toISOString().split('T')[0];
        this.todayBookings = bookings.filter(b => b.start_time.startsWith(today)).length;
        this.pendingBookings = bookings.filter(b => b.status?.name === 'pending').length;
      },
      error: (err) => this.httpError.handle(err, 'cargar reservas'),
    });
  }

  initCharts(): void {
    this.chartOptions = {
      plugins: {
        legend: { position: 'bottom' }
      }
    };
    
    this.locationChartData = {
      labels: ['Centro 1', 'Centro 2', 'Centro 3'],
      datasets: [{ data: [12, 8, 5], backgroundColor: ['#667eea', '#764ba2', '#a8a8a8'] }]
    };
    
    this.weeklyChartData = {
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      datasets: [{
        label: 'Citas',
        data: [12, 19, 15, 17, 22, 8, 3],
        fill: true,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4
      }]
    };
  }
}