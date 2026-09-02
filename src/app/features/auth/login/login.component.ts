import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthApiService } from '@services/api/auth-api.service';
import { AuthService } from '@services/auth.service';
import { LanguageService } from '@services/language.service';
import { translateValidationMessage } from '@i18n/validation-translator';
import { LoginCredentials } from '@models';
import { AuthLayoutComponent } from '@shared/components/auth-layout/auth-layout.component';

@Component({
  selector: 'bw-login',
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
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private authApi = inject(AuthApiService);
  private auth = inject(AuthService);
  readonly lang = inject(LanguageService);

  loading = signal(false);
  error   = signal<string | null>(null);

  credentials: LoginCredentials = { email: '', password: '' };

  onLogin(): void {
    if (!this.credentials.email || !this.credentials.password) return;

    this.loading.set(true);
    this.error.set(null);

    this.authApi.login(this.credentials).subscribe({
      next: ({ token, user }) => {
        this.auth.login(token, user);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);

        // 403 { error: 'email_not_verified', detail } → no son credenciales inválidas:
        // el email aún no se verificó, avisamos sin caer en el error genérico de login.
        if (err?.status === 403 && err?.error?.error === 'email_not_verified') {
          const detail = err?.error?.detail as string | undefined;
          this.error.set(detail?.trim() || this.lang.t('auth.login_verify_email'));
          return;
        }

        const apiErrors = err.error?.errors as Record<string, string[]> | undefined;
        const rawMsg = apiErrors?.['email']?.[0];
        this.error.set(
          rawMsg
            ? translateValidationMessage(rawMsg, this.lang.lang())
            : this.lang.t('auth.login_error')
        );
      },
    });
  }
}
