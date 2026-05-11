import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

export type MessageType = 'success' | 'info' | 'error';

export interface ToastMessage {
  type: MessageType;
  title: string;
  message: string;
}

@Component({
  selector: 'bw-toast-modal',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  template: `
    <p-dialog 
      [(visible)]="visible" 
      [modal]="true" 
      [closable]="true" 
      [draggable]="false" 
      [resizable]="false"
      [style]="{ width: '400px' }"
      (onHide)="onClose()">
      
      <ng-template pTemplate="header">
        <div class="toast-header" [ngClass]="message()?.type">
          <i [class]="getIcon()"></i>
          <span>{{ message()?.title }}</span>
        </div>
      </ng-template>
      
      <div class="toast-body" [ngClass]="message()?.type">
        <p>{{ message()?.message }}</p>
      </div>
      
      <ng-template pTemplate="footer">
        <p-button 
          [label]="getButtonLabel()" 
          [styleClass]="getButtonClass()"
          (onClick)="onClose()">
        </p-button>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .toast-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: bold;
      font-size: 1.1rem;
    }
    
    .toast-header.success {
      color: #22c55e;
    }
    
    .toast-header.info {
      color: #3b82f6;
    }
    
    .toast-header.error {
      color: #ef4444;
    }
    
    .toast-body {
      padding: 1rem 0;
    }
    
    .toast-body p {
      margin: 0;
      line-height: 1.5;
    }
  `]
})
export class ToastModalComponent {
  @Input() visible = false;
  @Input() message = signal<ToastMessage | null>(null);
  @Output() visibleChange = new EventEmitter<boolean>();

  onClose(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  getIcon(): string {
    switch (this.message()?.type) {
      case 'success': return 'pi pi-check-circle';
      case 'info': return 'pi pi-info-circle';
      case 'error': return 'pi pi-times-circle';
      default: return 'pi pi-info-circle';
    }
  }

  getButtonLabel(): string {
    return this.message()?.type === 'error' ? 'Cerrar' : 'Aceptar';
  }

  getButtonClass(): string {
    switch (this.message()?.type) {
      case 'success': return 'p-button-success';
      case 'info': return 'p-button-info';
      case 'error': return 'p-button-danger';
      default: return 'p-button-primary';
    }
  }
}