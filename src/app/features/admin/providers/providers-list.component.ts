import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../../core/services/api.service';
import { Provider } from '../../../core/models';

@Component({
  selector: 'app-providers-list',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, CardModule, TagModule],
  templateUrl: './providers-list.component.html',
  styleUrls: ['./providers-list.component.scss']
})
export class ProvidersListComponent implements OnInit {
  private api = inject(ApiService);
  
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
      error: () => {
        this.providers.set([]);
        this.loading.set(false);
      }
    });
  }
}