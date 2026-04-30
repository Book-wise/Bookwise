import { Injectable, signal } from '@angular/core';
import { ToastMessage, MessageType } from './toast-modal.component';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private _message = signal<ToastMessage | null>(null);
  private _visible = signal<boolean>(false);

  readonly message = this._message.asReadonly();
  readonly visible = this._visible.asReadonly();

  show(type: MessageType, title: string, message: string): void {
    this._message.set({ type, title, message });
    this._visible.set(true);
  }

  success(title: string, message: string): void {
    this.show('success', title, message);
  }

  info(title: string, message: string): void {
    this.show('info', title, message);
  }

  error(title: string, message: string): void {
    this.show('error', title, message);
  }

  hide(): void {
    this._visible.set(false);
    this._message.set(null);
  }
}