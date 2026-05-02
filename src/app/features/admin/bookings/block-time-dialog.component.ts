import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';

interface BlockedSlot {
  id?: number;
  location_id: number;
  provider_id?: number;
  start_time: string;
  end_time: string;
  reason?: string;
}

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
  saving = signal(false);

  startDate: Date = new Date();
  endDate: Date   = new Date(new Date().getTime() + 60 * 60 * 1000);
  reason = '';

  // ── Time helpers ────────────────────────────────────────────────────────────

  getStartTimeString(): string {
    return this.toTimeString(this.startDate);
  }

  getEndTimeString(): string {
    return this.toTimeString(this.endDate);
  }

  onStartTimeChange(event: Event): void {
    this.startDate = this.applyTime(this.startDate, event);
  }

  onEndTimeChange(event: Event): void {
    this.endDate = this.applyTime(this.endDate, event);
  }

  private toTimeString(d: Date): string {
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

  open(startTime?: Date, endTime?: Date) {
    if (startTime) this.startDate = startTime;
    if (endTime)   this.endDate   = endTime;
    this.visible = true;
  }

  onClose() {
    this.visible   = false;
    this.startDate = new Date();
    this.endDate   = new Date(new Date().getTime() + 60 * 60 * 1000);
    this.reason    = '';
  }

  block() {
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
