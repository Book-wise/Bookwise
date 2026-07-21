import { Component, inject, signal } from '@angular/core';
import { NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
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

    this.loading.set(false);
    this.error.set('El registro público no está disponible actualmente.');
  }
}
