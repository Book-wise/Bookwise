import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../../core/services/api.service';
import { HttpErrorService } from '../../../core/services/http-error.service';
import { ServicePack } from '../../../core/models';

@Component({
  selector: 'bw-packs-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TableModule, ButtonModule, CardModule, TagModule],
  templateUrl: './packs-list.component.html',
  styleUrls: ['./packs-list.component.scss']
})
export class PacksListComponent implements OnInit {
  private api = inject(ApiService);
  private httpError = inject(HttpErrorService);
  
  packs = signal<ServicePack[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.loadPacks();
  }

  loadPacks(): void {
    this.loading.set(true);
    this.api.getPacks().subscribe({
      next: (response: any) => {
        const data = response.data || response;
        this.packs.set(Array.isArray(data) ? data : []);
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