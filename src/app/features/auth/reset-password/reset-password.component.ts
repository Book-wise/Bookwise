import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthApiService } from '@services/api/auth-api.service';
import { LanguageService } from '@services/language.service';
import { translateValidationMessage } from '@i18n/validation-translator';
import { AuthLayoutComponent } from '@shared/components/auth-layout/auth-layout.component';

/** Estado de UI. Los códigos 400 del backend (`invalid_token`, `token_expired`,
 *  `token_already_used`) mapean a estados propios; `no_token` cubre el enlace sin token. */
type ResetState =
  | 'form'
  | 'success'
  | 'invalid_token'
  | 'token_expired'
  | 'token_already_used'
  | 'no_token';

/** i18n key del mensaje de cada código de error 400 devuelto por POST /auth/reset-password. */
const RESET_ERROR_TEXT_KEYS: Record<string, string> = {
  invalid_token: 'auth.reset.invalid_token',
  token_expired: 'auth.reset.token_expired',
  token_already_used: 'auth.reset.token_already_used',
};

@Component({
  selector: 'bw-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    AuthLayoutComponent,
  ],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
})
export class ResetPasswordComponent implements OnInit {
  private authApi = inject(AuthApiService);
  private route = inject(ActivatedRoute);
  readonly lang = inject(LanguageService);

  state = signal<ResetState>('form');
  loading = signal(false);

  /** Error 422 del campo password (bajo el input). */
  passwordError = signal<string | null>(null);
  /** Error genérico re-intentable (panel del formulario). */
  serverError = signal<string | null>(null);

  token = '';
  password = '';
  passwordConfirmation = '';

  /** i18n key del mensaje del panel de error según el estado actual. */
  readonly errorMessageKey = computed(
    () => RESET_ERROR_TEXT_KEYS[this.state()] ?? 'auth.reset.no_token',
  );

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('no_token');
      return;
    }
    this.token = token;
  }

  /** Pantallas terminales de error (token ausente o rechazado por el backend). */
  isTokenErrorState(): boolean {
    const s = this.state();
    return (
      s === 'invalid_token' ||
      s === 'token_expired' ||
      s === 'token_already_used' ||
      s === 'no_token'
    );
  }

  /** Reglas visibles: mínimo del backend (8) + confirmación que coincida. */
  isFormValid(): boolean {
    return this.password.length >= 8 && this.password === this.passwordConfirmation;
  }

  onSubmit(): void {
    if (!this.token || !this.isFormValid() || this.loading()) return;

    this.loading.set(true);
    this.serverError.set(null);
    this.passwordError.set(null);

    // POST /auth/reset-password → 200 { message } | 400 { error: code } | 422 { message, errors }.
    this.authApi
      .resetPassword({
        token: this.token,
        password: this.password,
        password_confirmation: this.passwordConfirmation,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.state.set('success');
        },
        error: (err) => {
          this.loading.set(false);
          const code = err?.error?.error as string | undefined;
          if (code === 'invalid_token' || code === 'token_expired' || code === 'token_already_used') {
            this.state.set(code);
            return;
          }
          const raw = (err?.error?.errors as Record<string, string[]> | undefined)?.['password']?.[0];
          if (err?.status === 422 && raw) {
            this.passwordError.set(translateValidationMessage(raw, this.lang.lang()));
            return;
          }
          this.serverError.set(this.lang.t('auth.reset.error'));
        },
      });
  }
}
