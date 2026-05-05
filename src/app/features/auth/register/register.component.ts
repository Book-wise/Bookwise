import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterData } from '../../../core/models';
import { COUNTRY_CODES } from '../../../shared/constants/country-codes';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    SelectModule,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  private api  = inject(ApiService);
  private auth = inject(AuthService);

  loading = signal(false);
  error   = signal<string | null>(null);

  readonly countryCodes = COUNTRY_CODES;

  // Phone split: country code + number (combined on submit)
  phoneCountryCode = '+56';
  phoneNumber = '';

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
      this.phoneNumber &&
      this.formData.password &&
      this.formData.password_confirmation &&
      this.formData.password === this.formData.password_confirmation
    );
  }

  onRegister(): void {
    if (!this.isFormValid()) return;

    this.loading.set(true);
    this.error.set(null);

    this.formData.phone = `${this.phoneCountryCode}${this.phoneNumber}`;

    this.api.register(this.formData).subscribe({
      next: ({ token, user }) => {
        this.auth.login(token, user);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const apiErrors = err.error?.errors as Record<string, string[]> | undefined;
        const msg = apiErrors
          ? Object.values(apiErrors).flat().join(' ')
          : (err.error?.message ?? 'Error al crear la cuenta. Intentá de nuevo.');
        this.error.set(msg);
      },
    });
  }
}
