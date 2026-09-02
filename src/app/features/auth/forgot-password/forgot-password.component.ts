import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthApiService } from '@services/api/auth-api.service';
import { LanguageService } from '@services/language.service';
import { translateValidationMessage } from '@i18n/validation-translator';
import { AuthLayoutComponent } from '@shared/components/auth-layout/auth-layout.component';

/** Estado de pantalla del flujo público de recuperación de contraseña. */
type ForgotState = 'form' | 'sent';

@Component({
  selector: 'bw-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    ButtonModule,
    MessageModule,
    AuthLayoutComponent,
  ],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
})
export class ForgotPasswordComponent {
  private authApi = inject(AuthApiService);
  readonly lang = inject(LanguageService);

  loading = signal(false);
  state = signal<ForgotState>('form');
  sentEmail = signal<string | null>(null);

  /** Error 422 del campo email (bajo el input). */
  fieldError = signal<string | null>(null);
  /** Error genérico (panel de la pantalla). */
  error = signal<string | null>(null);

  email = '';

  onSubmit(): void {
    const email = this.email.trim();
    if (!email || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);
    this.fieldError.set(null);

    // POST /auth/forgot-password → 200 siempre (anti-enumeración): mostramos la
    // pantalla de éxito con el email tipeado sin distinguir cuentas existentes.
    this.authApi.forgotPassword(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.sentEmail.set(email);
        this.state.set('sent');
      },
      error: (err) => {
        this.loading.set(false);
        const raw = (err?.error?.errors as Record<string, string[]> | undefined)?.['email']?.[0];
        if (err?.status === 422 && raw) {
          this.fieldError.set(translateValidationMessage(raw, this.lang.lang()));
          return;
        }
        this.error.set(this.lang.t('auth.forgot.error'));
      },
    });
  }
}
