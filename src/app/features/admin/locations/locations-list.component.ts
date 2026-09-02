import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
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
    CommonModule, FormsModule, TableModule, ButtonModule, CardModule,
    SkeletonModule, ToggleSwitchModule, DialogModule, LocationDialogComponent,
  ],
  templateUrl: './locations-list.component.html',
  styleUrls: ['./locations-list.component.scss'],
})
export class LocationsListComponent {
  private httpError = inject(HttpErrorService);
  protected refStore = inject(ReferenceStore);
  private messageService = inject(MessageService);

  /**
   * Sucursales leídas de ReferenceStore (fuente canónica, U6): el store carga en
   * su onInit y patcha con la respuesta del server tras cada mutación, por lo
   * que esta pantalla no mantiene lista local ni invalida post-mutación.
   */
  readonly locations = computed(() => this.refStore.locations());
  /** Skeleton mientras el store no termina de cargar locations. */
  readonly loading = computed(() => this.refStore.loading().locations);
  toggling = signal<Set<number>>(new Set());

  dialogVisible = signal(false);
  dialogMode = signal<DialogMode>('create');
  selectedLocation = signal<Location | null>(null);

  conflictDialogVisible = signal(false);
  conflictData = signal<ConflictData | null>(null);
  pendingToggleLocation = signal<Location | null>(null);

  openCreate(): void { this.dialogMode.set('create'); this.selectedLocation.set(null); this.dialogVisible.set(true); }
  openView(location: Location): void { this.dialogMode.set('view'); this.selectedLocation.set(location); this.dialogVisible.set(true); }
  openEdit(location: Location): void { this.dialogMode.set('edit'); this.selectedLocation.set(location); this.dialogVisible.set(true); }
  onDialogClosed(): void { this.dialogVisible.set(false); }
  /** Save es store-routed: ReferenceStore ya patchó locations; solo cierra el dialog. */
  onDialogSaved(): void { this.dialogVisible.set(false); }

  onEditRequested(): void {
    const loc = this.selectedLocation();
    if (loc) this.openEdit(loc);
  }

  /**
   * Toggle store-routed: el flip optimista, el merge canónico y el rollback
   * viven en refStore.toggleLocationActive; acá solo se orquesta UI (toggling,
   * toast, diálogo force 409) sobre el observable que el método devuelve.
   */
  toggleActive(location: Location): void {
    const id = location.id;
    const newActive = !location.active;
    this.toggling.update((set) => new Set(set).add(id));

    this.refStore.toggleLocationActive(id, newActive).subscribe({
      next: (res) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(id); return s; });
        this.messageService.add({ severity: 'success', summary: res.message, key: 'global' });
      },
      error: (err) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(id); return s; });
        // Gate 409 SOLO en desactivación; el rollback ya lo hizo el store.
        if (!newActive && err.status === 409 && err.error?.requires_confirmation) {
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

    // Force vía store: updateLocation(id, {active:false, force:true}) mergea la
    // respuesta del server en refStore.locations (la sucursal queda inactiva).
    this.refStore.updateLocation(location.id, { active: false, force: true }).subscribe({
      next: (res) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(location.id); return s; });
        this.messageService.add({ severity: 'success', summary: res.message, key: 'global' });
        this.pendingToggleLocation.set(null);
      },
      error: (err) => {
        this.toggling.update((set) => { const s = new Set(set); s.delete(location.id); return s; });
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
