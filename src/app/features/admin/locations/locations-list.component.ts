import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../../core/services/api.service';
import { Location } from '../../../core/models';

@Component({
  selector: 'app-locations-list',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, CardModule, TagModule],
  templateUrl: './locations-list.component.html',
  styleUrls: ['./locations-list.component.scss']
})
export class LocationsListComponent implements OnInit {
  private api = inject(ApiService);
  
  locations = signal<Location[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.loadLocations();
  }

  loadLocations(): void {
    this.loading.set(true);
    this.api.getLocations().subscribe({
      next: (data) => {
        this.locations.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.locations.set([]);
        this.loading.set(false);
      }
    });
  }
}