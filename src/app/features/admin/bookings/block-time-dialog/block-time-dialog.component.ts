import { Component, computed, inject, signal, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { ApiService } from '@services/api.service';
import { HttpErrorService } from '@services/http-error.service';
import { TimezoneService } from '@services/timezone.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { DAYS_OF_WEEK, REPEAT_TYPE_OPTIONS, END_TYPE_OPTIONS } from '../constants/repeat-options';
import { Location, Provider, CreateBlockedSlot, BlockedSlot, BlockConflict, BlockConflictResponse } from '@models';
import { ReferenceStore } from '@core/stores/reference.store';
import { LanguageService } from '@services/language.service';
import { DateTime } from 'luxon';

const BLOCK_BULK_THRESHOLD = 5;

@Component({
  selector: 'bw-block-time-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    DatePickerModule,
    InputTextModule,
    CheckboxModule,
    SelectModule,
    InputNumberModule,
    RadioButtonModule,
    SkeletonModule,
  ],
  templateUrl: './block-time-dialog.component.html',
  styleUrls: ['./block-time-dialog.component.scss'],
})
export class BlockTimeDialogComponent implements OnInit {
  private messageService = inject(MessageService);
  private api        = inject(ApiService);
  private httpError  = inject(HttpErrorService);
  readonly lang      = inject(LanguageService);
  private tzService  = inject(TimezoneService);

  /** ReferenceStore: datos maestros */
  private refStore   = inject(ReferenceStore);

  @Input() lockedProviderId: number | null = null;
  @Input() lockedLocationId: number | null = null;
  @Output() onBlocked = new EventEmitter<void>();

  visible     = false;
  editMode    = false;
  editingSlotId: number | null = null;
  saving      = signal(false);
  reason      = '';

  /** Skeleton visible hasta que el store cargue */
  readonly loading = computed(() => !this.refStore.allLoaded());

  // ── Scope (location/provider) ────────────────────────────────────────────
  scope = signal<'location' | 'provider'>('location');
  readonly locations = this.refStore.locations;
  readonly providers = this.refStore.providers;
  
  locationId: number | null = null;
  providerId: number | null = null;

  // ── Date / time ─────────────────────────────────────────────────────────────

  startDate = signal<Date>(new Date());
  endDate   = signal<Date>(new Date(new Date().getTime() + 60 * 60 * 1000));

  startTimeStr = computed(() => this.fmt(this.startDate()));
  endTimeStr   = computed(() => this.fmt(this.endDate()));

  endBeforeStart = computed(() => this.endDate().getTime() <= this.startDate().getTime());

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
  providerOptions = computed(() => this.providers().map(p => ({
    label: `${p.first_name} ${p.last_name}`,
    locationLabel: p.location?.name ?? '—',
    value: p.id,
  })));

  // Lifecycle
  ngOnInit(): void { /* datos cargados al abrir, no al montar */ }

  /** Los datos vienen reactivamente desde ReferenceStore */
  private loadFormData(): void {
    // No-op: el store ya carga todo en onInit
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
    return DateTime.fromJSDate(d).setZone(this.tzService.activeTimezone()).toFormat('HH:mm');
  }

  private applyTime(base: Date, event: Event): Date {
    return this.tzService.applyTime(base, event);
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
      this.locationId = this.lockedLocationId ?? locationId ?? null;
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
      this.locationId = this.lockedLocationId ?? slot.location_id ?? null;
    } else {
      this.providerId = slot.provider_id ?? null;
      this.locationId = slot.location_id ?? null;
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
    if (this.endBeforeStart()) {
      this.messageService.add({ severity: 'warn', summary: this.lang.t('error.422'), detail: this.lang.t('block.error.end_before_start'), life: 4000 });
      return;
    }
    this.saving.set(true);

    const fmtDt = (d: Date) => this.tzService.formatDateTime(d);

    const body: CreateBlockedSlot = {
      start_time: fmtDt(this.startDate()),
      end_time:   fmtDt(this.endDate()),
      reason:     this.reason || undefined,
      location_id: this.locationId ?? undefined,
    };

    if (this.scope() === 'location') {
      body.scope = 'all';
    } else {
      body.provider_id = this.providerId ?? undefined;
    }

    if (this.repeatEnabled()) {
      body.repeat = {
        type: this.repeatType(),
        interval: this.repeatInterval(),
        days: this.repeatType() === 'weekly' ? this.repeatDays() : undefined,
        end_type: this.repeatEndType(),
        count: this.repeatEndType() === 'after' ? this.repeatCount() : undefined,
        until: this.repeatEndType() === 'until' && this.repeatUntil()
          ? fmtDt(this.repeatUntil()!)
          : undefined,
      };
    }

    this.api.createBlockedSlot(body).subscribe({
      next: (response: Partial<BlockConflictResponse>) => {
        if (response.conflicts?.length) {
          response.conflicts!.forEach((c: BlockConflict) => {
            const providerName = `${c.provider.first_name} ${c.provider.last_name}`;
            const conflictTime = this.tzService.formatTime(c.conflict.start_time);
            const detail = c.conflict.type === 'booking'
              ? this.lang.t('toast.block_conflict.booking', { service: c.conflict.service ?? '', client: c.conflict.client ?? '', time: conflictTime })
              : this.lang.t('toast.block_conflict.blocked', { time: conflictTime });
            this.messageService.add({
              severity: 'warn',
              summary: this.lang.t('toast.block_conflict.summary', { name: providerName }),
              detail,
              life: 7000,
            });
          });
        }
        const detail = this.repeatEnabled()
          ? this.lang.t('toast.block_created_repeat.detail')
          : this.lang.t('toast.block_created.detail');

        if (this.scope() === 'provider') {
          // Single-provider success response is `{ data: [...] }` — no `blocked`/`conflicts`.
          // Conflicts for this scope arrive as an HTTP 409 via the error callback instead.
          const provider = this.providers().find(p => p.id === this.providerId);
          const summary = provider
            ? this.lang.t('toast.block_created.summary_named', { name: `${provider.first_name} ${provider.last_name}` })
            : this.lang.t('toast.block_created.summary');
          this.messageService.add({ severity: 'success', summary, detail });
        } else if (response.blocked?.length) {
          // `response.blocked` holds blocked-slot IDs, not provider IDs — derive the
          // affected providers from the location roster minus anyone in `conflicts`.
          const conflictedProviderIds = new Set((response.conflicts ?? []).map(c => c.provider.id));
          const blockedProviders = this.providers().filter(
            p => p.location?.id === this.locationId && !conflictedProviderIds.has(p.id)
          );

          if (blockedProviders.length > BLOCK_BULK_THRESHOLD) {
            const locationName = this.locations().find(l => l.id === this.locationId)?.name ?? '';
            this.messageService.add({
              severity: 'success',
              summary: this.lang.t('toast.block_created.summary_bulk', {
                count: String(blockedProviders.length),
                location: locationName,
              }),
              detail,
            });
          } else {
            blockedProviders.forEach((provider) => {
              const summary = this.lang.t('toast.block_created.summary_named', { name: `${provider.first_name} ${provider.last_name}` });
              this.messageService.add({ severity: 'success', summary, detail });
            });
          }
        }

        if (this.scope() === 'provider' || !response.conflicts?.length || response.blocked?.length) {
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
    if (this.endBeforeStart()) {
      this.messageService.add({ severity: 'warn', summary: this.lang.t('error.422'), detail: this.lang.t('block.error.end_before_start'), life: 4000 });
      return;
    }
    this.saving.set(true);
    const fmtDt = (d: Date) => this.tzService.formatDateTime(d);
    this.api.updateBlockedSlot(this.editingSlotId, {
      start_time: fmtDt(this.startDate()),
      end_time:   fmtDt(this.endDate()),
      reason:     this.reason || undefined,
      location_id: this.locationId ?? null,
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
