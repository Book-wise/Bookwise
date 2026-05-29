import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ApiService } from '@services/api.service';
import { AuthService } from '@services/auth.service';
import { LoginCredentials } from '@models';

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
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private api  = inject(ApiService);
  private auth = inject(AuthService);

  loading = signal(false);
  error   = signal<string | null>(null);

  credentials: LoginCredentials = { email: '', password: '' };

  onLogin(): void {
    if (!this.credentials.email || !this.credentials.password) return;

    this.loading.set(true);
    this.error.set(null);

    this.api.login(this.credentials).subscribe({
      next: ({ token, user }) => {
        this.auth.login(token, user);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.error?.message ?? 'Credenciales incorrectas. Intentá de nuevo.'
        );
      },
    });
  }
}
