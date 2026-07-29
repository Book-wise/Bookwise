import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { LocationsApiService } from '@services/api/locations-api.service';
import { HttpErrorService } from '@services/http-error.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Location } from '@models';
import { LocationDialogComponent, DialogMode } from './location-dialog/location-dialog.component';

interface ConflictBooking {
  id: number;
  date: string;
  time: string;
  provider_name: string;
}

interface ConflictData {
  message: string;
  affects: { bookings: ConflictBooking[] };
}

@Component({
  selector: 'bw-locations-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, TableModule, ButtonModule, CardModule, TagModule,
    SkeletonModule, ToggleSwitchModule, DialogModule, LocationDialogComponent,
  ],
  templateUrl: './locations-list.component.html',
  styleUrls: ['./locations-list.component.scss'],
})
export class LocationsListComponent implements OnInit {
  private locationsApi = inject(LocationsApiService);
  private httpError = inject(HttpErrorService);
  private refStore = inject(ReferenceStore);
  private messageService = inject(MessageService);

  locations = signal<Location[]>([]);
  loading = signal(true);
  toggling = signal<Set<number>>(new Set());

  dialogVisible = signal(false);
  dialogMode = signal<DialogMode>('create');
  selectedLocation = signal<Location | null>(null);

  conflictDialogVisible = signal(false);
  conflictData = signal<ConflictData | null>(null);
  pendingToggleLocation = signal<Location | null>(null);

  ngOnInit(): void { this.loadLocations(); }

  loadLocations(): void {
    this.loading.set(true);
    this.locationsApi.getLocations().subscribe({
      next: (data) => { this.locations.set(data); this.loading.set(false); },
      error: (err) => { this.locations.set([]); this.loading.set(false); this.httpError.handle(err, 'cargar sucursales'); },
    });
  }

  openCreate(): void { this.dialogMode.set('create'); this.selectedLocation.set(null); this.dialogVisible.set(true); }
  openView(location: Location): void { this.dialogMode.set('view'); this.selectedLocation.set(location); this.dialogVisible.set(true); }
  openEdit(location: Location): void { this.dialogMode.set('edit'); this.selectedLocation.set(location); this.dialogVisible.set(true); }
  onDialogClosed(): void { this.dialogVisible.set(false); }
  onDialogSaved(): void { this.dialogVisible.set(false); this.loadLocations(); }

  onEditRequested(): void {
    const loc = this.selectedLocation();
    if (loc) this.openEdit(loc);
  }

  toggleActive(location: Location): void {
    const id = location.id;
    const newActive = !location.active;
    // Optimistic update
    this.locations.update((list) => list.map((l) => (l.id === id ? { ...l, active: newActive } : l)));
    this.toggling.update((set) => new Set(set).add(id));

    this.locationsApi.updateLocation(id, { active: newActive } as Partial<Location>).subscribe({
      next: (res) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(id); return s; });
        this.messageService.add({ severity: 'success', summary: res.message, key: 'global' });
        this.refStore.invalidateLocations();
      },
      error: (err) => {
        // Rollback on error
        this.locations.update((list) => list.map((l) => (l.id === id ? { ...l, active: !newActive } : l)));
        this.toggling.update((set) => { const s = new Set(set); s.delete(id); return s; });
        if (err.status === 409 && err.error?.requires_confirmation) {
          this.showConflictDialog(location, err.error);
        } else {
          this.httpError.handle(err, 'cambiar estado');
        }
      },
    });
  }

  showConflictDialog(location: Location, data: any): void {
    this.pendingToggleLocation.set(location);
    this.conflictData.set(data);
    this.conflictDialogVisible.set(true);
  }

  confirmDeactivate(): void {
    const location = this.pendingToggleLocation();
    if (!location) return;
    this.conflictDialogVisible.set(false);
    this.toggling.update((set) => new Set(set).add(location.id));

    this.locationsApi.updateLocation(location.id, { active: false, force: true }).subscribe({
      next: (res) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(location.id); return s; });
        this.messageService.add({ severity: 'success', summary: res.message, key: 'global' });
        this.locations.update((list) => list.map((l) => (l.id === location.id ? { ...l, active: false } : l)));
        this.refStore.invalidateLocations();
        this.pendingToggleLocation.set(null);
      },
      error: (err) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(location.id); return s; });
        this.locations.update((list) => list.map((l) => (l.id === location.id ? { ...l, active: true } : l)));
        this.httpError.handle(err, 'desactivar sucursal');
        this.pendingToggleLocation.set(null);
      },
    });
  }

  cancelDeactivate(): void {
    this.conflictDialogVisible.set(false);
    this.pendingToggleLocation.set(null);
  }
}
