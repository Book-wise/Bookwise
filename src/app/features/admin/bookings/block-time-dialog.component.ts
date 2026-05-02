import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';

const DAYS = [
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mie', value: 3 },
  { label: 'Jue', value: 4 },
  { label: 'Vie', value: 5 },
  { label: 'Sab', value: 6 },
  { label: 'Dom', value: 0 },
];

const END_TYPE_OPTIONS = [
  { label: 'Después de',      value: 'after' },
  { label: 'Fecha específica', value: 'until' },
];

const REPEAT_TYPE_OPTIONS = [
  { label: 'Diariamente',   value: 'daily'   },
  { label: 'Semanalmente',  value: 'weekly'  },
  { label: 'Mensualmente',  value: 'monthly' },
];

@Component({
  selector: 'app-block-time-dialog',
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
  ],
  templateUrl: './block-time-dialog.component.html',
  styleUrls: ['./block-time-dialog.component.scss'],
  providers: [MessageService],
})
export class BlockTimeDialogComponent {
  private messageService = inject(MessageService);

  visible = false;
  saving  = signal(false);
  reason  = '';

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

  readonly days              = DAYS;
  readonly endTypeOptions    = END_TYPE_OPTIONS;
  readonly repeatTypeOptions = REPEAT_TYPE_OPTIONS;

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

  open(startTime?: Date, endTime?: Date): void {
    if (startTime) this.startDate.set(startTime);
    if (endTime)   this.endDate.set(endTime);
    this.visible = true;
  }

  onClose(): void {
    this.visible = false;
    this.reason  = '';
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
    // TODO: wire to API (include repeat data when repeatEnabled())
    setTimeout(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Horario bloqueado',
        detail:  'El horario ha sido bloqueado correctamente',
      });
      this.saving.set(false);
      this.visible = false;
    }, 500);
  }
}
