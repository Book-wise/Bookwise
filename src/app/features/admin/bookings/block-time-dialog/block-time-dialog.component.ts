import { Component, computed, inject, signal, Output, EventEmitter, OnInit } from '@angular/core';
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
import { Location, Provider, CreateBlockedSlot } from '../../../../core/models';

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
  private api       = inject(ApiService);
  private httpError = inject(HttpErrorService);

  @Output() onBlocked = new EventEmitter<void>();

  visible    = false;
  saving     = signal(false);
  reason     = '';

  // ── Scope (all/location/provider) ────────────────────────────────────────
  scope = signal<'all' | 'location' | 'provider'>('all');
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

  readonly days              = DAYS_OF_WEEK;
  readonly endTypeOptions    = END_TYPE_OPTIONS;
  readonly repeatTypeOptions = REPEAT_TYPE_OPTIONS;
  readonly scopeOptions = [
    { label: 'Todas las ubicaciones', value: 'all' },
    { label: 'Ubicación específica', value: 'location' },
    { label: 'Profesional específico', value: 'provider' },
  ];

  locationOptions = computed(() => this.locations().map(l => ({ label: l.name, value: l.id })));
  providerOptions = computed(() => this.providers().map(p => ({ label: `${p.first_name} ${p.last_name}`, value: p.id })));

  // Lifecycle
  ngOnInit(): void {
    this.loadLocations();
    this.loadProviders();
  }

  private loadLocations(): void {
    this.api.getLocations().subscribe({
      next: (data) => this.locations.set(data),
    });
  }

  private loadProviders(): void {
    this.api.getProviders().subscribe({
      next: (data) => this.providers.set(data),
    });
  }

  onScopeChange(): void {
    // Clear selections when scope changes
    if (this.scope() === 'all') {
      this.locationId = null;
      this.providerId = null;
    } else if (this.scope() === 'location') {
      this.providerId = null;
    } else if (this.scope() === 'provider') {
      this.locationId = null;
    }
  }

  // ngModel getters/setters for signals
  get repeatEnabledValue(): boolean { return this.repeatEnabled(); }
  set repeatEnabledValue(v: boolean) { this.repeatEnabled.set(v); }

  get repeatTypeValue(): string { return this.repeatType(); }
  set repeatTypeValue(v: any) { this.repeatType.set(v); }

  get repeatIntervalValue(): number { return this.repeatInterval(); }
  set repeatIntervalValue(v: number) { this.repeatInterval.set(v); }

  get repeatEndTypeValue(): string { return this.repeatEndType(); }
  set repeatEndTypeValue(v: any) { this.repeatEndType.set(v); }

  get repeatCountValue(): number { return this.repeatCount(); }
  set repeatCountValue(v: number) { this.repeatCount.set(v); }

get repeatUntilValue(): Date | null { return this.repeatUntil(); }
  set repeatUntilValue(v: Date | null) { this.repeatUntil.set(v); }

  intervalLabel = computed(() => {
    const map: Record<string, string> = { daily: 'día(s)', weekly: 'semana(s)', monthly: 'mes(es)' };
    return map[this.repeatType()] ?? 'semana(s)';
  });

  // Scope getters for ngModel
  get scopeValue(): string { return this.scope(); }
  set scopeValue(v: string) { this.scope.set(v as 'all' | 'location' | 'provider'); }

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
    if (startTime) this.startDate.set(startTime);
    if (endTime)   this.endDate.set(endTime);
    this.locationId = locationId ?? null;
    this.providerId = providerId ?? null;
    this.visible = true;
  }

  onClose(): void {
    this.visible = false;
    this.reason  = '';
    this.scope.set('all');
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

    let location_id: number | undefined;
    let provider_id: number | undefined;
    let scope: 'all' | undefined = 'all';

    if (this.scope() === 'location') {
      location_id = this.locationId ?? undefined;
      scope = undefined;
    } else if (this.scope() === 'provider') {
      provider_id = this.providerId ?? undefined;
      scope = undefined;
    }

    const body: CreateBlockedSlot = {
      start_time: fmt(this.startDate()),
      end_time: fmt(this.endDate()),
      reason: this.reason || undefined,
      location_id,
      provider_id,
      scope,
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
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Horario bloqueado',
          detail: this.repeatEnabled()
            ? 'Las repeticiones se registraron en la agenda.'
            : 'El bloqueo quedó registrado en la agenda.',
        });
        this.saving.set(false);
        this.visible = false;
        this.onBlocked.emit();
      },
      error: (err) => {
        this.httpError.handle(err, 'bloquear horario');
        this.saving.set(false);
      },
    });
  }
}
