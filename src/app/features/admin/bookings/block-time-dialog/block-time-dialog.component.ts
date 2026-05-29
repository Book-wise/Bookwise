import { Component, computed, inject, signal, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { HttpErrorService } from '../../../../core/services/http-error.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { RadioButtonModule } from 'primeng/radiobutton';
import { MessageService } from 'primeng/api';
import { DAYS_OF_WEEK, REPEAT_TYPE_OPTIONS, END_TYPE_OPTIONS } from '../constants/repeat-options';
import { Location, Provider, CreateBlockedSlot, BlockedSlot } from '../../../../core/models';
import { BlockConflict, BlockConflictResponse } from '../../../../core/models';
import { DataCacheService, CACHE_KEYS, CACHE_TTL } from '../../../../core/services/data-cache.service';
import { LanguageService } from '../../../../core/services/language.service';

@Component({
  selector: 'bw-block-time-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    DatePickerModule,
    TextareaModule,
    CheckboxModule,
    SelectModule,
    InputNumberModule,
    RadioButtonModule,
  ],
  templateUrl: './block-time-dialog.component.html',
  styleUrls: ['./block-time-dialog.component.scss'],
})
export class BlockTimeDialogComponent implements OnInit {
  private messageService = inject(MessageService);
  private api        = inject(ApiService);
  private dataCache  = inject(DataCacheService);
  private httpError  = inject(HttpErrorService);
  readonly lang      = inject(LanguageService);

  @Input() lockedProviderId: number | null = null;
  @Output() onBlocked = new EventEmitter<void>();

  visible     = false;
  editMode    = false;
  editingSlotId: number | null = null;
  saving      = signal(false);
  reason      = '';

  // ── Scope (location/provider) ────────────────────────────────────────────
  scope = signal<'location' | 'provider'>('location');
  locations = signal<Location[]>([]);
  providers = signal<Provider[]>([]);
  
  locationId: number | null = null;
  providerId: number | null = null;

  // ── Date / time ─────────────────────────────────────────────────────────────

  startDate = signal<Date>(new Date());
  endDate   = signal<Date>(new Date(new Date().getTime() + 60 * 60 * 1000));

  startTimeStr = computed(() => this.fmt(this.startDate()));
  endTimeStr   = computed(() => this.fmt(this.endDate()));

  get startDateValue(): Date { return this.startDate(); }
  set startDateValue(d: Date) { this.startDate.set(d); }

  get endDateValue(): Date { return this.endDate(); }
  set endDateValue(d: Date) { this.endDate.set(d); }

  // ── Repeat ───────────────────────────────────────────────────────────────────

  repeatEnabled  = signal(false);
  repeatType     = signal<'daily' | 'weekly' | 'monthly'>('weekly');
  repeatInterval = signal(1);
  repeatDays     = signal<number[]>([]);
  repeatEndType  = signal<'after' | 'until' | 'never'>('after');
  repeatCount    = signal(5);
  repeatUntil    = signal<Date | null>(null);

  days = computed(() =>
    DAYS_OF_WEEK.map(d => ({ label: this.lang.t(d.labelKey), value: d.value }))
  );
  endTypeOptions = computed(() =>
    END_TYPE_OPTIONS.map(o => ({ label: this.lang.t(o.labelKey), value: o.value }))
  );
  repeatTypeOptions = computed(() =>
    REPEAT_TYPE_OPTIONS.map(o => ({ label: this.lang.t(o.labelKey), value: o.value }))
  );
  scopeOptions = computed(() => [
    { label: this.lang.t('scope.location'), value: 'location' },
    { label: this.lang.t('scope.provider'), value: 'provider' },
  ]);

  locationOptions = computed(() => this.locations().map(l => ({ label: l.name, value: l.id })));
  providerOptions = computed(() => this.providers().map(p => ({ label: `${p.first_name} ${p.last_name}`, value: p.id })));

  // Lifecycle
  ngOnInit(): void { /* datos cargados al abrir, no al montar */ }

  private loadFormData(): void {
    this.dataCache.getOrFetchResource(CACHE_KEYS.LOCATIONS, () => this.api.getLocations(), CACHE_TTL.LOCATIONS)
      .subscribe({ next: d => this.locations.set(d) });
    this.dataCache.getOrFetchResource(CACHE_KEYS.PROVIDERS, () => this.api.getProviders(), CACHE_TTL.PROVIDERS)
      .subscribe({ next: d => this.providers.set(d) });
  }

  onScopeChange(): void {
    if (this.scope() === 'location') {
      this.providerId = null;
    } else if (this.scope() === 'provider') {
      this.locationId = null;
    }
  }

  // ngModel getters/setters for signals
  get repeatEnabledValue(): boolean { return this.repeatEnabled(); }
  set repeatEnabledValue(v: boolean) { this.repeatEnabled.set(v); }

  get repeatTypeValue(): string { return this.repeatType(); }
  set repeatTypeValue(v: 'daily' | 'weekly' | 'monthly') { this.repeatType.set(v); }

  get repeatIntervalValue(): number { return this.repeatInterval(); }
  set repeatIntervalValue(v: number) { this.repeatInterval.set(v); }

  get repeatEndTypeValue(): string { return this.repeatEndType(); }
  set repeatEndTypeValue(v: 'after' | 'until' | 'never') { this.repeatEndType.set(v); }

  get repeatCountValue(): number { return this.repeatCount(); }
  set repeatCountValue(v: number) { this.repeatCount.set(v); }

get repeatUntilValue(): Date | null { return this.repeatUntil(); }
  set repeatUntilValue(v: Date | null) { this.repeatUntil.set(v); }

  intervalLabel = computed(() => {
    const map: Record<string, string> = {
      daily:   this.lang.t('block.interval.day'),
      weekly:  this.lang.t('block.interval.week'),
      monthly: this.lang.t('block.interval.month'),
    };
    return map[this.repeatType()] ?? this.lang.t('block.interval.week');
  });

  // Scope getters for ngModel
  get scopeValue(): string { return this.scope(); }
  set scopeValue(v: string) { this.scope.set(v as 'location' | 'provider'); }

  isDaySelected(v: number): boolean {
    return this.repeatDays().includes(v);
  }

  toggleDay(v: number): void {
    const current = this.repeatDays();
    this.repeatDays.set(
      current.includes(v) ? current.filter(d => d !== v) : [...current, v]
    );
  }

  // ── Time helpers ─────────────────────────────────────────────────────────────

  onStartTimeChange(event: Event): void {
    this.startDate.set(this.applyTime(this.startDate(), event));
  }

  onEndTimeChange(event: Event): void {
    this.endDate.set(this.applyTime(this.endDate(), event));
  }

  private fmt(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private applyTime(base: Date, event: Event): Date {
    const val = (event.target as HTMLInputElement).value;
    if (!val) return base;
    const [h, m] = val.split(':').map(Number);
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  open(startTime?: Date, endTime?: Date, locationId?: number | null, providerId?: number | null): void {
    this.editMode = false;
    this.editingSlotId = null;
    this.loadFormData();
    if (startTime) this.startDate.set(startTime);
    if (endTime)   this.endDate.set(endTime);
    if (this.lockedProviderId) {
      this.scope.set('provider');
      this.providerId = this.lockedProviderId;
      this.locationId = null;
    } else {
      this.locationId = locationId ?? null;
      this.providerId = providerId ?? null;
      this.scope.set('location');
    }
    this.visible = true;
  }

  openForEdit(slot: BlockedSlot): void {
    this.editMode = true;
    this.editingSlotId = slot.id;
    this.loadFormData();
    this.reason     = slot.reason ?? '';
    if (this.lockedProviderId) {
      this.scope.set('provider');
      this.providerId = this.lockedProviderId;
    } else {
      this.providerId = slot.provider_id ?? null;
      this.locationId = slot.provider_id ? null : (slot.location_id ?? null);
      this.scope.set(slot.provider_id ? 'provider' : 'location');
    }
    this.startDate.set(new Date(slot.start_time));
    this.endDate.set(new Date(slot.end_time));
    this.visible = true;
  }

  onClose(): void {
    this.visible = false;
    this.reason  = '';
    this.scope.set('location');
    this.locationId = null;
    this.providerId = null;
    this.startDate.set(new Date());
    this.endDate.set(new Date(new Date().getTime() + 60 * 60 * 1000));
    this.repeatEnabled.set(false);
    this.repeatType.set('weekly');
    this.repeatInterval.set(1);
    this.repeatDays.set([]);
    this.repeatEndType.set('after');
    this.repeatCount.set(5);
    this.repeatUntil.set(null);
  }

  block(): void {
    this.saving.set(true);

    const fmt = (d: Date) => d.toISOString().replace('T', ' ').substring(0, 19);

    const body: CreateBlockedSlot = {
      start_time: fmt(this.startDate()),
      end_time:   fmt(this.endDate()),
      reason:     this.reason || undefined,
      location_id: this.scope() === 'location' ? (this.locationId ?? undefined) : undefined,
      provider_id: this.scope() === 'provider' ? (this.providerId ?? undefined) : undefined,
    };

    if (this.repeatEnabled()) {
      body.repeat = {
        type: this.repeatType(),
        interval: this.repeatInterval(),
        days: this.repeatType() === 'weekly' ? this.repeatDays() : undefined,
        end_type: this.repeatEndType(),
        count: this.repeatEndType() === 'after' ? this.repeatCount() : undefined,
        until: this.repeatEndType() === 'until' && this.repeatUntil()
          ? fmt(this.repeatUntil()!)
          : undefined,
      };
    }

    this.api.createBlockedSlot(body).subscribe({
      next: (response: Partial<BlockConflictResponse>) => {
        if (response.conflicts?.length) {
          response.conflicts!.forEach((c: BlockConflict) => {
            const providerName = `${c.provider.first_name} ${c.provider.last_name}`;
            const conflictTime = new Date(c.conflict.start_time).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
            this.messageService.add({
              severity: 'warn',
              summary: this.lang.t('toast.block_conflict.summary', { name: providerName }),
              detail:  this.lang.t('toast.block_conflict.detail',  { time: conflictTime }),
              life: 7000,
            });
          });
        }
        if (!response.conflicts?.length || response.blocked?.length) {
          this.messageService.add({
            severity: 'success',
            summary: this.lang.t('toast.block_created.summary'),
            detail:  this.repeatEnabled()
              ? this.lang.t('toast.block_created_repeat.detail')
              : this.lang.t('toast.block_created.detail'),
          });
          this.saving.set(false);
          this.visible = false;
          this.onBlocked.emit();
        } else {
          this.saving.set(false);
        }
      },
      error: (err) => {
        this.httpError.handle(err, 'bloquear horario');
        this.saving.set(false);
      },
    });
  }

  updateBlock(): void {
    if (!this.editingSlotId) return;
    this.saving.set(true);
    const fmt = (d: Date) => d.toISOString().replace('T', ' ').substring(0, 19);
    this.api.updateBlockedSlot(this.editingSlotId, {
      start_time: fmt(this.startDate()),
      end_time:   fmt(this.endDate()),
      reason:     this.reason || undefined,
      provider_id: this.scope() === 'provider' ? (this.providerId ?? null) : null,
    }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: this.lang.t('toast.block_updated.summary'), detail: this.lang.t('toast.block_updated.detail'), life: 3000 });
        this.saving.set(false);
        this.visible = false;
        this.onBlocked.emit();
      },
      error: (err) => {
        this.httpError.handle(err, 'actualizar bloqueo');
        this.saving.set(false);
      },
    });
  }

  deleteBlock(): void {
    if (!this.editingSlotId) return;
    this.api.deleteBlockedSlot(this.editingSlotId).subscribe({
      next: () => {
        this.messageService.add({ severity: 'info', summary: this.lang.t('toast.block_deleted.summary'), life: 3000 });
        this.visible = false;
        this.onBlocked.emit();
      },
      error: (err) => this.httpError.handle(err, 'eliminar bloqueo'),
    });
  }
}
