import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { Provider } from '@models';

@Component({
  selector: 'bw-providers-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TableModule, ButtonModule, CardModule, TagModule],
  templateUrl: './providers-list.component.html',
  styleUrls: ['./providers-list.component.scss']
})
export class ProvidersListComponent implements OnInit {
  private api = inject(ApiService);
  private httpError = inject(HttpErrorService);
  
  providers = signal<Provider[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.loadProviders();
  }

  loadProviders(): void {
    this.loading.set(true);
    this.api.getProviders().subscribe({
      next: (data) => {
        this.providers.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.providers.set([]);
        this.loading.set(false);
        this.httpError.handle(err, 'cargar profesionales');
      }
    });
  }
}