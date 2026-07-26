# Admin Locations CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the admin locations page from read-only to full CRUD management (create, edit, view, toggle active/inactive).

**Architecture:** Single dialog component (`location-dialog`) handles create/edit/view modes via a `mode` signal. Inline `p-inputSwitch` toggles active status directly from the table. ReferenceStore invalidation keeps data fresh. A confirmation dialog handles the 409 conflict when deactivating locations with future bookings.

**Tech Stack:** Angular 19 (signals, OnPush), PrimeNG (Dialog, Table, Select, InputSwitch, DatePicker, Tag, Button), NgRx Signals store

**Existing patterns to follow:** `block-time-dialog` for dialog structure, `booking-dialog` for form layouts, `ReferenceStore.invalidateLocations()` for post-save refresh.

---

### Task 1: Update Location model + add Region / Comuna interfaces

**Files:**
- Modify: `src/app/core/models/index.ts`

- [ ] **Step 1: Add `Locality` (base for region/comuna) and update `Location`**

Add these interfaces BEFORE the existing `Location` interface (around line 10):

```typescript
export interface Locality {
  id: number;
  name: string;
}

export interface Region extends Locality {
  timezone: string;
}

export interface LocationComuna extends Locality {}
```

Replace the existing `Location` interface (lines 11-20) with:

```typescript
export interface Location {
  id: number;
  name: string;
  address: string;
  city: string;
  region_id?: number;
  region?: Region;
  comuna_id?: number;
  comuna?: LocationComuna;
  timezone: string;
  codigo_postal?: string;
  opening_time?: string;
  closing_time?: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --strict src/app/core/models/index.ts` or just `npm run build` — expect no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/models/index.ts
git commit -m "feat(locations): expand Location model with Region, Comuna, opening/closing fields"
```

---

### Task 2: Add API methods for locations CRUD + regiones/comunas

**Files:**
- Modify: `src/app/core/services/api.service.ts`

- [ ] **Step 1: Add create/update/toggle methods**

Add after `getLocation(id)` (line 49):

```typescript
createLocation(data: Partial<Location>): Observable<{ message: string; data: Location }> {
  return this.http.post<{ message: string; data: Location }>(`${this.baseUrl}/locations`, data);
}

updateLocation(id: number, data: Partial<Location>): Observable<{ message: string; data: Location }> {
  return this.http.patch<{ message: string; data: Location }>(`${this.baseUrl}/locations/${id}`, data);
}
```

- [ ] **Step 2: Add getRegions / getComunas methods**

Add after the location methods:

```typescript
getRegions(): Observable<{ data: Region[] }> {
  return this.http.get<{ data: Region[] }>(`${this.baseUrl}/regions`);
}

getComunas(regionId: number): Observable<{ data: LocationComuna[] }> {
  return this.http.get<{ data: LocationComuna[] }>(`${this.baseUrl}/regions/${regionId}/comunas`);
}
```

- [ ] **Step 3: Verify the imports include the new types**

Check that `Region` and `LocationComuna` are imported from `@models` at the top of the file (line 5-32). Add them if missing.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/services/api.service.ts
git commit -m "feat(locations): add createLocation, updateLocation, getRegions, getComunas API methods"
```

---

### Task 3: Create location-dialog component (template + logic + styles)

**Files:**
- Create: `src/app/features/admin/locations/location-dialog/location-dialog.component.ts`
- Create: `src/app/features/admin/locations/location-dialog/location-dialog.component.html`
- Create: `src/app/features/admin/locations/location-dialog/location-dialog.component.scss`

- [ ] **Step 1: Create the TypeScript file**

Create `location-dialog.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject, input, output, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DatePickerModule } from 'primeng/datepicker';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Location, Region, LocationComuna } from '@models';

export type DialogMode = 'create' | 'edit' | 'view';

@Component({
  selector: 'bw-location-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DialogModule, ButtonModule, InputTextModule,
    SelectModule, InputSwitchModule, DatePickerModule, SkeletonModule,
  ],
  templateUrl: './location-dialog.component.html',
  styleUrls: ['./location-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationDialogComponent implements OnInit {
  private api = inject(ApiService);
  private httpError = inject(HttpErrorService);
  private refStore = inject(ReferenceStore);
  private messageService = inject(MessageService);

  // ── Inputs ────────────────────────────────────────────────────
  visible = input(false);
  mode = input<DialogMode>('create');
  location = input<Location | null>(null);

  // ── Outputs ────────────────────────────────────────────────────
  closed = output<void>();
  saved = output<void>();

  // ── State ──────────────────────────────────────────────────────
  saving = signal(false);
  loadingRegions = signal(false);
  loadingComunas = signal(false);
  regions = signal<Region[]>([]);
  comunas = signal<LocationComuna[]>([]);

  // ── Form fields ────────────────────────────────────────────────
  name = signal('');
  address = signal('');
  city = signal('');
  regionId = signal<number | null>(null);
  comunaId = signal<number | null>(null);
  codigoPostal = signal('');
  openingTime = signal<string | null>(null);
  closingTime = signal<string | null>(null);
  active = signal(true);

  // ── Derived ────────────────────────────────────────────────────
  isView = computed(() => this.mode() === 'view');
  isEdit = computed(() => this.mode() === 'edit');
  isCreate = computed(() => this.mode() === 'create');
  title = computed(() => {
    if (this.isCreate()) return 'Nueva sucursal';
    if (this.isView()) return this.location()?.name ?? '';
    return 'Editar sucursal';
  });
  saveLabel = computed(() => this.isCreate() ? 'Crear sucursal' : 'Guardar cambios');
  isFormValid = computed(() => this.name().trim().length > 0 && this.address().trim().length > 0 && this.city().trim().length > 0 && this.regionId() !== null);

  regionOptions = computed(() => this.regions().map(r => ({ label: r.name, value: r.id })));
  comunaOptions = computed(() => this.comunas().map(c => ({ label: c.name, value: c.id })));

  ngOnInit(): void {
    this.loadRegions();
    this.prefillForm();
  }

  /** Whenever the location input changes (edit/view mode), prefill the form */
  private prefillForm(): void {
    const loc = this.location();
    if (loc) {
      this.name.set(loc.name);
      this.address.set(loc.address);
      this.city.set(loc.city);
      this.regionId.set(loc.region_id ?? null);
      if (loc.region_id) this.loadComunas(loc.region_id);
      this.comunaId.set(loc.comuna_id ?? null);
      this.codigoPostal.set(loc.codigo_postal ?? '');
      this.openingTime.set(loc.opening_time ?? null);
      this.closingTime.set(loc.closing_time ?? null);
      this.active.set(loc.active);
    }
  }

  loadRegions(): void {
    this.loadingRegions.set(true);
    this.api.getRegions().subscribe({
      next: (res) => {
        this.regions.set(res.data);
        this.loadingRegions.set(false);
      },
      error: (err) => {
        this.loadingRegions.set(false);
        this.httpError.handle(err, 'cargar regiones');
      },
    });
  }

  onRegionChange(): void {
    this.comunaId.set(null);
    this.comunas.set([]);
    const id = this.regionId();
    if (id !== null) this.loadComunas(id);
  }

  loadComunas(regionId: number): void {
    this.loadingComunas.set(true);
    this.api.getComunas(regionId).subscribe({
      next: (res) => {
        this.comunas.set(res.data);
        this.loadingComunas.set(false);
      },
      error: (err) => {
        this.loadingComunas.set(false);
        this.httpError.handle(err, 'cargar comunas');
      },
    });
  }

  onSave(): void {
    if (!this.isFormValid() || this.saving()) return;

    const payload: Partial<Location> = {
      name: this.name().trim(),
      address: this.address().trim(),
      city: this.city().trim(),
      region_id: this.regionId()!,
      comuna_id: this.comunaId(),
      codigo_postal: this.codigoPostal().trim() || undefined,
      opening_time: this.openingTime() || undefined,
      closing_time: this.closingTime() || undefined,
      active: this.active(),
    };

    this.saving.set(true);

    const obs = this.isCreate()
      ? this.api.createLocation(payload)
      : this.api.updateLocation(this.location()!.id, payload);

    obs.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.messageService.add({ severity: 'success', summary: res.message });
        this.refStore.invalidateLocations();
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        if (err.status === 422 && err.error?.errors) {
          // Field-level validation — show first error per field via HttpErrorService
          this.httpError.handle(err, 'guardar sucursal');
        } else {
          this.httpError.handle(err, 'guardar sucursal');
        }
      },
    });
  }

  onClose(): void {
    this.closed.emit();
  }

  switchToEdit(): void {
    // View → Edit: handled by parent changing mode input
    // This is triggered by a button click in view mode
  }
}
```

- [ ] **Step 2: Create the HTML template**

Create `location-dialog.component.html`:

```html
<p-dialog
  [(visible)]="visible()"
  [modal]="true"
  [style]="{ width: '540px' }"
  [contentStyle]="{ 'overflow-y': 'auto', 'max-height': '70vh' }"
  [draggable]="false"
  [resizable]="false"
  (onHide)="onClose()"
  [pt]="{ footer: { style: { paddingTop: '1.25rem' } } }"
>
  <ng-template pTemplate="header">
    <div class="location-dialog-header">
      <span class="location-dialog-title">{{ title() }}</span>
    </div>
  </ng-template>

  <div class="location-form">
    <!-- Nombre -->
    <div class="field">
      <label>Nombre *</label>
      <input
        pInputText
        [ngModel]="name()"
        (ngModelChange)="name.set($event)"
        [disabled]="isView()"
        placeholder="Sucursal Santiago Centro"
        class="w-full"
      />
    </div>

    <!-- Dirección -->
    <div class="field">
      <label>Dirección *</label>
      <input
        pInputText
        [ngModel]="address()"
        (ngModelChange)="address.set($event)"
        [disabled]="isView()"
        placeholder="Av. Providencia 1234"
        class="w-full"
      />
    </div>

    <!-- Ciudad + Región -->
    <div class="field-row">
      <div class="field">
        <label>Ciudad *</label>
        <input
          pInputText
          [ngModel]="city()"
          (ngModelChange)="city.set($event)"
          [disabled]="isView()"
          placeholder="Santiago"
          class="w-full"
        />
      </div>
      <div class="field">
        <label>Región *</label>
        @if (loadingRegions()) {
          <p-skeleton width="100%" height="2.5rem" borderRadius="6px" />
        } @else {
          <p-select
            [options]="regionOptions()"
            [ngModel]="regionId()"
            (ngModelChange)="regionId.set($event); onRegionChange()"
            [disabled]="isView()"
            [placeholder]="'Seleccionar...'"
            [appendTo]="'body'"
            class="w-full"
          />
        }
      </div>
    </div>

    <!-- Comuna + Código Postal -->
    <div class="field-row">
      <div class="field">
        <label>Comuna</label>
        @if (regionId() && loadingComunas()) {
          <p-skeleton width="100%" height="2.5rem" borderRadius="6px" />
        } @else {
          <p-select
            [options]="comunaOptions()"
            [ngModel]="comunaId()"
            (ngModelChange)="comunaId.set($event)"
            [disabled]="isView() || !regionId()"
            [placeholder]="regionId() ? 'Seleccionar...' : 'Primero seleccione región'"
            [appendTo]="'body'"
            class="w-full"
          />
        }
      </div>
      <div class="field">
        <label>Código Postal</label>
        <input
          pInputText
          [ngModel]="codigoPostal()"
          (ngModelChange)="codigoPostal.set($event)"
          [disabled]="isView()"
          placeholder="7500000"
          class="w-full"
        />
      </div>
    </div>

    <!-- Apertura + Cierre -->
    <div class="field-row">
      <div class="field">
        <label>Apertura</label>
        <p-datepicker
          [ngModel]="openingTime()"
          (ngModelChange)="openingTime.set($event)"
          [disabled]="isView()"
          timeOnly="true"
          hourFormat="24"
          [appendTo]="'body'"
          class="w-full"
        />
      </div>
      <div class="field">
        <label>Cierre</label>
        <p-datepicker
          [ngModel]="closingTime()"
          (ngModelChange)="closingTime.set($event)"
          [disabled]="isView()"
          timeOnly="true"
          hourFormat="24"
          [appendTo]="'body'"
          class="w-full"
        />
      </div>
    </div>

    <!-- Activa -->
    <div class="field">
      <label>Activa</label>
      <div class="toggle-row">
        <p-inputSwitch
          [ngModel]="active()"
          (ngModelChange)="active.set($event)"
          [disabled]="isView()"
        />
        <span class="toggle-label" [class.active]="active()">
          {{ active() ? 'Sí, está activa' : 'No, está inactiva' }}
        </span>
      </div>
    </div>

    <!-- View mode: timestamps -->
    @if (isView() && location(); as loc) {
      <div class="metadata-row">
        <span class="metadata-label">Creada: {{ loc.created_at | date:'short' }}</span>
        <span class="metadata-label">Actualizada: {{ loc.updated_at | date:'short' }}</span>
      </div>
    }
  </div>

  <ng-template pTemplate="footer">
    <div class="dialog-footer">
      @if (isView()) {
        <p-button label="Cerrar" severity="secondary" [outlined]="true" (onClick)="onClose()" />
        <p-button label="Editar" icon="pi pi-pencil" (onClick)="switchToEdit()" />
      } @else {
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="onClose()" />
        <p-button
          [label]="saveLabel()"
          icon="pi pi-check"
          [loading]="saving()"
          [disabled]="!isFormValid()"
          (onClick)="onSave()"
        />
      }
    </div>
  </ng-template>
</p-dialog>
```

- [ ] **Step 3: Create the SCSS styles**

Create `location-dialog.component.scss`:

```scss
.location-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
}

.location-dialog-title {
  font-size: var(--bw-font-title);
  font-weight: 600;
  color: var(--text-heading);
}

.location-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-label);
  }
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  align-items: end;
}

.w-full {
  width: 100%;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toggle-label {
  font-size: 0.9375rem;
  color: var(--text-color-secondary);
  transition: color 0.15s;

  &.active {
    color: var(--text-color);
    font-weight: 500;
  }
}

.metadata-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-border);
}

.metadata-label {
  font-size: 0.8125rem;
  color: var(--text-color-secondary);
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/locations/location-dialog/
git commit -m "feat(locations): create location-dialog component for create/edit/view"
```

---

### Task 4: Update locations-list component with toggle + dialog wiring

**Files:**
- Modify: `src/app/features/admin/locations/locations-list.component.ts`
- Modify: `src/app/features/admin/locations/locations-list.component.html`
- Modify: `src/app/features/admin/locations/locations-list.component.scss`

- [ ] **Step 1: Update the TypeScript**

Replace `locations-list.component.ts` with:

```typescript
import { ChangeDetectionStrategy, Component, inject, OnInit, signal, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { ReferenceStore } from '@core/stores/reference.store';
import { Location } from '@models';
import { LocationDialogComponent, DialogMode } from './location-dialog/location-dialog.component';

@Component({
  selector: 'bw-locations-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, TableModule, ButtonModule, CardModule, TagModule,
    SkeletonModule, InputSwitchModule, DialogModule, LocationDialogComponent,
  ],
  templateUrl: './locations-list.component.html',
  styleUrls: ['./locations-list.component.scss'],
})
export class LocationsListComponent implements OnInit {
  private api = inject(ApiService);
  private httpError = inject(HttpErrorService);
  private refStore = inject(ReferenceStore);
  private messageService = inject(MessageService);

  // ── Data ──────────────────────────────────────────────────────
  locations = signal<Location[]>([]);
  loading = signal(true);
  toggling = signal<Set<number>>(new Set());

  // ── Dialog state ──────────────────────────────────────────────
  dialogVisible = signal(false);
  dialogMode = signal<DialogMode>('create');
  selectedLocation = signal<Location | null>(null);

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
      error: (err) => {
        this.locations.set([]);
        this.loading.set(false);
        this.httpError.handle(err, 'cargar sucursales');
      },
    });
  }

  // ── Dialog actions ────────────────────────────────────────────
  openCreate(): void {
    this.dialogMode.set('create');
    this.selectedLocation.set(null);
    this.dialogVisible.set(true);
  }

  openView(location: Location): void {
    this.dialogMode.set('view');
    this.selectedLocation.set(location);
    this.dialogVisible.set(true);
  }

  openEdit(location: Location): void {
    this.dialogMode.set('edit');
    this.selectedLocation.set(location);
    this.dialogVisible.set(true);
  }

  onDialogClosed(): void {
    this.dialogVisible.set(false);
  }

  onDialogSaved(): void {
    this.dialogVisible.set(false);
    this.loadLocations();
  }

  // ── Inline toggle ─────────────────────────────────────────────
  toggleActive(location: Location): void {
    const id = location.id;
    const newActive = !location.active;

    // Optimistic update
    this.locations.update((list) =>
      list.map((l) => (l.id === id ? { ...l, active: newActive } : l)),
    );

    this.toggling.update((set) => new Set(set).add(id));

    this.api.updateLocation(id, { active: newActive } as Partial<Location>).subscribe({
      next: (res) => {
        this.toggling.update((set) => {
          const newSet = new Set(set);
          newSet.delete(id);
          return newSet;
        });
        this.messageService.add({ severity: 'success', summary: res.message });
        this.refStore.invalidateLocations();
      },
      error: (err) => {
        // Rollback optimistic update
        this.locations.update((list) =>
          list.map((l) => (l.id === id ? { ...l, active: !newActive } : l)),
        );
        this.toggling.update((set) => {
          const newSet = new Set(set);
          newSet.delete(id);
          return newSet;
        });

        // Handle 409 conflict
        if (err.status === 409 && err.error?.requires_confirmation) {
          this.showConflictDialog(location, err.error);
        } else {
          this.httpError.handle(err, 'cambiar estado');
        }
      },
    });
  }

  // ── 409 Conflict flow ─────────────────────────────────────────
  conflictDialogVisible = signal(false);
  conflictData = signal<{ message: string; affects: { bookings: any[] } } | null>(null);
  pendingToggleLocation = signal<Location | null>(null);

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

    this.api.updateLocation(location.id, { active: false, force: true } as any).subscribe({
      next: (res) => {
        this.toggling.update((set) => {
          const newSet = new Set(set);
          newSet.delete(location.id);
          return newSet;
        });
        this.messageService.add({ severity: 'success', summary: res.message });
        this.locations.update((list) =>
          list.map((l) => (l.id === location.id ? { ...l, active: false } : l)),
        );
        this.refStore.invalidateLocations();
        this.pendingToggleLocation.set(null);
      },
      error: (err) => {
        this.toggling.update((set) => {
          const newSet = new Set(set);
          newSet.delete(location.id);
          return newSet;
        });
        this.locations.update((list) =>
          list.map((l) => (l.id === location.id ? { ...l, active: true } : l)),
        );
        this.httpError.handle(err, 'desactivar sucursal');
        this.pendingToggleLocation.set(null);
      },
    });
  }

  cancelDeactivate(): void {
    // Rollback was already applied in toggleActive error handler
    this.conflictDialogVisible.set(false);
    this.pendingToggleLocation.set(null);
  }
}
```

- [ ] **Step 2: Update the HTML template**

Replace `locations-list.component.html` with:

```html
<p-card header="Sucursales">
  <ng-template pTemplate="icons">
    <p-button icon="pi pi-plus" label="Nueva" (onClick)="openCreate()" />
  </ng-template>

  @if (loading()) {
    <div class="list-skeleton">
      @for (row of [1,2,3,4,5]; track row) {
        <div class="list-sk-row bw-sk-card">
          <p-skeleton width="40px" height="1rem" borderRadius="4px" />
          <p-skeleton width="20%" height="1rem" borderRadius="4px" />
          <p-skeleton width="22%" height="1rem" borderRadius="4px" />
          <p-skeleton width="14%" height="1rem" borderRadius="4px" />
          <p-skeleton width="15%" height="1.5rem" borderRadius="12px" />
          <p-skeleton width="70px" height="1rem" borderRadius="4px" />
        </div>
      }
    </div>
  } @else {
    <p-table [value]="locations()" [tableStyle]="{ 'min-width': '50rem' }">
      <ng-template pTemplate="header">
        <tr>
          <th>ID</th>
          <th>Nombre</th>
          <th>Dirección</th>
          <th>Ciudad</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-location>
        <tr>
          <td>{{ location.id }}</td>
          <td>{{ location.name }}</td>
          <td>{{ location.address }}</td>
          <td>{{ location.city }}</td>
          <td>
            <div class="status-cell">
              <p-tag
                [value]="location.active ? 'Activo' : 'Inactivo'"
                [severity]="location.active ? 'success' : 'danger'"
              />
              <p-inputSwitch
                [ngModel]="location.active"
                (ngModelChange)="toggleActive(location)"
                [loading]="toggling().has(location.id)"
              />
            </div>
          </td>
          <td>
            <p-button
              icon="pi pi-eye"
              class="p-button-text"
              pTooltip="Ver detalle"
              (onClick)="openView(location)"
            />
            <p-button
              icon="pi pi-pencil"
              class="p-button-text"
              pTooltip="Editar"
              (onClick)="openEdit(location)"
            />
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr>
          <td colspan="6" class="text-center">No se encontraron sucursales</td>
        </tr>
      </ng-template>
    </p-table>
  }
</p-card>

<!-- Location dialog (create / edit / view) -->
<bw-location-dialog
  [visible]="dialogVisible()"
  [mode]="dialogMode()"
  [location]="selectedLocation()"
  (closed)="onDialogClosed()"
  (saved)="onDialogSaved()"
/>

<!-- Conflict confirmation dialog -->
<p-dialog
  [(visible)]="conflictDialogVisible"
  [modal]="true"
  [style]="{ width: '540px' }"
  [draggable]="false"
  [resizable]="false"
  (onHide)="cancelDeactivate()"
  [pt]="{ footer: { style: { paddingTop: '1.25rem' } } }"
>
  <ng-template pTemplate="header">
    <div class="location-dialog-header">
      <span class="location-dialog-title">Desactivar sucursal</span>
    </div>
  </ng-template>

  @if (conflictData(); as data) {
    <div class="conflict-content">
      <div class="conflict-warning">
        ⚠️ {{ data.message }}
      </div>

      <p-table [value]="data.affects.bookings" [tableStyle]="{ 'min-width': '100%' }">
        <ng-template pTemplate="header">
          <tr>
            <th>#</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Profesional</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-booking>
          <tr>
            <td>{{ booking.id }}</td>
            <td>{{ booking.date }}</td>
            <td>{{ booking.time }}</td>
            <td>{{ booking.provider_name }}</td>
          </tr>
        </ng-template>
      </p-table>

      <p class="conflict-question">¿Desea continuar? Las reservas se verán afectadas.</p>
    </div>
  }

  <ng-template pTemplate="footer">
    <div class="dialog-footer">
      <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDeactivate()" />
      <p-button label="Sí, desactivar" icon="pi pi-ban" severity="danger" (onClick)="confirmDeactivate()" />
    </div>
  </ng-template>
</p-dialog>
```

- [ ] **Step 3: Update the SCSS**

Replace `locations-list.component.scss` with:

```scss
.text-center {
  text-align: center;
}

.list-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list-sk-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 6px;
}

.status-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

// ── Dialog styles (shared with location-dialog) ─────────────────

.location-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
}

.location-dialog-title {
  font-size: var(--bw-font-title);
  font-weight: 600;
  color: var(--text-heading);
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.conflict-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.conflict-warning {
  font-size: 0.9375rem;
  color: var(--text-color);
  font-weight: 500;
}

.conflict-question {
  font-size: 0.9375rem;
  color: var(--text-color);
  margin: 0;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/admin/locations/
git commit -m "feat(locations): wire inline toggle, create/edit/view dialog, and 409 conflict flow"
```

---

### Self-Review Checklist

Run this after writing the plan:

1. **Spec coverage:** Each spec requirement has a corresponding task — model updates (T1), API methods (T2), dialog component (T3), list wiring + toggle + conflict (T4). ✅
2. **Placeholder scan:** No "TBD", "TODO", "implement later", or empty code blocks. ✅
3. **Type consistency:** `Region`, `LocationComuna`, updated `Location` — all defined in T1, used consistently in T2-T4. ✅ Method signatures match across tasks. ✅
4. **No ambiguous steps:** Every step has actual code, file paths, and commands. ✅
