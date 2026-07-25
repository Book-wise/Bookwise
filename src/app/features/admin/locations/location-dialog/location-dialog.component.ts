import { ChangeDetectionStrategy, Component, inject, input, output, signal, computed, effect, untracked, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
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
    SelectModule, ToggleSwitchModule, DatePickerModule, SkeletonModule,
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

  visible = input(false);
  mode = input<DialogMode>('create');
  location = input<Location | null>(null);

  closed = output<void>();
  saved = output<void>();

  /** Emitted when user clicks "Editar" in view mode to request switch to edit mode. */
  editRequested = output<void>();

  saving = signal(false);
  loadingRegions = signal(false);
  loadingComunas = signal(false);
  regions = signal<Region[]>([]);
  comunas = signal<LocationComuna[]>([]);

  /** Internal mode allows override from view→edit via switchToEdit(). */
  private internalMode = signal<DialogMode>('create');

  name = signal('');
  address = signal('');
  city = signal('');
  regionId = signal<number | null>(null);
  comunaId = signal<number | null>(null);
  codigoPostal = signal('');
  openingTime = signal<string | null>(null);
  closingTime = signal<string | null>(null);
  active = signal(true);

  isView = computed(() => this.internalMode() === 'view');
  isCreate = computed(() => this.internalMode() === 'create');
  title = computed(() => {
    if (this.isCreate()) return 'Nueva sucursal';
    if (this.isView()) return this.location()?.name ?? '';
    return 'Editar sucursal';
  });
  saveLabel = computed(() => this.isCreate() ? 'Crear sucursal' : 'Guardar cambios');
  isFormValid = computed(() =>
    this.name().trim().length > 0 &&
    this.address().trim().length > 0 &&
    this.city().trim().length > 0 &&
    this.regionId() !== null
  );

  regionOptions = computed(() => this.regions().map(r => ({ label: r.name, value: r.id })));
  comunaOptions = computed(() => this.comunas().map(c => ({ label: c.name, value: c.id })));

  constructor() {
    effect(() => {
      const mode = this.mode();
      const loc = this.location();
      this.internalMode.set(mode);
      // Use untracked to avoid forming a dependency chain on form-field signals
      untracked(() => {
        if (loc) {
          this.name.set(loc.name);
          this.address.set(loc.address);
          this.city.set(loc.city);
          this.regionId.set(loc.region_id ?? null);
          if (loc.region_id) {
            this.loadComunas(loc.region_id);
          } else {
            this.comunas.set([]);
          }
          this.comunaId.set(loc.comuna_id ?? null);
          this.codigoPostal.set(loc.codigo_postal ?? '');
          this.openingTime.set(loc.opening_time ?? null);
          this.closingTime.set(loc.closing_time ?? null);
          this.active.set(loc.active);
        } else {
          this.name.set('');
          this.address.set('');
          this.city.set('');
          this.regionId.set(null);
          this.comunaId.set(null);
          this.comunas.set([]);
          this.codigoPostal.set('');
          this.openingTime.set(null);
          this.closingTime.set(null);
          this.active.set(true);
        }
      });
    });
  }

  ngOnInit(): void {
    this.loadRegions();
  }

  loadRegions(): void {
    this.loadingRegions.set(true);
    this.api.getRegions().subscribe({
      next: (res) => { this.regions.set(res.data); this.loadingRegions.set(false); },
      error: (err) => { this.loadingRegions.set(false); this.httpError.handle(err, 'cargar regiones'); },
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
      next: (res) => { this.comunas.set(res.data); this.loadingComunas.set(false); },
      error: (err) => { this.loadingComunas.set(false); this.httpError.handle(err, 'cargar comunas'); },
    });
  }

  switchToEdit(): void {
    this.editRequested.emit();
  }

  onSave(): void {
    if (!this.isFormValid() || this.saving()) return;

    const payload: Partial<Location> = {
      name: this.name().trim(),
      address: this.address().trim(),
      city: this.city().trim(),
      region_id: this.regionId()!,
      comuna_id: this.comunaId() ?? undefined,
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
        this.messageService.add({ severity: 'success', summary: res.message, key: 'global' });
        this.refStore.invalidateLocations();
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.httpError.handle(err, 'guardar sucursal');
      },
    });
  }

  onClose(): void {
    this.closed.emit();
  }
}
