import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterData } from '../../../core/models';

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
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  private api  = inject(ApiService);
  private auth = inject(AuthService);

  loading = signal(false);
  error   = signal<string | null>(null);

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

  onRegister(): void {
    if (!this.isFormValid()) return;

    this.loading.set(true);
    this.error.set(null);

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
