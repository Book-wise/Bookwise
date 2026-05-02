import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';

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

  startDate = signal<Date>(new Date());
  endDate   = signal<Date>(new Date(new Date().getTime() + 60 * 60 * 1000));

  // Computed strings — reactive: update automatically when signals change
  startTimeStr = computed(() => this.fmt(this.startDate()));
  endTimeStr   = computed(() => this.fmt(this.endDate()));

  // Also expose date values as plain getters for p-datepicker [(ngModel)]
  get startDateValue(): Date { return this.startDate(); }
  set startDateValue(d: Date) { this.startDate.set(d); }

  get endDateValue(): Date { return this.endDate(); }
  set endDateValue(d: Date) { this.endDate.set(d); }

  // ── Time helpers ────────────────────────────────────────────────────────────

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

  // ── Lifecycle ───────────────────────────────────────────────────────────────

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
  }

  block(): void {
    this.saving.set(true);
    // TODO: wire to API
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
