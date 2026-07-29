import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ServicesApiService } from '@services/api/services-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { ServicePack } from '@models';
import { BwCurrencyPipe } from '@shared/pipes/bw-currency.pipe';

@Component({
  selector: 'bw-packs-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TableModule, ButtonModule, CardModule, TagModule, BwCurrencyPipe, SkeletonModule],
  templateUrl: './packs-list.component.html',
  styleUrls: ['./packs-list.component.scss']
})
export class PacksListComponent implements OnInit {
  private servicesApi = inject(ServicesApiService);
  private httpError = inject(HttpErrorService);
  
  packs = signal<ServicePack[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.loadPacks();
  }

  loadPacks(): void {
    this.loading.set(true);
    this.servicesApi.getPacks().subscribe({
      next: (response) => {
        this.packs.set(response.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.packs.set([]);
        this.loading.set(false);
        this.httpError.handle(err, 'cargar packs');
      }
    });
  }
}