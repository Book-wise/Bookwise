import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { ApiService } from '../../../core/services/api.service';
import { Client } from '../../../core/models';
import { debounceTime, Subject } from 'rxjs';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, CardModule, TagModule, InputTextModule],
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss']
})
export class ClientsListComponent implements OnInit {
  private api = inject(ApiService);
  private searchSubject = new Subject<void>();
  
  clients = signal<Client[]>([]);
  loading = signal<boolean>(false);
  searchTerm = signal<string>('');

  ngOnInit(): void {
    this.searchSubject.pipe(debounceTime(300)).subscribe(() => {
      this.loadClients();
    });
    this.loadClients();
  }

  loadClients(): void {
    this.loading.set(true);
    this.api.getClients({ search: this.searchTerm() || undefined }).subscribe({
      next: (response: any) => {
        // La API devuelve directamente el array o un objeto con data
        const data = response.data || response;
        this.clients.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
      },
      error: () => {
        this.clients.set([]);
        this.loading.set(false);
      }
    });
  }

  onSearch(): void {
    this.searchSubject.next();
  }
}