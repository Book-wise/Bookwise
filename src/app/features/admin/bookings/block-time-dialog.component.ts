import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
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
    InputTextModule,
    TextareaModule
  ],
  template: `
    <p-dialog
      header="Bloquear Horario"
      [(visible)]="visible"
      [modal]="true"
      [style]="{width: '520px'}"
      [contentStyle]="{'overflow': 'visible'}"
      [draggable]="false"
      (onHide)="onClose()">

      <div class="block-form">
        <div class="field">
          <label>Fecha y hora inicio</label>
          <p-datepicker
            [(ngModel)]="startDate"
            dateFormat="dd/mm/yy"
            [showTime]="true"
            hourFormat="24"
            styleClass="w-full"
            [appendTo]="'body'" />
        </div>

        <div class="field">
          <label>Fecha y hora fin</label>
          <p-datepicker
            [(ngModel)]="endDate"
            dateFormat="dd/mm/yy"
            [showTime]="true"
            hourFormat="24"
            styleClass="w-full"
            [appendTo]="'body'" />
        </div>
        
        <div class="field">
          <label>Motivo (opcional)</label>
          <textarea pTextArea [(ngModel)]="reason" rows="3" placeholder="Motivo del bloqueo" class="w-full"></textarea>
        </div>
      </div>
      
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" styleClass="p-button-text" (onClick)="onClose()"></p-button>
        <p-button label="Bloquear" icon="pi pi-lock" [loading]="saving()" (onClick)="block()"></p-button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .block-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .field label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }
    
    .w-full {
      width: 100%;
    }
  `],
  providers: [MessageService]
})
export class BlockTimeDialogComponent {
  private messageService = inject(MessageService);
  
  visible = false;
  saving = signal(false);
  
  startDate: Date = new Date();
  endDate: Date = new Date(new Date().getTime() + 60 * 60 * 1000); // +1 hour
  reason = '';
  
  open(startTime?: Date, endTime?: Date) {
    if (startTime) this.startDate = startTime;
    if (endTime) this.endDate = endTime;
    this.visible = true;
  }
  
  onClose() {
    this.visible = false;
    this.startDate = new Date();
    this.endDate = new Date(new Date().getTime() + 60 * 60 * 1000);
    this.reason = '';
  }
  
  block() {
    this.saving.set(true);
    
    // Here you would call the API to block the time slot
    // For now, simulate success
    setTimeout(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Horario bloqueado',
        detail: 'El horario ha sido bloqueado correctamente'
      });
      this.saving.set(false);
      this.visible = false;
    }, 500);
  }
}
