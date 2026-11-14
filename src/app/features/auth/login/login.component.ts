import { Component, ElementRef, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
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

  /**
   * El formulario de correo arranca plegado: los proveedores y el correo son
   * los cuatro caminos de entrada y el formulario aparece cuando se elige el
   * de correo (artboard `design/login/01-split-brand.html`).
   */
  readonly showEmailForm = signal(false);

  private readonly injector = inject(Injector);
  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');
  private readonly emailBack = viewChild<ElementRef<HTMLButtonElement>>('emailBack');

  /**
   * Cambia entre la vista de accesos y la del formulario de correo, y mueve el
   * foco al control que toma el relevo: el campo de correo al abrir, el botón
   * «volver» al cerrar. Va con `afterNextRender` para no robar el foco del
   * documento al montar la pantalla.
   */
  toggleEmailForm(): void {
    this.showEmailForm.update((open) => !open);

    afterNextRender(
      () => {
        const target = this.showEmailForm() ? this.emailInput() : this.emailBack();
        target?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  onLogin(): void {
    if (!this.credentials.email || !this.credentials.password) return;

    this.loading.set(true);
    this.error.set(null);

    this.authApi.login(this.credentials).subscribe({
      next: ({ token, user, abilities, permissions }) => {
        this.auth.login(token, user, abilities, permissions);
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
