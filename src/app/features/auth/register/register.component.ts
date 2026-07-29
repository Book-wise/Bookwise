import { Component, inject, signal } from '@angular/core';
import { NgForm } from '@angular/forms';
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
import { RegisterData } from '@models';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';

@Component({
  selector: 'bw-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    PhoneInputComponent,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  private authApi = inject(AuthApiService);
  private auth = inject(AuthService);
  private lang = inject(LanguageService);

  loading = signal(false);
  error = signal<string | null>(null);

  // intl-tel-input emits the full E.164 phone string directly

  formData: RegisterData = {
    name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
  };

  isFormValid(): boolean {
    return !!(
      this.formData.name &&
      this.formData.email &&
      this.formData.phone &&
      this.formData.password &&
      this.formData.password_confirmation &&
      this.formData.password === this.formData.password_confirmation
    );
  }

  onRegister(form?: NgForm): void {
    if (form) {
      form.form.markAllAsTouched();
      if (form.invalid) return;
    }
    if (!this.isFormValid()) return;

    this.loading.set(true);
    this.error.set(null);

    this.authApi.register(this.formData).subscribe({
      next: ({ token, user }) => {
        this.auth.login(token, user);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const apiErrors = err.error?.errors as Record<string, string[]> | undefined;
        const lang = this.lang.lang();
        const msg = apiErrors
          ? Object.values(apiErrors).flat().map((m) => translateValidationMessage(m, lang)).join(' ')
          : this.lang.t('auth.register_error');
        this.error.set(msg);
      },
    });
  }
}
