import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { Client } from '@models';
import { debounceTime, Subject } from 'rxjs';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'bw-clients-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    TagModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    SkeletonModule,
  ],
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit {
  private api = inject(ApiService);
  private httpError = inject(HttpErrorService);
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
      next: (clients) => {
        this.clients.set(clients);
        this.loading.set(false);
      },
      error: (err) => {
        this.clients.set([]);
        this.loading.set(false);
        this.httpError.handle(err, 'cargar clientes');
      },
    });
  }

  onSearch(): void {
    this.searchSubject.next();
  }
}
